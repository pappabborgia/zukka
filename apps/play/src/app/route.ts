export function GET() {
  return new Response("Zukka games are played on the Zukka website.", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" },
  });
}
