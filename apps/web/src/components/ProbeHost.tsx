"use client";

import { isFromGameFrame } from "@zukka/game-protocol";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

type ProbeResult = { test: string; blocked: boolean; detail: string; kind: string };

/** Runs a sandbox probe game and lists what the browser blocked. Only for checking the isolation. */
export function ProbeHost({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [loads, setLoads] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const attachFrame = useCallback((el: HTMLIFrameElement | null) => {
    if (!el) return;
    frameRef.current = el;
    const onMessage = (ev: MessageEvent) => {
      if (!isFromGameFrame(ev, frameRef.current?.contentWindow)) return;
      const d = ev.data as { protocol?: string; results?: ProbeResult[]; navigating?: boolean };
      if (d?.protocol !== "zukka-probe/1") return;
      if (Array.isArray(d.results)) setResults(d.results.slice(0, 100));
      if (d.navigating) setNavigating(true);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      frameRef.current = null;
    };
  }, []);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const failures = results?.filter((r) => r.kind === "NOT BLOCKED") ?? [];
  return (
    <div className="probe">
      {isClient && (
      <iframe
        ref={attachFrame}
        src={src}
        title={title}
        sandbox="allow-scripts"
        allow=""
        referrerPolicy="no-referrer"
        onLoad={() => setLoads((n) => n + 1)}
        data-testid="probe-frame"
      />
      )}
      <p data-testid="probe-loads">
        Frame loads: {loads}
        {navigating ? " · the probe tried to navigate its frame to example.com" : ""}
      </p>
      {results && (
        <>
          <p data-testid="probe-verdict" className={failures.length ? "bad" : "ok"}>
            {failures.length ? `${failures.length} attempts were NOT blocked` : "Everything the probe tried was blocked."}
          </p>
          <table className="probe-table" data-testid="probe-results">
            <tbody>
              {results.map((r) => (
                <tr key={r.test} data-kind={r.kind}>
                  <td>{r.kind === "limitation" ? "ℹ️" : r.kind === "info" ? "•" : r.blocked ? "✅" : "❌"}</td>
                  <td>{r.test}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
