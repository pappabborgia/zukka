"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import type { TopicChoice } from "./QuickGameForm";

/**
 * The free creation wizard: five short steps that give the AI what it needs to make a good game.
 * Every field stays in the one form (hidden steps are only hidden), so the last step sends everything.
 */
type Answers = {
  title: string;
  gameType: string;
  description: string;
  subject: string;
  year: string;
  topics: string[];
  otherTopics: string;
  questionStyle: string;
  setting: string;
  settingOther: string;
  hero: string;
  others: string;
  mood: string;
  winBy: string;
  levels: string;
  minutes: string;
  reward: string;
  extra: string;
};

const START: Answers = {
  title: "",
  gameType: "",
  description: "",
  subject: "",
  year: "",
  topics: [],
  otherTopics: "",
  questionStyle: "choice",
  setting: "",
  settingOther: "",
  hero: "",
  others: "",
  mood: "bright",
  winBy: "finish",
  levels: "4",
  minutes: "7",
  reward: "stars",
  extra: "",
};

const GAME_TYPES = [
  { id: "race", icon: "🏃", label: "Race", hint: "Run, ride or fly to the finish" },
  { id: "quiz", icon: "🎤", label: "Quiz show", hint: "Rounds, a host and a score" },
  { id: "puzzle", icon: "🧩", label: "Puzzle", hint: "Match, sort or complete" },
  { id: "adventure", icon: "🗺️", label: "Adventure", hint: "A map with a challenge in each place" },
  { id: "catch", icon: "🧺", label: "Catch and collect", hint: "Tap or catch the right answers" },
  { id: "sports", icon: "⚽", label: "Sports", hint: "Answers win points, passes or shots" },
  { id: "board", icon: "🎲", label: "Board game", hint: "Roll, move and answer on each square" },
  { id: "other", icon: "✨", label: "Something else", hint: "Describe it below" },
];
const SUBJECTS = [
  { id: "maths", label: "🔢 Maths" },
  { id: "reading", label: "📖 Reading" },
  { id: "writing", label: "✏️ Writing" },
  { id: "other", label: "🌍 Something else" },
];
const YEARS = [
  { id: "2", label: "Year 2" },
  { id: "3", label: "Year 3" },
  { id: "other", label: "Ages 6 to 9" },
];
const STYLES = [
  { id: "choice", label: "Tap the answer", hint: "multiple choice" },
  { id: "typed", label: "Type the answer", hint: "checked by the game" },
  { id: "mixed", label: "A mix", hint: "mostly tapping" },
];
const SETTINGS = [
  { id: "space", icon: "🚀", label: "Space" },
  { id: "jungle", icon: "🌴", label: "Jungle" },
  { id: "ocean", icon: "🐠", label: "Under the sea" },
  { id: "city", icon: "🏙️", label: "Town" },
  { id: "castle", icon: "🏰", label: "Castle" },
  { id: "farm", icon: "🚜", label: "Farm" },
  { id: "stadium", icon: "🏟️", label: "Stadium" },
  { id: "school", icon: "🏫", label: "School" },
  { id: "other", icon: "✏️", label: "Somewhere else" },
];
const MOODS = [
  { id: "bright", label: "🌈 Bright and colourful" },
  { id: "cosy", label: "🧸 Cosy and warm" },
  { id: "funny", label: "🤪 Funny and silly" },
  { id: "calm", label: "🌙 Calm and gentle" },
];
const WIN = [
  { id: "finish", label: "Reach the end" },
  { id: "points", label: "Score points" },
  { id: "collect", label: "Collect everything" },
  { id: "clock", label: "Beat the clock" },
];
const REWARDS = [
  { id: "stars", label: "⭐ Stars for each level" },
  { id: "trophy", label: "🏆 A trophy at the end" },
  { id: "badges", label: "🎖️ A badge for each level" },
  { id: "none", label: "No extra rewards" },
];
const STEPS = ["The idea", "What it teaches", "World and characters", "How it plays", "Check and create"];

const labelOf = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? "";

export function FreeGameWizard({ action, topics }: { action: (prev: FormState, form: FormData) => Promise<FormState>; topics: TopicChoice[] }) {
  const [a, setA] = useState<Answers>(START);
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(action, undefined);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((x) => ({ ...x, [k]: v }));

  const available = topics.filter((t) => t.subject === a.subject && (a.year === "other" || t.years.includes(Number(a.year))));
  const chosenTopics = a.topics.filter((id) => available.some((t) => t.id === id));

  /** What is missing in a step, if anything. */
  function missing(s: number): string | null {
    if (s === 0) {
      if (a.title.trim().length < 3) return "Give your game a name (at least 3 letters).";
      if (!a.gameType) return "Choose what kind of game it is.";
      if (a.description.trim().length < 20) return "Tell us in a sentence or two what the game is about (at least 20 characters).";
    }
    if (s === 1) {
      if (!a.subject) return "Choose what the game teaches.";
      if (!a.year) return "Choose the school year.";
      if (a.subject === "other" && !a.otherTopics.trim()) return "Write what the game teaches.";
      if (a.subject !== "other" && chosenTopics.length === 0 && !a.otherTopics.trim()) return "Choose at least one topic, or write one.";
    }
    if (s === 2) {
      if (!a.setting) return "Choose where the game happens.";
      if (a.setting === "other" && !a.settingOther.trim()) return "Describe where the game happens.";
    }
    return null;
  }
  const next = () => {
    const m = missing(step);
    setHint(m);
    if (!m) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setHint(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <form
      action={formAction}
      className="wizard"
      data-testid="free-wizard"
      onKeyDown={(e) => {
        // Enter in a text box goes to the next step instead of sending the form early
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && step < STEPS.length - 1) {
          e.preventDefault();
          next();
        }
      }}
    >
      <ol className="wizard-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "now" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {/* 1. The idea */}
      <section className="wizard-card" hidden={step !== 0} data-step="1">
        <h2>1. The idea</h2>
        <label className="field">
          Name of the game
          <input name="title" value={a.title} onChange={(e) => set("title", e.target.value)} maxLength={40} placeholder="Star Catcher" />
        </label>
        <fieldset>
          <legend>What kind of game?</legend>
          <div className="card-choices">
            {GAME_TYPES.map((t) => (
              <label key={t.id} className="card-choice">
                <input type="radio" name="gameType" value={t.id} checked={a.gameType === t.id} onChange={() => set("gameType", t.id)} />
                <span className="cc-icon">{t.icon}</span>
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          What is the game about, and what is the goal?
          <textarea
            name="description"
            value={a.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={800}
            rows={4}
            placeholder="A rocket travels from planet to planet. On each planet the child answers a question to get fuel. The goal is to reach the Moon Base."
          />
          <small className="hint">{a.description.length}/800</small>
        </label>
      </section>

      {/* 2. What it teaches */}
      <section className="wizard-card" hidden={step !== 1} data-step="2">
        <h2>2. What it teaches</h2>
        <fieldset>
          <legend>Subject</legend>
          <div className="choice-row">
            {SUBJECTS.map((s) => (
              <label key={s.id} className="choice">
                <input type="radio" name="subject" value={s.id} checked={a.subject === s.id} onChange={() => set("subject", s.id)} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>For</legend>
          <div className="choice-row">
            {YEARS.map((y) => (
              <label key={y.id} className="choice">
                <input type="radio" name="year" value={y.id} checked={a.year === y.id} onChange={() => set("year", y.id)} />
                {y.label}
              </label>
            ))}
          </div>
        </fieldset>
        {a.subject && a.subject !== "other" && a.year && (
          <fieldset>
            <legend>Topics (up to 6)</legend>
            <div className="topic-list">
              {available.map((t) => (
                <label key={t.id} className="check">
                  <input
                    type="checkbox"
                    name="topics"
                    value={t.id}
                    checked={chosenTopics.includes(t.id)}
                    onChange={() => set("topics", a.topics.includes(t.id) ? a.topics.filter((x) => x !== t.id) : [...a.topics, t.id].slice(0, 6))}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="field">
          {a.subject === "other" ? "What does the game teach?" : "Other topics, in your words (optional)"}
          <input name="otherTopics" value={a.otherTopics} onChange={(e) => set("otherTopics", e.target.value)} maxLength={200} placeholder={a.subject === "other" ? "The planets of the solar system" : "Number bonds to 100"} />
        </label>
        <fieldset>
          <legend>How children answer</legend>
          <div className="choice-row">
            {STYLES.map((s) => (
              <label key={s.id} className="choice">
                <input type="radio" name="questionStyle" value={s.id} checked={a.questionStyle === s.id} onChange={() => set("questionStyle", s.id)} />
                {s.label} <small className="hint">({s.hint})</small>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 3. World and characters */}
      <section className="wizard-card" hidden={step !== 2} data-step="3">
        <h2>3. World and characters</h2>
        <fieldset>
          <legend>Where does it happen?</legend>
          <div className="card-choices small">
            {SETTINGS.map((s) => (
              <label key={s.id} className="card-choice">
                <input type="radio" name="setting" value={s.id} checked={a.setting === s.id} onChange={() => set("setting", s.id)} />
                <span className="cc-icon">{s.icon}</span>
                <b>{s.label}</b>
              </label>
            ))}
          </div>
        </fieldset>
        {a.setting === "other" && (
          <label className="field">
            Describe the place
            <input name="settingOther" value={a.settingOther} onChange={(e) => set("settingOther", e.target.value)} maxLength={120} placeholder="A candy factory in the clouds" />
          </label>
        )}
        <label className="field">
          The main character (optional)
          <input name="hero" value={a.hero} onChange={(e) => set("hero", e.target.value)} maxLength={160} placeholder="A brave little robot called Bolt" />
        </label>
        <label className="field">
          Friends, helpers or opponents (optional)
          <input name="others" value={a.others} onChange={(e) => set("others", e.target.value)} maxLength={200} placeholder="A sleepy owl who gives hints; a cheeky monkey who steals bananas" />
        </label>
        <p className="hint">Characters must be made up: no characters from films, books, games or real people.</p>
        <fieldset>
          <legend>Look and mood</legend>
          <div className="choice-row">
            {MOODS.map((m) => (
              <label key={m.id} className="choice">
                <input type="radio" name="mood" value={m.id} checked={a.mood === m.id} onChange={() => set("mood", m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 4. How it plays */}
      <section className="wizard-card" hidden={step !== 3} data-step="4">
        <h2>4. How it plays</h2>
        <fieldset>
          <legend>How do you win?</legend>
          <div className="choice-row">
            {WIN.map((w) => (
              <label key={w.id} className="choice">
                <input type="radio" name="winBy" value={w.id} checked={a.winBy === w.id} onChange={() => set("winBy", w.id)} />
                {w.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>How many levels? (each a little harder)</legend>
          <div className="choice-row">
            {["3", "4", "5", "6"].map((n) => (
              <label key={n} className="choice">
                <input type="radio" name="levels" value={n} checked={a.levels === n} onChange={() => set("levels", n)} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>How long is a play?</legend>
          <div className="choice-row">
            {["5", "7", "10"].map((n) => (
              <label key={n} className="choice">
                <input type="radio" name="minutes" value={n} checked={a.minutes === n} onChange={() => set("minutes", n)} />
                About {n} minutes
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Rewards</legend>
          <div className="choice-row">
            {REWARDS.map((r) => (
              <label key={r.id} className="choice">
                <input type="radio" name="reward" value={r.id} checked={a.reward === r.id} onChange={() => set("reward", r.id)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 5. Check and create */}
      <section className="wizard-card" hidden={step !== 4} data-step="5">
        <h2>5. Check and create</h2>
        <dl className="summary-list" data-testid="wizard-summary">
          <div><dt>Name</dt><dd>{a.title}</dd></div>
          <div><dt>Kind of game</dt><dd>{labelOf(GAME_TYPES, a.gameType)}</dd></div>
          <div><dt>About</dt><dd>{a.description}</dd></div>
          <div><dt>Teaches</dt><dd>{labelOf(SUBJECTS, a.subject)} · {labelOf(YEARS, a.year)}{chosenTopics.length ? ` · ${chosenTopics.map((id) => topics.find((t) => t.id === id)?.label).join(", ")}` : ""}{a.otherTopics ? ` · ${a.otherTopics}` : ""}</dd></div>
          <div><dt>Answers</dt><dd>{labelOf(STYLES, a.questionStyle)}</dd></div>
          <div><dt>Where</dt><dd>{a.setting === "other" ? a.settingOther : labelOf(SETTINGS, a.setting)}</dd></div>
          <div><dt>Characters</dt><dd>{[a.hero, a.others].filter(Boolean).join("; ") || "The AI will invent them"}</dd></div>
          <div><dt>Mood</dt><dd>{labelOf(MOODS, a.mood)}</dd></div>
          <div><dt>Playing</dt><dd>{labelOf(WIN, a.winBy)} · {a.levels} levels · about {a.minutes} minutes · {labelOf(REWARDS, a.reward)}</dd></div>
        </dl>
        <label className="field">
          Anything else? (optional)
          <textarea name="extra" value={a.extra} onChange={(e) => set("extra", e.target.value)} maxLength={500} rows={3} placeholder="Add a little dance when the answer is right" />
        </label>
        <div className="rules-box">
          <strong>Before you create</strong>
          <ul>
            <li>No real teams, brands or characters that belong to someone else.</li>
            <li>No personal data of children: no real names, photos or schools.</li>
            <li>Nothing violent, scary or unsuitable for 6 to 9 year olds.</li>
          </ul>
          <label className="check">
            <input type="checkbox" name="rules" required />
            <span>My game follows these rules.</span>
          </label>
        </div>
        <p className="hint">The AI takes one to three minutes to build the game. You can change it afterwards as many times as you like.</p>
      </section>

      {(hint || state?.error) && (
        <p className="form-error" role="alert">
          {hint ?? state?.error}
        </p>
      )}

      <div className="wizard-nav">
        {step > 0 && (
          <button type="button" className="btn btn-light" onClick={back}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn" onClick={next}>
            Next →
          </button>
        ) : (
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Starting…" : "✨ Create my game"}
          </button>
        )}
      </div>
    </form>
  );
}
