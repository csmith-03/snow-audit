import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Finding, Script, ScriptSummary } from "../types";
import { CHECKLIST, CHECKLIST_BY_ID } from "../checklist";
import { SCRIPT_TYPE_LABELS } from "../recordTypes";

const client = new Anthropic();

// Restricts the model to checkIds we actually define — it can't invent a
// category, and z.enum gives a structural guarantee rather than a prompt hope.
const CHECK_IDS = CHECKLIST.map((c) => c.id) as [string, ...string[]];

const AnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-4 sentence plain-English description of what this script does and when it runs. Written for an admin who didn't write it."
    ),
  findings: z
    .array(
      z.object({
        checkId: z
          .enum(CHECK_IDS)
          .describe("Which checklist item this finding is for."),
        evidence: z
          .string()
          .describe(
            "What specifically in THIS script triggered the finding. Quote or closely paraphrase the actual code — never just restate the checklist description."
          ),
        codeExcerpt: z
          .string()
          .nullable()
          .describe(
            "A short (1-5 line) verbatim excerpt of the relevant code, or null if the issue isn't localized to a specific spot."
          ),
        lineRef: z
          .number()
          .int()
          .nullable()
          .describe("Approximate 1-indexed line number, or null if unknown."),
        confidence: z
          .number()
          .int()
          .min(0)
          .max(100)
          .describe(
            "How confident you are this is a real, actionable issue in this specific script — not how relevant the category is in general."
          ),
      })
    )
    .describe(
      "Only real, specific findings grounded in this script's actual code. An empty array is a good outcome, not a failure to find something."
    ),
});

function buildSystemPrompt(): string {
  const rubric = CHECKLIST.map(
    (c) => `- ${c.id} [${c.severity}] ${c.title}: ${c.description}`
  ).join("\n");

  return `You are reviewing ServiceNow scripts (Business Rules, Client Scripts, Script Includes, UI Actions) for a code and security audit tool used by admins who did not write this code and need to know what's safe to touch.

For each script:
1. Summarize what it does and when it runs, in plain English.
2. Check it against the rubric below. Cite a checkId only when you can point to something concrete in THIS script's code — never report a finding just because the category is generically relevant to this kind of script.

Rubric:
${rubric}

Be concrete and conservative: low-confidence or speculative findings are worse than no finding, because they erode trust in the report. If nothing is wrong, return an empty findings array.`;
}

function buildUserPrompt(script: Script): string {
  const meta = [
    `Type: ${SCRIPT_TYPE_LABELS[script.type]}`,
    script.table ? `Table: ${script.table}` : null,
    script.when ? `When: ${script.when}` : null,
    script.condition ? `Condition: ${script.condition}` : null,
    `Active: ${script.active}`,
    script.clientCallable !== null
      ? `Client callable: ${script.clientCallable}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sources = script.sources
    .map((s) => `--- field: ${s.field} ---\n${s.code}`)
    .join("\n\n");

  return `Script name: ${script.name}\n${meta}\n\n${sources}`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface AiAnalysis {
  summary: ScriptSummary;
  findings: Finding[];
}

function fallback(script: Script, reason: string): AiAnalysis {
  return {
    summary: {
      scriptId: script.id,
      plainEnglishSummary: `AI summary unavailable for this script (${reason}). Static findings below still apply.`,
    },
    findings: [],
  };
}

export async function analyzeScriptWithAi(script: Script): Promise<AiAnalysis> {
  if (script.sources.every((s) => s.code.trim().length === 0)) {
    return {
      summary: {
        scriptId: script.id,
        plainEnglishSummary: "No script body on this record — nothing to review.",
      },
      findings: [],
    };
  }

  let response;
  try {
    response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      // The rubric is identical on every call in a report — cache it so a
      // 30-script report pays full price once, not 30 times.
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(script) }],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });
  } catch (err) {
    // Degrade gracefully — one script's AI failure (missing key, rate limit,
    // transient 5xx) shouldn't blow up the whole report. Static findings
    // for this script are computed separately and still make it into the report.
    //
    // "No credentials resolvable at all" is a pre-flight SDK error thrown
    // before any HTTP request — it's a plain Error, not an APIError subclass,
    // so there's no typed class to catch it by (confirmed by direct testing).
    if (err instanceof Error && /authentication method/i.test(err.message)) {
      return fallback(script, "no ANTHROPIC_API_KEY configured");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fallback(script, "invalid ANTHROPIC_API_KEY");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return fallback(script, "rate limited — try again shortly");
    }
    if (
      err instanceof Anthropic.BadRequestError &&
      /credit balance is too low/i.test(err.message)
    ) {
      return fallback(script, "Anthropic account has insufficient credits");
    }
    if (err instanceof Anthropic.APIError) {
      return fallback(script, `API error ${err.status}`);
    }
    return fallback(script, "request failed");
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    return fallback(script, "response didn't match the expected schema");
  }

  const findings: Finding[] = parsed.findings.map((f) => {
    const check = CHECKLIST_BY_ID[f.checkId];
    return {
      id: newId(),
      scriptId: script.id,
      checkId: f.checkId,
      severity: check.severity, // severity is owned by the checklist, not the model
      summary: f.evidence,
      lineRef: f.lineRef,
      snippet: f.codeExcerpt ?? "",
      aiConfidence: f.confidence,
      source: "ai",
    };
  });

  return {
    summary: { scriptId: script.id, plainEnglishSummary: parsed.summary },
    findings,
  };
}
