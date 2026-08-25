import { NextRequest, NextResponse } from "next/server";
import { parseUpdateSetXml } from "@/lib/parser";
import { runStaticChecks } from "@/lib/analyzers/staticChecks";
import { analyzeScriptWithAi } from "@/lib/analyzers/aiSummary";
import { computeRiskScore } from "@/lib/riskScore";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Finding, Report, ScriptSummary } from "@/lib/types";

// Bounded so a large Update Set doesn't fire 50+ concurrent AI calls at once.
const AI_CONCURRENCY = 4;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// Streamed as newline-delimited JSON so /upload can show "n of m analyzed"
// instead of a single ~45s blocking spinner. One event object per line:
//   {type:"parsed", total}
//   {type:"progress", completed, total, scriptName}
//   {type:"done", report, meta}
//   {type:"error", error}
type AnalyzeEvent =
  | { type: "parsed"; total: number }
  | { type: "progress"; completed: number; total: number; scriptName: string }
  | {
      type: "done";
      report: Report;
      meta: { parsedRecords: number; skippedRecords: number; warnings: string[] };
    }
  | { type: "error"; error: string };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const instanceName = (form.get("instanceName") as string | null)?.trim() || "Untitled instance";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const xml = await file.text();
  const reportId = newId();
  const { scripts, skipped, errors } = parseUpdateSetXml(xml, reportId);

  // Fails fast with a normal JSON response — nothing to stream progress on yet.
  if (scripts.length === 0) {
    return NextResponse.json(
      {
        error:
          errors[0] ??
          "No Business Rules, Client Scripts, Script Includes, or UI Actions found in this export.",
        details: { skipped, errors },
      },
      { status: 422 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AnalyzeEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      try {
        send({ type: "parsed", total: scripts.length });

        // Static checks are free/instant and always run. The AI pass adds
        // semantic findings (missing role checks, unvalidated GlideAjax
        // params, ...) that regex can't catch, plus the plain-English
        // summary — but a failure there (no API key, rate limit) degrades to
        // static-only rather than failing the whole report; see the
        // fallback() path in aiSummary.ts.
        const staticFindings = scripts.flatMap((s) => runStaticChecks(s));

        let completed = 0;
        const aiResults = await mapWithConcurrency(
          scripts,
          AI_CONCURRENCY,
          (s) => analyzeScriptWithAi(s),
          (_result, script) => {
            completed++;
            send({
              type: "progress",
              completed,
              total: scripts.length,
              scriptName: script.name,
            });
          }
        );

        const findings: Finding[] = [
          ...staticFindings,
          ...aiResults.flatMap((r) => r.findings),
        ];
        const summaries: ScriptSummary[] = aiResults.map((r) => r.summary);

        const report: Report = {
          id: reportId,
          instanceName,
          status: "ready",
          riskScore: computeRiskScore(findings),
          createdAt: new Date().toISOString(),
          scripts,
          findings,
          summaries,
        };

        send({
          type: "done",
          report,
          meta: {
            parsedRecords: scripts.length,
            skippedRecords: skipped.length,
            warnings: errors,
          },
        });
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Analysis failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
