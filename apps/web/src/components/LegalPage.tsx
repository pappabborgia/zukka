import type { ReactNode } from "react";
import { POLICY_VERSION } from "@/lib/policies";
import { SiteHeader } from "./SiteHeader";

/** Wrapper for the draft legal texts. Every [LEGAL] note marks a point a lawyer must decide. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="page narrow legal">
        <p className="draft-banner">
          DRAFT ({POLICY_VERSION}). This text is provisional and will be reviewed by a lawyer before the public launch.
        </p>
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}

export function LegalNote({ children }: { children: ReactNode }) {
  return <p className="legal-note">[LEGAL] {children}</p>;
}
