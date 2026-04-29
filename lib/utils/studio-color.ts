// Pure visual helper: deterministic per-academy color/tag for ticket card
// decoration. No DB column dependency. Pure function — no behavior change.

const PALETTE = [
  { bg: '#171717', ink: '#ffffff' }, // mono dark
  { bg: '#dc2626', ink: '#ffffff' }, // rose
  { bg: '#16a34a', ink: '#ffffff' }, // emerald
  { bg: '#2563eb', ink: '#ffffff' }, // blue
  { bg: '#d97706', ink: '#ffffff' }, // amber
  { bg: '#7c3aed', ink: '#ffffff' }, // violet
  { bg: '#0891b2', ink: '#ffffff' }, // cyan
  { bg: '#db2777', ink: '#ffffff' }, // pink
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getStudioPalette(academyId: string | null | undefined): { bg: string; ink: string } {
  if (!academyId) return PALETTE[0];
  return PALETTE[hashString(academyId) % PALETTE.length];
}

export function getStudioTag(name: string | null | undefined): string {
  if (!name) return '·';
  const trimmed = name.trim();
  if (!trimmed) return '·';
  const first = trimmed[0];
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}
