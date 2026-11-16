"use client";

import { useState } from "react";
import { AVATARS } from "@/lib/avatars";
import { ADJECTIVES, ANIMALS, NICKNAME_NUMBER_MAX, NICKNAME_NUMBER_MIN, nicknameText, randomNickname, type NicknameParts } from "@/lib/nicknames";
import { SCHOOL_YEARS } from "@/lib/school-years";

/**
 * The fields of a child profile. The nickname is chosen from lists (never typed),
 * the avatar from the gallery, and the leaderboard choice has no default.
 */
export function PlayerFields({
  startNickname,
  initial,
}: {
  /** chosen on the server, so the first render matches */
  startNickname: NicknameParts;
  initial?: { avatar: string; schoolYear: string; showOnLeaderboards: boolean };
}) {
  const [nick, setNick] = useState<NicknameParts>(startNickname);
  const numbers = Array.from({ length: NICKNAME_NUMBER_MAX - NICKNAME_NUMBER_MIN + 1 }, (_, i) => i + NICKNAME_NUMBER_MIN);
  return (
    <>
      <fieldset>
        <legend>Nickname</legend>
        <p className="hint">Built from words in our lists, so it can never be a real name.</p>
        <div className="nick-preview" data-testid="nickname-preview">
          {nicknameText(nick)}
        </div>
        <div className="nick-pickers">
          <select name="adjective" aria-label="Word" value={nick.adjective} onChange={(e) => setNick({ ...nick, adjective: e.target.value as NicknameParts["adjective"] })}>
            {ADJECTIVES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select name="animal" aria-label="Animal" value={nick.animal} onChange={(e) => setNick({ ...nick, animal: e.target.value as NicknameParts["animal"] })}>
            {ANIMALS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select name="number" aria-label="Number" value={nick.number} onChange={(e) => setNick({ ...nick, number: Number(e.target.value) })}>
            {numbers.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <button type="button" className="btn btn-light" onClick={() => setNick(randomNickname())}>
            🎲 Shuffle
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Avatar</legend>
        <div className="avatar-grid">
          {AVATARS.map((a, i) => (
            <label key={a.id} className="avatar-option" style={{ background: a.bg }}>
              <input type="radio" name="avatar" value={a.id} defaultChecked={initial ? initial.avatar === a.id : i === 0} required />
              <span aria-hidden="true">{a.emoji}</span>
              <span className="sr-only">{a.id}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>School year</legend>
        <div className="choice-row">
          {SCHOOL_YEARS.map((y) => (
            <label key={y.id} className="choice">
              <input type="radio" name="schoolYear" value={y.id} defaultChecked={initial?.schoolYear === y.id} required />
              {y.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Public leaderboards</legend>
        <p className="hint">
          If you say yes, only the nickname and avatar appear on the public leaderboards. Nobody sees anything else.
        </p>
        <div className="choice-row">
          <label className="choice">
            <input type="radio" name="leaderboard" value="yes" defaultChecked={initial?.showOnLeaderboards === true} required />
            Yes, show this profile
          </label>
          <label className="choice">
            <input type="radio" name="leaderboard" value="no" defaultChecked={initial?.showOnLeaderboards === false} required />
            No, keep it private
          </label>
        </div>
      </fieldset>
    </>
  );
}
