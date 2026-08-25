import type { Finding, Script } from "../types";
import { CHECKLIST_BY_ID } from "../checklist";

// Regex-based detectors for the subset of the checklist that's mechanically
// detectable (hasStaticDetector: true in checklist.ts). These run for free,
// with no AI call, so a report has real findings even before the AI pass
// (SEC-04/06, CQ-03/05, PERF-02) is wired up. Confidence is intentionally
// capped below what an AI pass with full context would give — these are
// pattern matches, not semantic understanding.

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function lineNumberAt(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

function snippetAround(code: string, index: number, matchLength: number): string {
  const lineStart = code.lastIndexOf("\n", index) + 1;
  let lineEnd = code.indexOf("\n", index + matchLength);
  if (lineEnd === -1) lineEnd = code.length;
  return code.slice(lineStart, lineEnd).trim().slice(0, 200);
}

interface Detection {
  checkId: string;
  match: RegExpMatchArray;
  confidence: number;
  note?: string;
}

function makeFinding(
  script: Script,
  field: string,
  code: string,
  d: Detection
): Finding {
  const check = CHECKLIST_BY_ID[d.checkId];
  const index = d.match.index ?? 0;
  return {
    id: newId(),
    scriptId: script.id,
    checkId: d.checkId,
    severity: check.severity,
    summary: d.note ?? check.title,
    lineRef: lineNumberAt(code, index),
    snippet: `[${field}] ${snippetAround(code, index, d.match[0].length)}`,
    aiConfidence: d.confidence,
    source: "static",
  };
}

/** true if this (script type, field) pair executes on the server (vs. in-browser). */
function isServerSide(script: Script, field: string): boolean {
  if (script.type === "client_script") return false;
  if (script.type === "ui_action") return field === "script"; // client_script field runs in browser
  return true; // business_rule, script_include
}

function detectInSource(
  script: Script,
  field: string,
  code: string
): Finding[] {
  const findings: Finding[] = [];
  const push = (d: Detection) => findings.push(makeFinding(script, field, code, d));

  // SEC-01: addEncodedQuery with a non-literal argument (variable/concat, not a plain string)
  for (const m of code.matchAll(/addEncodedQuery\s*\(\s*([^)]*)\)/g)) {
    const arg = m[1].trim();
    const isPlainStringLiteral = /^['"][^'"]*['"]$/.test(arg);
    if (!isPlainStringLiteral) {
      push({
        checkId: "SEC-01",
        match: m,
        confidence: 55,
        note: "addEncodedQuery() built from a variable — confirm the value isn't user-controlled.",
      });
    }
  }

  // SEC-02: eval / GlideEvaluator / gs.eval
  for (const m of code.matchAll(/\beval\s*\(|GlideEvaluator|gs\.eval\s*\(/g)) {
    push({ checkId: "SEC-02", match: m, confidence: 50 });
  }

  // SEC-05: hardcoded secrets
  for (const m of code.matchAll(
    /\b(password|passwd|api[_-]?key|secret|token)\b\s*[:=]\s*['"][^'"]{4,}['"]/gi
  )) {
    push({ checkId: "SEC-05", match: m, confidence: 60 });
  }
  for (const m of code.matchAll(/https?:\/\/[^\s'"/]+:[^\s'"/@]+@/g)) {
    push({
      checkId: "SEC-05",
      match: m,
      confidence: 70,
      note: "URL with embedded credentials.",
    });
  }

  // SEC-07: deleteMultiple/updateMultiple with no query conditions anywhere in the script
  const hasQuery = /addQuery\s*\(|addEncodedQuery\s*\(/.test(code);
  if (!hasQuery) {
    for (const m of code.matchAll(/\b(deleteMultiple|updateMultiple)\s*\(/g)) {
      push({
        checkId: "SEC-07",
        match: m,
        confidence: 65,
        note: `${m[1]}() called with no addQuery()/addEncodedQuery() found anywhere in this script.`,
      });
    }
  }

  // SEC-08: setWorkflow(false) / autoSysFields(false)
  for (const m of code.matchAll(
    /setWorkflow\s*\(\s*false\s*\)|autoSysFields\s*\(\s*false\s*\)/g
  )) {
    push({ checkId: "SEC-08", match: m, confidence: 75 });
  }

  // SEC-09: direct SQL bypass
  for (const m of code.matchAll(/GlideDBQuery|Packages\.java\.sql/g)) {
    push({ checkId: "SEC-09", match: m, confidence: 70 });
  }

  const serverSide = isServerSide(script, field);

  // CQ-04: script include missing Class.create()
  if (script.type === "script_include" && !/Class\.create\s*\(\s*\)/.test(code)) {
    push({
      checkId: "CQ-04",
      match: { 0: "", index: 0 } as RegExpMatchArray,
      confidence: 55,
      note: "No Class.create() found — script include doesn't follow the standard class pattern.",
    });
  }

  // CQ-08: JSON.parse without a nearby try, and empty catch blocks
  for (const m of code.matchAll(/JSON\.parse\s*\(/g)) {
    const before = code.slice(Math.max(0, (m.index ?? 0) - 200), m.index ?? 0);
    if (!/\btry\b/.test(before)) {
      push({
        checkId: "CQ-08",
        match: m,
        confidence: 45,
        note: "JSON.parse() with no nearby try/catch.",
      });
    }
  }
  for (const m of code.matchAll(/catch\s*\([^)]*\)\s*\{\s*\}/g)) {
    push({
      checkId: "CQ-08",
      match: m,
      confidence: 65,
      note: "Empty catch block — error is silently swallowed.",
    });
  }

  // CQ-09: async patterns don't work server-side
  if (serverSide) {
    for (const m of code.matchAll(
      /\bnew\s+Promise\s*\(|\.then\s*\(|\basync\s+function\b|\bawait\b|\bsetTimeout\s*\(|\bsetInterval\s*\(/g
    )) {
      push({
        checkId: "CQ-09",
        match: m,
        confidence: 70,
        note: `${m[0].trim()} — doesn't run in ServiceNow's synchronous server-side engine.`,
      });
    }
  }

  // PERF-01: new GlideRecord(...) textually inside a while/for block (approximate — no AST).
  // The condition matcher tolerates one level of nested parens so the extremely
  // common `while (gr.next())` shape actually matches — a plain [^)]* here would
  // stop at the first inner `)` and fail the whole loop-opener match.
  for (const loopMatch of code.matchAll(
    /\b(while|for)\s*\((?:[^()]|\([^()]*\))*\)\s*\{/g
  )) {
    const start = (loopMatch.index ?? 0) + loopMatch[0].length;
    const window = code.slice(start, start + 600); // heuristic window, not brace-matched
    const grMatch = window.match(/new\s+GlideRecord\s*\(/);
    if (grMatch) {
      push({
        checkId: "PERF-01",
        match: {
          0: grMatch[0],
          index: start + (grMatch.index ?? 0),
        } as RegExpMatchArray,
        confidence: 40,
        note: "GlideRecord query appears inside a loop — verify this isn't an N+1 pattern.",
      });
    }
  }

  // PERF-03: getRowCount()
  for (const m of code.matchAll(/\.getRowCount\s*\(\s*\)/g)) {
    push({ checkId: "PERF-03", match: m, confidence: 60 });
  }

  return findings;
}

export function runStaticChecks(script: Script): Finding[] {
  return script.sources.flatMap((s) => detectInSource(script, s.field, s.code));
}
