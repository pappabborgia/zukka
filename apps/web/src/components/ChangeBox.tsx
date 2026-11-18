"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";

const SUGGESTIONS = [
  "Make it a little easier",
  "Make it a little harder",
  "Add one more level",
  "Make the buttons bigger",
  "Use brighter colours",
  "Add more questions on the same topics",
  "Make the ending more exciting",
];

/** "What would you like to change?" with a few ready-made ideas. */
export function ChangeBox({ action, gameId, disabled }: { action: (prev: FormState, form: FormData) => Promise<FormState>; gameId: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="change-box" data-testid="change-box">
      <input type="hidden" name="gameId" value={gameId} />
      <label className="field">
        What would you like to change?
        <textarea name="request" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={600} placeholder="The rocket should be red, and the questions should be about the 4 times table" disabled={disabled} />
      </label>
      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => setText((t) => (t ? `${t.replace(/\s+$/, "")}. ${s}` : s))} disabled={disabled}>
            {s}
          </button>
        ))}
      </div>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn" disabled={disabled || pending || text.trim().length < 3}>
        {pending ? "Sending…" : "✨ Change my game"}
      </button>
      <p className="hint">Each change makes a new version. You can always go back to an earlier one.</p>
    </form>
  );
}
