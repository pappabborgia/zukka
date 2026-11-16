"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/actions/auth";

/** A form bound to a server action, showing its error or success message. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Please wait…",
  okMessage,
  danger = false,
  className,
  children,
  testId,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  okMessage?: string;
  danger?: boolean;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={`form ${className ?? ""}`} data-testid={testId}>
      {children}
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && okMessage && (
        <p className="form-ok" role="status">
          {okMessage}
        </p>
      )}
      <button type="submit" className={danger ? "btn btn-danger" : "btn"} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
