import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fredoka";
import "@fontsource/lilita-one";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zukka", template: "%s · Zukka" },
  description: "Learning games for 6 to 9 year olds, made by parents.",
  robots: { index: false, follow: false }, // preview: keep out of search engines until launch
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7a531" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
