import type { Report } from "./types";
import { CHECKLIST_BY_ID } from "./checklist";
import { SCRIPT_TYPE_LABELS } from "./recordTypes";

const COLUMNS = [
  "Script",
  "Type",
  "Table",
  "Active",
  "Check ID",
  "Check title",
  "Severity",
  "Confidence",
  "Source",
  "Finding",
  "Line",
  "Snippet",
] as const;

/** RFC 4180: quote a field only when needed, doubling any internal quotes. */
function csvField(value: string | number | boolean | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function findingsToCsv(report: Report): string {
  const scriptById = new Map(report.scripts.map((s) => [s.id, s]));
  const rows = [COLUMNS.map(csvField).join(",")];

  for (const f of report.findings) {
    const script = scriptById.get(f.scriptId);
    const check = CHECKLIST_BY_ID[f.checkId];
    rows.push(
      [
        script?.name ?? f.scriptId,
        script ? SCRIPT_TYPE_LABELS[script.type] : "",
        script?.table ?? "",
        script?.active ?? "",
        f.checkId,
        check?.title ?? "",
        f.severity,
        f.aiConfidence,
        f.source,
        f.summary,
        f.lineRef ?? "",
        f.snippet,
      ]
        .map(csvField)
        .join(",")
    );
  }

  return rows.join("\r\n");
}

/** Triggers a browser download — only meaningful in a real page, not a sandboxed preview. */
export function downloadCsv(filename: string, csv: string) {
  // Leading BOM so Excel opens UTF-8 content (accented names, smart quotes
  // in AI-generated summaries) without mangling it.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
