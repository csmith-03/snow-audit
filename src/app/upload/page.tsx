"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Report } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const [instanceName, setInstanceName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{
    skipped: { name: string; table: string | null }[];
    errors: string[];
  } | null>(null);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    scriptName: string | null;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose an Update Set XML export first.");
      return;
    }
    setStatus("working");
    setError(null);
    setDetails(null);
    setProgress(null);

    const form = new FormData();
    form.append("file", file);
    form.append("instanceName", instanceName);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });

      // Parse failures (bad/empty XML) return a normal JSON error before any
      // streaming starts — same shape as before.
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong parsing that file.");
        setDetails(data.details ?? null);
        setStatus("error");
        return;
      }

      if (!res.body) {
        setError("No response body from the server. Try again.");
        setStatus("error");
        return;
      }

      // Success streams newline-delimited JSON progress events, ending in a
      // "done" event carrying the full report — see api/analyze/route.ts.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last line may be incomplete — hold it for the next chunk

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "parsed") {
            setProgress({ completed: 0, total: event.total, scriptName: null });
          } else if (event.type === "progress") {
            setProgress({
              completed: event.completed,
              total: event.total,
              scriptName: event.scriptName,
            });
          } else if (event.type === "done") {
            const report: Report = event.report;
            // No backend/DB yet in this build — the report lives in this
            // browser session only. Swap for a real persisted report +
            // redirect once the API route writes to a database.
            sessionStorage.setItem(`report:${report.id}`, JSON.stringify(report));
            router.push(`/report/${report.id}`);
            return;
          } else if (event.type === "error") {
            setError(event.error ?? "Analysis failed.");
            setStatus("error");
            return;
          }
        }
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">Run an audit</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Export your Update Set as XML (Retrieved Update Sets → the update set
        record → Export to XML) and upload it here.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="instanceName" className="block text-sm font-medium">
            Instance name{" "}
            <span className="font-normal text-neutral-500">(label only)</span>
          </label>
          <input
            id="instanceName"
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="acme-prod"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium">
            Update Set XML
          </label>
          <input
            id="file"
            type="file"
            accept=".xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-700 dark:file:bg-white dark:file:text-neutral-900"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            <p>{error}</p>
            {details && details.skipped.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">
                  Found {details.skipped.length} record(s) outside the 4
                  supported types:
                </p>
                <ul className="mt-1 list-inside list-disc font-mono text-xs">
                  {details.skipped.slice(0, 15).map((s, i) => (
                    <li key={i}>
                      {s.name} {s.table ? `(${s.table})` : "(no source_table)"}
                    </li>
                  ))}
                </ul>
                {details.skipped.length > 15 && (
                  <p className="mt-1 text-xs">
                    …and {details.skipped.length - 15} more.
                  </p>
                )}
              </div>
            )}
            {details && details.errors.length > 0 && (
              <ul className="mt-2 list-inside list-disc font-mono text-xs">
                {details.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === "working" && progress && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all duration-300 dark:bg-white"
                style={{
                  width:
                    progress.total > 0
                      ? `${Math.round((progress.completed / progress.total) * 100)}%`
                      : "0%",
                }}
              />
            </div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {progress.completed} of {progress.total} scripts analyzed
              {progress.scriptName ? ` — ${progress.scriptName}` : ""}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "working"}
          className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {status === "working"
            ? progress
              ? `Analyzing… (${progress.completed}/${progress.total})`
              : "Starting…"
            : "Analyze"}
        </button>
      </form>
    </div>
  );
}
