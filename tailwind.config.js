/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        utah: {
          // New investor-grade palette (preferred names)
          navy: '#002244',
          gold: '#D4AF37',
          dark: '#0F172A',     // page background
          slate: '#1E293B',    // card / sidebar background
          hiring: '#10B981',

          // Legacy keys remapped to the dark theme so existing class names
          // (utah-cream, utah-stone, utah-sand, utah-red, utah-sky) keep
          // working without a global rename.
          cream: '#0F172A',    // was light bg → now dark bg
          slate2: '#1E293B',
          stone: '#E2E8F0',    // was dark text → now light text on dark
          sand: '#1E293B',     // was warm muted bg → now slate muted bg
          red: '#D4AF37',      // was red accent → now gold accent
          sky: '#60A5FA',      // was deep blue → now lighter sky-blue (readable links on dark)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
