import type { Metadata } from "next";
import { ProbeHost } from "@/components/ProbeHost";
import { gameUrl, playOrigin } from "@/lib/origins";

export const metadata: Metadata = { title: "Sandbox check" };

export default function SandboxCheck() {
  return (
    <main className="page">
      <h1>Sandbox check</h1>
      <p>
        These two test games run exactly like a real game: in an iframe with <code>sandbox=&quot;allow-scripts&quot;</code>,
        served by <code>{playOrigin()}</code>. They try to do what a game must never do. Every line should be ✅.
      </p>
      <h2>1. Network, storage, popups, forms</h2>
      <ProbeHost src={gameUrl("sandbox-probe")} title="Sandbox probe" />
      <h2>2. Leaving the game</h2>
      <p>
        This one tries to send its own frame to example.com. The frame must never show example.com. Because the browser
        blocks the navigation, the frame shows the browser&apos;s own error page instead, so the frame-load count becomes 2:
        that second load is the error page, and it is expected.
      </p>
      <ProbeHost src={gameUrl("sandbox-probe-navigate")} title="Sandbox probe: navigation" />
      <h2>Check it yourself</h2>
      <ol className="steps">
        <li>Open the browser DevTools, Network tab, and reload this page: no request may go to example.com.</li>
        <li>In the Console you will see the Content Security Policy errors: they are the blocks working.</li>
        <li>
          Open <a href={gameUrl("school-cup")}>a game URL directly</a>: the response headers include{" "}
          <code>Content-Security-Policy</code> with <code>connect-src &apos;none&apos;</code> and <code>sandbox allow-scripts</code>.
        </li>
      </ol>
    </main>
  );
}
