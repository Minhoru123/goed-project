// Inline SVG paths (Lucide icon set) used for map markers and badges.
// Keeping the SVG strings inline lets us embed them in Leaflet divIcons
// without React-rendering each marker.

import {
  Cpu,
  Rocket,
  DollarSign,
  Cloud,
  FlaskConical,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import type { SectorKey } from './utahColors';

export const SECTOR_ICONS: Record<SectorKey, LucideIcon> = {
  AI: Cpu,
  AEROSPACE: Rocket,
  FINTECH: DollarSign,
  SAAS: Cloud,
  LIFE_SCIENCES: FlaskConical,
};

export const FALLBACK_ICON: LucideIcon = Building2;

// Map a free-form sector string from the data to a known SectorKey, or null.
// Mirrors the heuristic in sectorColor.ts so colors and icons stay consistent.
export function resolveBrandSector(raw: string | null): SectorKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/(^|[^a-z])ai([^a-z]|$)|artificial intelligence|machine learning|llm/.test(s)) return 'AI';
  if (/aerospace|defense|aviation|space/.test(s)) return 'AEROSPACE';
  if (/fintech|financial services|banking|insurance/.test(s)) return 'FINTECH';
  if (/saas|b2b software|software and information|consumer software|cloud/.test(s)) return 'SAAS';
  if (/life sciences|biotech|health|medical|pharma|medtech/.test(s)) return 'LIFE_SCIENCES';
  return null;
}

// Hand-rolled inline SVG paths for the Lucide icons we use, so we can embed
// them in Leaflet HTML markers without rendering React per pin.
// Source: Lucide v0.453 (MIT) — keep these in sync if we change icons.
export const SECTOR_ICON_PATHS: Record<SectorKey | 'DEFAULT', string> = {
  AI: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  AEROSPACE: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  FINTECH: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  SAAS: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  LIFE_SCIENCES: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  DEFAULT: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
};
