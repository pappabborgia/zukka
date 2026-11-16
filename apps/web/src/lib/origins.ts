/** Origin that serves the games (a different site from the main one). */
export function playOrigin(): string {
  const v = process.env.NEXT_PUBLIC_PLAY_ORIGIN ?? "http://127.0.0.1:3001";
  return v.replace(/\/$/, "");
}

export function gameUrl(id: string): string {
  return `${playOrigin()}/g/${encodeURIComponent(id)}`;
}

/** A saved version of a created game (immutable, cached for a long time). */
export function versionUrl(gameId: string, versionId: string): string {
  return `${playOrigin()}/v/${encodeURIComponent(gameId)}/${encodeURIComponent(versionId)}`;
}
