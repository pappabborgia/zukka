"use client";

import { isFromGameFrame, PlaySession, type CompletedPlay } from "@zukka/game-protocol";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";

type LogLine = { at: number; text: string; ok: boolean };

const noopSubscribe = () => () => {};

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Hosts one game in a sandboxed iframe from the games origin.
 * The game can only send the three Zukka events; the page checks where every
 * message comes from, validates it, measures the time itself and ignores anything else.
 */
export function GameHost({ src, title, debug = false }: { src: string; title: string; debug?: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const sessionRef = useRef(new PlaySession());
  const loadsRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState<CompletedPlay | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);

  /**
   * The listener is attached in the iframe's ref callback, in the same task that inserts
   * the iframe, so it is in place before the game can run any script.
   */
  const attachFrame = useCallback((el: HTMLIFrameElement | null) => {
    if (!el) return;
    frameRef.current = el;
    const session = sessionRef.current;
    const add = (text: string, ok: boolean) => setLog((l) => [...l.slice(-199), { at: Date.now(), text, ok }]);
    const onMessage = (ev: MessageEvent) => {
      if (!isFromGameFrame(ev, frameRef.current?.contentWindow)) return; // not our game: ignore silently
      const r = session.handle(ev.data);
      if (!r.accepted) {
        add(`ignored (${r.reason})`, false);
        return;
      }
      const e = r.event;
      if (e.event === "game_started") {
        setSummary(null);
        add(r.abandoned ? "game_started (previous play left unfinished)" : "game_started", true);
      } else if (e.event === "answer") {
        add(`answer: ${e.correct ? "correct" : "wrong"}`, true);
      } else {
        add(`game_completed: ${e.correct}/${e.total}`, true);
        if (r.completed) {
          setSummary(r.completed);
          if (r.completed.flags.length) add(`flags: ${r.completed.flags.join(", ")}`, false);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      frameRef.current = null;
    };
  }, []);
  // render the iframe on the client only, never in the server HTML
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const onLoad = () => {
    loadsRef.current++;
    setLoaded(true);
    if (loadsRef.current > 1 && sessionRef.current.reset()) {
      setLog((l) => [...l, { at: Date.now(), text: "the game reloaded: unfinished play dropped", ok: false }]);
    }
  };

  return (
    <div className="host">
      {summary && (
        <div className="summary" data-testid="play-summary" role="status">
          <strong>{t("play.summary.title")}</strong>
          <span>{t("play.summary.correct", { correct: summary.correct, total: summary.total })}</span>
          <span>{t("play.summary.time", { time: formatTime(summary.durationMs) })}</span>
          <small>{t("play.summary.points")}</small>
          <button type="button" onClick={() => setSummary(null)} aria-label="Close">
            ✕
          </button>
        </div>
      )}
      <div className="frame-wrap">
        {!loaded && <div className="frame-loading">{t("play.loading")}</div>}
        {isClient && (
        <iframe
          ref={attachFrame}
          src={src}
          title={title}
          sandbox="allow-scripts"
          allow=""
          referrerPolicy="no-referrer"
          loading="eager"
          onLoad={onLoad}
          data-testid="game-frame"
        />
        )}
      </div>
      {debug && (
        <details className="debug" open>
          <summary>{t("play.debug.title")}</summary>
          <ol data-testid="host-events">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? "ok" : "bad"}>
                {l.text}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
