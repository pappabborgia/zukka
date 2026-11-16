import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <main className="page">
      <h1>{t("play.notFound")}</h1>
      <Link href="/">← {t("play.back")}</Link>
    </main>
  );
}
