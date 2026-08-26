export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9,5 4,12 9,19" />
      <polyline points="15,5 20,12 15,19" />
      <polyline
        points="9.5,12.5 11.5,15.5 15.5,8.5"
        className="stroke-sky-600 dark:stroke-sky-400"
      />
    </svg>
  );
}
