import { byteSize, MAX_GAME_BYTES } from "./config-block";

/**
 * Static checks on a game's HTML, before it is saved (Studio) and again in the AI review (phase 5).
 * The browser sandbox blocks all of this anyway; these checks catch games that try, so they can be
 * fixed or refused, and give the reviewer a clear list.
 */
export type Severity = "blocking" | "important" | "minor";
export interface GameProblem {
  code: string;
  severity: Severity;
  message: string;
}

const FORBIDDEN: { code: string; re: RegExp; message: string }[] = [
  { code: "network_fetch", re: /\bfetch\s*\(/, message: "uses fetch() to reach the network" },
  { code: "network_xhr", re: /\bXMLHttpRequest\b/, message: "uses XMLHttpRequest to reach the network" },
  { code: "network_websocket", re: /\bWebSocket\s*\(/, message: "opens a WebSocket" },
  { code: "network_eventsource", re: /\bEventSource\s*\(/, message: "opens an EventSource" },
  { code: "network_beacon", re: /\bsendBeacon\s*\(/, message: "uses navigator.sendBeacon" },
  { code: "network_webrtc", re: /\b(RTCPeerConnection|webkitRTCPeerConnection|RTCDataChannel)\b/, message: "uses WebRTC" },
  { code: "dynamic_import", re: /\bimport\s*\(/, message: "loads code with import()" },
  { code: "eval", re: /\beval\s*\(|\bnew\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*["'`]/, message: "runs code from text (eval, new Function or a string timer)" },
  { code: "storage", re: /\b(localStorage|sessionStorage|indexedDB|caches\.open)\b|document\.cookie/, message: "uses browser storage or cookies" },
  { code: "popup", re: /\bwindow\.open\s*\(/, message: "opens a popup" },
  { code: "navigation", re: /\b(top|parent)\.location\b|\blocation\.(href|assign|replace)\b\s*=?|\blocation\s*=\s*["'`]/, message: "tries to navigate away" },
  { code: "parent_access", re: /\bparent\.document\b|\btop\.document\b|\bwindow\.opener\b/, message: "tries to reach the page around the game" },
  { code: "workers", re: /\bnew\s+(Shared)?Worker\s*\(|\bserviceWorker\b/, message: "starts a worker" },
  { code: "device_access", re: /\bgetUserMedia\b|\bgeolocation\b|\bmediaDevices\b|\bSpeechRecognition\b|\bwebkitSpeechRecognition\b/, message: "asks for the camera, microphone or location" },
  { code: "form", re: /<form\b/i, message: "contains a form" },
  { code: "external_link", re: /<a\b[^>]*\bhref\s*=\s*["']?\s*(https?:|\/\/|mailto:|tel:)/i, message: "contains a link to outside the game" },
  { code: "external_resource", re: /\b(src|href|action|poster|data)\s*=\s*["']?\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\/|@import\b/i, message: "loads something from the internet" },
  { code: "web_address", re: /["'`]\s*(https?:)?\/\/(?!www\.w3\.org\/)[a-z0-9.-]+\.[a-z]{2,}/i, message: "contains a web address" },
  { code: "base_tag", re: /<base\b/i, message: "uses a <base> tag" },
  { code: "iframe", re: /<(iframe|object|embed|frame)\b/i, message: "embeds another page" },
];

export function checkGameHtml(html: string): GameProblem[] {
  const problems: GameProblem[] = [];
  const bytes = byteSize(html);
  if (bytes > MAX_GAME_BYTES)
    problems.push({ code: "too_large", severity: "blocking", message: `is ${Math.round(bytes / 1024)} KB, the limit is ${MAX_GAME_BYTES / 1024} KB` });
  if (!/^\s*<!doctype html>/i.test(html) || !/<\/html>\s*$/i.test(html))
    problems.push({ code: "not_a_document", severity: "blocking", message: "is not a complete HTML document" });
  for (const f of FORBIDDEN) if (f.re.test(html)) problems.push({ code: f.code, severity: "blocking", message: f.message });

  // the three Zukka events
  if (!/protocol\s*:\s*["']zukka\/1["']/.test(html))
    problems.push({ code: "no_events", severity: "blocking", message: "does not send the Zukka events" });
  for (const ev of ["game_started", "answer", "game_completed"])
    if (!new RegExp(`["']${ev}["']`).test(html))
      problems.push({ code: `missing_${ev}`, severity: "blocking", message: `never sends the ${ev} event` });

  // voices: only local ones
  if (/speechSynthesis/.test(html) && !/localService/.test(html))
    problems.push({ code: "voice_not_local", severity: "important", message: "uses a voice without checking it runs on the device (localService)" });

  // hidden or unreadable code
  // (the CONFIG block of an engine and embedded fonts are long lines by design)
  const longestLine = Math.max(...html.split("\n").map((l) => (/base64,|ZUKKA_CONFIG/.test(l) ? 0 : l.length)));
  if (longestLine > 5000) problems.push({ code: "minified", severity: "important", message: "has very long lines (minified or hidden code)" });
  if (/\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){20,}|atob\s*\(/i.test(html))
    problems.push({ code: "obfuscated", severity: "important", message: "contains encoded or obfuscated code" });

  return problems;
}

export const hasBlocking = (problems: GameProblem[]) => problems.some((p) => p.severity === "blocking");
