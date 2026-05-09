# Utah Startup State

Hackathon platform for the Utah Governor's Office of Economic Development. Two pages of one app:

1. **Founder's Navigator** (`/navigator`) — AI quiz that matches founders to state resources.
2. **Utah Startup Map** (`/map`) — Leaflet map of Utah's startup ecosystem (stub for now).

## Quick start

```bash
npm install
cp .env.example .env   # then edit .env and add your real keys
npm run dev            # http://localhost:5173 — Vite + /api/claude in one process
```

A small Vite plugin in `vite.config.ts` runs the Netlify function code in-process during dev, so no Netlify CLI is required. The same function file (`netlify/functions/claude.ts`) runs on Netlify in production.

For Netlify deploys, set `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in **Site settings → Environment variables**.

## Supabase

The lightweight company-auth flow uses Supabase for:

- magic-link sign-in
- company claim requests
- company update requests
- new listing submissions

Apply the SQL in [supabase/schema.sql](./supabase/schema.sql) to your Supabase project before testing the add/claim/update flows.

## Data

Two ingestion paths — both write to `public/data/{resources,companies}.json`.

**Path A — local Excel (default).** Edit the `.xlsx` files in `src/data/`, then:
```bash
npm run data
```

**Path B — Google Sheets ("updatable without a developer").**
1. In Google Sheets: **File → Share → Publish to web → CSV**.
2. Copy the URL into `.env`:
   ```
   RESOURCES_URL=https://docs.google.com/.../pub?output=csv
   COMPANIES_URL=https://docs.google.com/.../pub?output=csv
   ```
3. Run `npm run data`.

For zero-touch updates in production: wire a Sheets-triggered Netlify build hook so a sheet edit rebuilds the site in ~30s with no code changes.

Schemas: see `Resource` and `Company` in `src/types.ts`. Geocoding results are cached in `scripts/.geocache.json` so re-runs are fast.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check + build
- `npm run typecheck` — types only
- `npm run preview` — preview built output

## Stack

React 18 · TypeScript · Vite · Tailwind · React Router · React-Leaflet · Anthropic SDK · Netlify Functions.
