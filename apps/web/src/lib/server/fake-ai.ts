import "server-only";
import { GAME_SDK_SNIPPET } from "@zukka/game-protocol";

/**
 * A stand-in for the AI, used ONLY in local tests with the Firebase emulators and ZUKKA_FAKE_AI=1
 * (see ai-games.ts): no API call, no cost. It returns a tiny but complete game that follows the rules.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function fakeGame(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#fff8ee;color:#1f1645;text-align:center;margin:0;padding:24px}
  button{font-size:28px;padding:14px 24px;margin:8px;border-radius:14px;border:3px solid #1f1645;background:#ffd43b}
</style>
</head>
<body>
<h1 id="title">${esc(title)}</h1>
<p id="q">Press start!</p>
<div id="answers"><button id="start">Start</button></div>
<p id="score"></p>
<script>
${GAME_SDK_SNIPPET}
(function(){
  var asked = 0, right = 0, TOTAL = 5, a = 0, b = 0;
  var box = document.getElementById("answers"), q = document.getElementById("q");
  function next(){
    if (asked === TOTAL){ q.textContent = "Well done! " + right + " out of " + TOTAL; box.innerHTML = ""; Zukka.completed(right, TOTAL); return; }
    a = 2 + Math.floor(Math.random() * 8); b = 2 + Math.floor(Math.random() * 8);
    var ans = a + b, opts = [ans, ans + 1, ans - 1].sort(function(){ return Math.random() - .5; });
    q.textContent = a + " + " + b + " = ?";
    box.innerHTML = "";
    opts.forEach(function(v){
      var btn = document.createElement("button"); btn.textContent = v; btn.className = "opt";
      btn.onclick = function(){ asked++; var ok = v === ans; if (ok) right++; Zukka.answer(ok); next(); };
      box.appendChild(btn);
    });
  }
  document.getElementById("start").onclick = function(){ Zukka.started(); next(); };
})();
</script>
</body>
</html>`;
}

/** A "change": the title gets the request's first words, so tests can see a new version. */
export function fakeEdit(html: string, request: string): string {
  const words = request.split(/\s+/).slice(0, 4).join(" ");
  return html.replace(/<h1 id="title">([^<]*)<\/h1>/, (_m, t) => `<h1 id="title">${t} · ${esc(words)}</h1>`);
}
