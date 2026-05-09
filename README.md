# Utah Startup State

Hackathon platform for the Utah Governor's Office of Economic Development. Two pages of one app:

1. **Founder's Navigator** (`/navigator`) — AI quiz that matches founders to state resources.
2. **Utah Startup Map** (`/map`) — Leaflet map of Utah's startup ecosystem (stub for now).

## Quick start

```bash
npm install
cp .env.example .env   # then edit .env and add your real keys
npm run dev            # http://localhost:5173 — Vite + local /api handlers in one process
```

A small Vite plugin in `vite.config.ts` runs the local `api/*.ts` handlers in-process during dev, so the frontend and server-side AI endpoints stay on the same origin.

Set `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in your deployment environment.

## Supabase

The live company directory uses Supabase for:

- magic-link sign-in
- public company records
- company ownership memberships
- self-service company creation
- self-service profile updates

Apply the SQL in [supabase/schema.sql](./supabase/schema.sql), then seed the current company catalog:

```bash
npm run seed:companies
```

After that, `/map`, `/companies/:id`, and `/add-company` read and write live company data from Supabase. If Supabase is unavailable, the app falls back to the checked-in `companies.json`.

## Data

There are now two runtime data paths:

1. `Companies` -> Supabase live table
2. `Resources` -> live Google Sheet feed with `public/data/resources.json` as fallback

**Resources fallback / local export.** Edit the `.xlsx` files in `src/data/`, then:
```bash
npm run data
```

**Live resources feed ("updatable without a developer").**
1. In Google Sheets: **File → Share → Publish to web → CSV**.
2. Copy the URL into `.env`:
   ```
   RESOURCES_URL=https://docs.google.com/.../pub?output=csv
   ```
3. The app and `/api/claude` will read the live resource feed at runtime. No redeploy is required for resource edits.

`COMPANIES_URL` is still supported by the ETL as a seed/import source, but live company profiles now come from Supabase.

Schemas: see `Resource` and `Company` in `src/types.ts`. Geocoding results are cached in `scripts/.geocache.json` so re-runs are fast.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check + build
- `npm run typecheck` — types only
- `npm run preview` — preview built output
- `npm run seed:companies` — seed `public/data/companies.json` into Supabase

## Stack

React 18 · TypeScript · Vite · Tailwind · React Router · React-Leaflet · Anthropic SDK · Supabase.
