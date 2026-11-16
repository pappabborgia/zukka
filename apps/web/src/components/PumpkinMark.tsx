/** Provisional Zukka mark: a stylised pumpkin with a winking face. */
export function PumpkinMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="#1f1645" strokeWidth="5" strokeLinejoin="round">
        <path d="M60 30 C58 20 62 12 70 8" fill="none" strokeLinecap="round" />
        <path d="M66 24 C74 12 92 12 100 16 C94 28 80 32 66 24 Z" fill="#4caf50" />
        <ellipse cx="38" cy="70" rx="28" ry="36" fill="#f08c00" />
        <ellipse cx="82" cy="70" rx="28" ry="36" fill="#f08c00" />
        <ellipse cx="60" cy="70" rx="30" ry="40" fill="#f7a531" />
      </g>
      <path d="M40 52 C36 60 36 72 40 82" stroke="#ffd08a" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".8" />
      <circle cx="50" cy="64" r="5" fill="#1f1645" />
      <path d="M66 64 Q72 58 78 64" stroke="#1f1645" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M50 78 Q64 94 78 78 Z" fill="#1f1645" />
      <path d="M57 85 Q64 90 71 85 Q64 82 57 85 Z" fill="#ff6b6b" />
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.8 }}>
      <PumpkinMark size={size} />
      <span className="logo-word">Zukka</span>
    </span>
  );
}
