"use client";

import { useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { ActionForm } from "./ActionForm";

export interface TopicChoice {
  id: string;
  subject: "maths" | "reading" | "writing";
  years: number[];
  label: string;
  hint?: string;
  usesTables?: boolean;
}

export interface QuickValues {
  title: string;
  tournamentName: string;
  teamName: string;
  colour1: string;
  colour2: string;
  pattern: string;
  subject: "maths" | "reading" | "writing";
  year: 2 | 3;
  topics: string[];
  tables: number[];
}

const SUBJECTS = [
  { id: "maths", label: "🔢 Maths" },
  { id: "reading", label: "📖 Reading" },
  { id: "writing", label: "✏️ Writing" },
] as const;

function shieldBackground(pattern: string, a: string, b: string): string {
  switch (pattern) {
    case "stripes":
      return `repeating-linear-gradient(90deg,${a} 0 22%,${b} 22% 44%)`;
    case "hoops":
      return `repeating-linear-gradient(180deg,${a} 0 18%,${b} 18% 36%)`;
    case "halves":
      return `linear-gradient(90deg,${a} 50%,${b} 50%)`;
    case "sash":
      return `linear-gradient(135deg,${a} 38%,${b} 38% 62%,${a} 62%)`;
    default:
      return a;
  }
}

/** The quick creation form for School Cup. Names are typed by the parent and checked on the server. */
export function QuickGameForm({
  action,
  submitLabel,
  topics,
  colours,
  patterns,
  tables,
  initial,
  hidden,
  aiAvailable = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  topics: TopicChoice[];
  colours: readonly string[];
  patterns: readonly string[];
  tables: readonly number[];
  initial: QuickValues;
  hidden: Record<string, string>;
  /** the server can ask the AI for extra questions */
  aiAvailable?: boolean;
}) {
  const [subject, setSubject] = useState(initial.subject);
  const [year, setYear] = useState<2 | 3>(initial.year);
  const [chosen, setChosen] = useState<string[]>(initial.topics);
  const [c1, setC1] = useState(initial.colour1);
  const [c2, setC2] = useState(initial.colour2);
  const [pattern, setPattern] = useState(initial.pattern);
  const [team, setTeam] = useState(initial.teamName);

  const available = topics.filter((t) => t.subject === subject && t.years.includes(year));
  const visibleChosen = chosen.filter((id) => available.some((t) => t.id === id));
  const needsTables = available.some((t) => t.usesTables && visibleChosen.includes(t.id));
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const ink = (() => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c1.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#14233b" : "#ffffff";
  })();
  const initials =
    team
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <ActionForm action={action} submitLabel={submitLabel} pendingLabel="Saving…" testId="quick-form">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <fieldset>
        <legend>Names</legend>
        <label className="field">
          Name of the game
          <input name="title" defaultValue={initial.title} minLength={3} maxLength={40} required />
        </label>
        <label className="field">
          Name of the tournament
          <input name="tournamentName" defaultValue={initial.tournamentName} minLength={3} maxLength={40} required />
        </label>
        <label className="field">
          Name of your team
          <input name="teamName" value={team} onChange={(e) => setTeam(e.target.value)} minLength={3} maxLength={24} required />
        </label>
        <p className="hint">Make them up: no real clubs, brands, characters or children&apos;s names.</p>
      </fieldset>

      <fieldset>
        <legend>Team colours</legend>
        <div className="team-preview">
          <span className="shield" style={{ background: shieldBackground(pattern, c1, c2), color: ink }} data-testid="shield-preview">
            <b>{initials.slice(0, 3)}</b>
          </span>
          <div className="team-pickers">
            <small className="hint">Main colour</small>
            <div className="swatches" role="radiogroup" aria-label="Main colour">
              {colours.map((c) => (
                <label key={`a${c}`} className="swatch" style={{ background: c }} title={c}>
                  <input type="radio" name="colour1" value={c} checked={c1 === c} onChange={() => setC1(c)} />
                </label>
              ))}
            </div>
            <small className="hint">Second colour</small>
            <div className="swatches" role="radiogroup" aria-label="Second colour">
              {colours.map((c) => (
                <label key={`b${c}`} className="swatch" style={{ background: c }} title={c}>
                  <input type="radio" name="colour2" value={c} checked={c2 === c} onChange={() => setC2(c)} />
                </label>
              ))}
            </div>
            <small className="hint">Pattern</small>
            <div className="choice-row">
              {patterns.map((p) => (
                <label key={p} className="choice">
                  <input type="radio" name="pattern" value={p} checked={pattern === p} onChange={() => setPattern(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>What it teaches</legend>
        <div className="choice-row">
          {SUBJECTS.map((s) => (
            <label key={s.id} className="choice">
              <input type="radio" name="subject" value={s.id} checked={subject === s.id} onChange={() => setSubject(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
        <div className="choice-row">
          {([2, 3] as const).map((y) => (
            <label key={y} className="choice">
              <input type="radio" name="year" value={y} checked={year === y} onChange={() => setYear(y)} />
              Year {y}
            </label>
          ))}
        </div>
        <p className="hint">Topics (1 to 6). The questions get harder round after round.</p>
        <div className="topic-list" data-testid="topic-list">
          {available.map((t) => (
            <label key={t.id} className="check">
              <input type="checkbox" name="topics" value={t.id} checked={visibleChosen.includes(t.id)} onChange={() => toggle(t.id)} />
              <span>
                {t.label}
                {t.hint && <small className="hint"> · {t.hint}</small>}
              </span>
            </label>
          ))}
        </div>
        {needsTables && (
          <div className="tables" data-testid="tables">
            <p className="hint">Which times tables?</p>
            <div className="choice-row">
              {tables.map((n) => (
                <label key={n} className="choice">
                  <input type="checkbox" name="tables" value={n} defaultChecked={initial.tables.includes(n)} />
                  {n}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {aiAvailable && (
        <label className="check ai-check">
          <input type="checkbox" name="ai" defaultChecked />
          <span>
            ✨ Add extra questions written by AI on these topics{subject === "maths" ? " (word problems; the answers are checked by Zukka)" : ""}.
            <small className="hint"> Saving takes up to a minute.</small>
          </span>
        </label>
      )}

      <div className="rules-box">
        <strong>Before you save</strong>
        <ul>
          <li>No real teams, brands or characters that belong to someone else.</li>
          <li>No personal data of children: no real names, photos or schools.</li>
          <li>Nothing violent, scary or unsuitable for 6 to 9 year olds.</li>
        </ul>
      </div>
    </ActionForm>
  );
}
