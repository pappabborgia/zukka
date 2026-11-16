import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <Link href="/privacy">Privacy</Link>
      <Link href="/parental-consent">Parental consent</Link>
      <Link href="/community-rules">Community rules</Link>
    </footer>
  );
}
