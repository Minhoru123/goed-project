/**
 * Official Utah Startup Map Color Palette
 * Used for Mapbox layers and UI Components
 */
export const UTAH_COLORS = {
  NAVY: '#002244',
  GOLD: '#D4AF37',
  DARK_BG: '#0F172A',
  SLATE_CARD: '#1E293B',
  HIRING_GREEN: '#10B981',
  SECTOR_COLORS: {
    AI: '#6366F1',           // Indigo
    AEROSPACE: '#EF4444',    // Red
    FINTECH: '#F59E0B',      // Amber
    SAAS: '#3B82F6',         // Blue
    LIFE_SCIENCES: '#8B5CF6', // Violet
  },
} as const;

export type UtahColor = keyof typeof UTAH_COLORS;
export type SectorKey = keyof typeof UTAH_COLORS.SECTOR_COLORS;
