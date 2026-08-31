const dotClassName =
  "h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-dot-pulse motion-reduce:opacity-70";

// Decorative only — the button label itself carries the "in progress"
// state, so this doesn't need its own accessible name.
export default function DotPulseSpinner({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`inline-flex gap-1 ${className}`}>
      <span className={dotClassName} />
      <span className={`${dotClassName} [animation-delay:120ms]`} />
      <span className={`${dotClassName} [animation-delay:240ms]`} />
    </span>
  );
}
