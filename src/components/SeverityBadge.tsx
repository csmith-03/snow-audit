import type { Severity } from "@/lib/types";

const STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  info: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
