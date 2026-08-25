import Link from "next/link";
import { CHECKLIST } from "@/lib/checklist";
import { SCRIPT_TYPE_LABELS } from "@/lib/recordTypes";
import { SeverityBadge } from "@/components/SeverityBadge";

export default function Home() {
  const categories = ["security", "quality", "performance"] as const;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Know what your ServiceNow scripts actually do before you touch them.
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          Upload an Update Set export and get a plain-English summary and a
          security/quality review of every Business Rule, Client Script,
          Script Include, and UI Action in it — in minutes, not a
          consultant&apos;s multi-week engagement.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/upload"
            className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Run an audit
          </Link>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Scope
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          v1 covers the four record types that carry the customizations
          admins are actually afraid to touch:
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {Object.values(SCRIPT_TYPE_LABELS).map((label) => (
            <li
              key={label}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
            >
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          What gets checked ({CHECKLIST.length} rubric items)
        </h2>
        <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
          {categories.map((cat) => (
            <div key={cat} className="py-4">
              <h3 className="text-sm font-semibold capitalize">{cat}</h3>
              <ul className="mt-2 space-y-2">
                {CHECKLIST.filter((c) => c.category === cat).map((c) => (
                  <li key={c.id} className="flex items-start gap-3 text-sm">
                    <SeverityBadge severity={c.severity} />
                    <span className="text-neutral-700 dark:text-neutral-300">
                      <span className="font-mono text-xs text-neutral-500">
                        {c.id}
                      </span>{" "}
                      {c.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
