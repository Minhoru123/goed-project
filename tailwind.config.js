/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        utah: {
          // Core dark palette
          navy: '#002244',
          gold: '#D4AF37',
          dark: '#0F172A',     // page background
          slate: '#1E293B',    // card / sidebar background
          hiring: '#10B981',

          // Legacy keys remapped for the dark theme so existing class names
          // (utah-cream, utah-stone, utah-sand, utah-red, utah-sky) keep
          // working without a global rename.
          cream: '#0F172A',    // page bg
          slate2: '#1E293B',
          stone: '#E2E8F0',    // light body text on dark
          sand: '#1E293B',     // muted card bg
          red: '#D4AF37',      // gold accent (legacy alias)
          sky: '#60A5FA',      // sky-blue links on dark
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
