import Link from "next/link";
import { Logo } from "@/components/PumpkinMark";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BUILTIN_CATALOG } from "@/generated/builtin-catalog";
import { t, type Locale } from "@/i18n";
import type { MessageKey } from "@/i18n/en";

const subjectLabel = (s: string, locale: Locale = "en") =>
  t((`subject.${s}` as MessageKey), {}, locale);

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const games = BUILTIN_CATALOG.filter((g) => g.listed);
  const deleted = (await searchParams).deleted === "1";
  return (
    <>
    <SiteHeader />
    <main className="page">
      {deleted && (
        <p className="form-ok" role="status">
          Your account and all its data have been deleted.
        </p>
      )}
      <div className="hero">
        <Logo size={64} />
        <p>{t("site.tagline")}</p>
        <span className="badge">{t("site.preview")}</span>
      </div>
      <h2>{t("home.title")}</h2>
      <div className="grid">
        {games.map((g) => (
          <Link key={g.id} href={`/play/${g.id}`} className="card">
            <h3>{g.title}</h3>
            <p>{g.description}</p>
            <div className="tags">
              {g.subjects.map((s) => (
                <span key={s} className="tag">
                  {subjectLabel(s)}
                </span>
              ))}
              {g.years.length > 0 && <span className="tag">{t("home.years", { years: g.years.join(", ") })}</span>}
            </div>
            <span className="cta">{t("home.play")}</span>
          </Link>
        ))}
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
