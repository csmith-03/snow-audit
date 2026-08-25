"use client";

import { useParams } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Finding, Report, Script, Severity } from "@/lib/types";
import { SEVERITY_ORDER } from "@/lib/types";
import { SCRIPT_TYPE_LABELS } from "@/lib/recordTypes";
import { CHECKLIST_BY_ID } from "@/lib/checklist";
import { DEFAULT_CONFIDENCE_FLOOR } from "@/lib/riskScore";
import { SeverityBadge } from "@/components/SeverityBadge";
import { RiskBadge } from "@/components/RiskBadge";

// No subscription source — sessionStorage doesn't change out from under us
// for a given reportId — so this only exists to read a browser-only API
// safely across server/client render without a setState-in-effect footgun.
function subscribe() {
  return () => {};
}

function useStoredReport(reportId: string): Report | null | undefined {
  // getSnapshot must return a referentially stable value when the underlying
  // data hasn't changed — JSON.parse() returns a fresh object every call, so
  // without this cache React sees a "new" snapshot on every render and loops
  // (React throws "Maximum update depth exceeded" / "getSnapshot should be
  // cached" once it detects this).
  const cache = useRef<{ raw: string | null; value: Report | null }>({
    raw: null,
    value: null,
  });

  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = sessionStorage.getItem(`report:${reportId}`);
      if (raw !== cache.current.raw) {
        cache.current = { raw, value: raw ? (JSON.parse(raw) as Report) : null };
      }
      return cache.current.value;
    },
    () => undefined // server snapshot: nothing to read during SSR
  );
}

export default function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const report = useStoredReport(reportId);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const findingsByScript = useMemo(() => {
    const map = new Map<string, Finding[]>();
    if (!report) return map;
    for (const f of report.findings) {
      if (!showAll && f.aiConfidence < DEFAULT_CONFIDENCE_FLOOR) continue;
      const list = map.get(f.scriptId) ?? [];
      list.push(f);
      map.set(f.scriptId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      );
    }
    return map;
  }, [report, showAll]);

  function toggle(scriptId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(scriptId)) next.delete(scriptId);
      else next.add(scriptId);
      return next;
    });
  }

  if (report === undefined) {
    return <div className="mx-auto max-w-5xl px-6 py-16">Loading…</div>;
  }

  if (report === null) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-neutral-600 dark:text-neutral-400">
          No report found for this ID in this browser session. Reports
          currently live only in the tab that generated them — run a new
          audit from the upload page.
        </p>
      </div>
    );
  }

  const scriptsByType = new Map<string, Script[]>();
  for (const s of report.scripts) {
    const list = scriptsByType.get(s.type) ?? [];
    list.push(s);
    scriptsByType.set(s.type, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{report.instanceName}</h1>
          <p className="text-sm text-neutral-500">
            {report.scripts.length} scripts reviewed ·{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
        <RiskBadge score={report.riskScore ?? 0} />
      </div>

      <label className="mt-8 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
        Show low-confidence findings too (hidden by default to keep this
        readable)
      </label>

      <div className="mt-8 space-y-10">
        {[...scriptsByType.entries()].map(([type, scripts]) => (
          <section key={type}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {SCRIPT_TYPE_LABELS[type as keyof typeof SCRIPT_TYPE_LABELS]} (
              {scripts.length})
            </h2>
            <div className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {scripts.map((script) => {
                const findings = findingsByScript.get(script.id) ?? [];
                const summary = report.summaries.find(
                  (s) => s.scriptId === script.id
                );
                const isOpen = expanded.has(script.id);
                const worst = findings[0]?.severity as Severity | undefined;

                return (
                  <div key={script.id}>
                    <button
                      onClick={() => toggle(script.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{script.name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {script.table ? `${script.table} · ` : ""}
                          {script.when ? `${script.when} · ` : ""}
                          {script.active ? "active" : "inactive"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {worst && <SeverityBadge severity={worst} />}
                        <span className="text-xs text-neutral-500">
                          {findings.length} finding
                          {findings.length === 1 ? "" : "s"}
                        </span>
                        <span className="text-neutral-400">
                          {isOpen ? "−" : "+"}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
                        {summary && (
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            {summary.plainEnglishSummary}
                          </p>
                        )}

                        {findings.length === 0 ? (
                          <p className="text-sm text-neutral-500">
                            No findings above the confidence threshold.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {findings.map((f) => {
                              const check = CHECKLIST_BY_ID[f.checkId];
                              return (
                                <li
                                  key={f.id}
                                  className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <SeverityBadge severity={f.severity} />
                                    <span className="font-mono text-xs text-neutral-500">
                                      {f.checkId}
                                    </span>
                                    <span className="text-sm font-medium">
                                      {check?.title ?? f.checkId}
                                    </span>
                                    <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
                                      {f.source}
                                    </span>
                                    <span className="ml-auto text-xs text-neutral-400">
                                      confidence {f.aiConfidence}%
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                                    {f.summary}
                                  </p>
                                  {f.snippet && (
                                    <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-900">
                                      {f.lineRef ? `L${f.lineRef}: ` : ""}
                                      {f.snippet}
                                    </pre>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
