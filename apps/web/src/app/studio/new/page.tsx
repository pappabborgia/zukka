import type { Metadata } from "next";
import Link from "next/link";
import { ENGINES } from "@zukka/engines";
import { SiteHeader } from "@/components/SiteHeader";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { requireParent } from "@/lib/server/guards";

export const metadata: Metadata = { title: "New game" };

export default async function NewGamePage() {
  await requireParent("/studio/new");
  const templates = Object.values(ENGINES).filter((e) => e.quick);
  const catalogue = BUILTIN_CATALOG.filter((g) => g.listed);
  return (
    <>
      <SiteHeader title="Studio" />
      <main className="page">
        <p>
          <Link href="/studio">← Your games</Link>
        </p>
        <h1>Make a new game</h1>

        <h2>1. Start from a template</h2>
        <p>Pick a game engine, then choose names, colours, subject and topics. It takes a minute.</p>
        <div className="grid">
          {templates.map((e) => (
            <Link key={e.id} href={`/studio/new/${e.id}`} className="card" data-testid="template-card">
              <h3>{e.name}</h3>
              <p>{e.description}</p>
              <span className="cta">Use this template</span>
            </Link>
          ))}
        </div>

        <h2>2. Describe a brand new game</h2>
        <div className="card muted-card">
          <h3>Coming next</h3>
          <p>Describe any game in your own words and the AI builds it. This arrives in the next update of the Studio.</p>
        </div>

        <h2>3. Make your own version of a game</h2>
        <p>Start from a game in the catalogue. The original never changes: you get a new game of your own.</p>
        <div className="grid">
          {catalogue.map((g) => {
            const quick = g.engine && ENGINES[g.engine]?.quick;
            return quick ? (
              <Link key={g.id} href={`/studio/new/${g.engine}?from=${g.id}`} className="card" data-testid="remix-card">
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <span className="cta">Make your own version</span>
              </Link>
            ) : (
              <div key={g.id} className="card muted-card">
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <small className="hint">Its own version will be possible with &quot;Describe a brand new game&quot;, in the next update.</small>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
