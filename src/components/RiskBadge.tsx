import { riskBand } from "@/lib/riskScore";

const TONE_STYLES = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
} as const;

export function RiskBadge({ score }: { score: number }) {
  const band = riskBand(score);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${TONE_STYLES[band.tone]}`}
    >
      {band.label} · {score}/100
    </span>
  );
}
