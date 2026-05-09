import { UTAH_COLORS, type SectorKey } from './utahColors';

// Fallback palette for sectors that don't match a known brand color.
const FALLBACK_PALETTE = [
  '#10B981', // emerald (also HIRING_GREEN — fine for non-hiring use too)
  '#0E7490', // teal
  '#9F1239', // rose
  '#B7791F', // amber-dark
  '#1F2937', // slate
];

const cache = new Map<string, string>();

// Map a free-form sector string to a known brand sector key, if any.
function resolveBrandSector(raw: string): SectorKey | null {
  const s = raw.toLowerCase();
  if (/(^|[^a-z])ai([^a-z]|$)|artificial intelligence|machine learning|llm/.test(s)) return 'AI';
  if (/aerospace|defense|aviation|space/.test(s)) return 'AEROSPACE';
  if (/fintech|financial services|banking|insurance/.test(s)) return 'FINTECH';
  if (/saas|b2b software|software and information|consumer software|cloud/.test(s)) return 'SAAS';
  if (/life sciences|biotech|health|medical|pharma|medtech/.test(s)) return 'LIFE_SCIENCES';
  return null;
}

export function colorFor(sector: string | null): string {
  const key = (sector || 'unknown').toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const brand = sector ? resolveBrandSector(sector) : null;
  if (brand) {
    const color = UTAH_COLORS.SECTOR_COLORS[brand];
    cache.set(key, color);
    return color;
  }

  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const fallback = FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
  cache.set(key, fallback);
  return fallback;
}

// Re-export for components that want the constants directly (legend, badges).
export { UTAH_COLORS };
