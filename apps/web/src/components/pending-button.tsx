import { type ButtonHTMLAttributes, type ReactNode } from "react";
import DotPulseSpinner from "@/components/dot-pulse-spinner";

// Presentational only: the caller owns the `pending` state (an inline
// `isSubmitting` guard per form, matching the rest of the codebase).
// This renders the visual in-flight affordance — disabled, a decorative
// (aria-hidden) spinner, and a swapped visible label.
//
// Note: while pending the button is `disabled`, so it leaves the focus
// order and the label change is NOT announced to assistive tech. Spoken
// in-flight / result feedback for the auth flows is tracked in #57.
type PendingButtonProps = {
  pending: boolean;
  idleLabel: ReactNode;
  pendingLabel: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function PendingButton({
  pending,
  idleLabel,
  pendingLabel,
  className = "",
  disabled,
  ...rest
}: PendingButtonProps) {
  return (
    <button
      {...rest}
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed ${className}`}
    >
      {pending && <DotPulseSpinner />}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
