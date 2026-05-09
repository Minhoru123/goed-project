// ETL: Builder Day Excel -> normalized JSON for the app.
// Usage: npm run data
//
// Steps:
//   1. Read src/data/Resources List - Builder Day.xlsx -> public/data/resources.json
//   2. Read src/data/Map Data for Builder Day .xlsx -> public/data/companies.json
//   3. Geocode company addresses via Nominatim (cached in scripts/.geocache.json).
//
// "Updatable without dev" path: set RESOURCES_URL and/or COMPANIES_URL env
// vars to a published Google Sheet CSV URL. ETL fetches the CSV instead of
// reading the local .xlsx. The resource feed can now also be read live at
// runtime by the app's server handlers; companies.json is mainly a seed/fallback
// source once Supabase is live.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RESOURCES_PATH = join(ROOT, 'src/data/Resources List - Builder Day.xlsx');
const COMPANIES_PATH = join(ROOT, 'src/data/Map Data for Builder Day .xlsx');
const OUT_DIR = join(ROOT, 'public/data');
const CACHE_PATH = join(__dirname, '.geocache.json');

// ---------- helpers ----------

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const splitPipes = (s) =>
  String(s || '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

// Keep in sync with src/lib/journey.ts. Duplicated here so the ETL stays a
// plain Node script with no TS toolchain.
const STEP_KEYWORDS = {
  1: /\b(idea(tion)?|brainstorm|find your big idea|just an idea|early concept)\b/i,
  2: /\b(business skills?|fundamentals?|entrepreneurship 101|founder education|literacy)\b/i,
  3: /\b(validation|customer discovery|market research|product[-\s]?market fit|test the market)\b/i,
  4: /\b(build (your )?product|prototype|mvp|engineering|develop the product|software development|hardware)\b/i,
  5: /\b(brand(ing)?|marketing|website|seo|social media|advertising|public relations)\b/i,
  6: /\b(business plan|pitch deck|financial projections|executive summary)\b/i,
  7: /\b(registration|licensure|incorporate|llc|business license|trademark|patent|regulatory)\b/i,
  8: /\b(operations|payroll|hiring (your first|first employee)|insurance|hr|legal counsel|bookkeeping|accountant)\b/i,
  9: /\b(seed funding|pre[-\s]?seed|angel|small business loan|microloan|sba loan|grant|startup capital|raising your first|crowdfund(ing)?|sbir|sttr|non[-\s]?dilutive)\b/i,
  10: /\b(office space|coworking|incubator space|lab space|workspace|real estate)\b/i,
  11: /\b(tax(es|ation)?|sales tax|tax credit|tax incentive|file(d|ing) taxes)\b/i,
  12: /\b(community|networking|meetup|1 ?million ?cups|founder group|peer group|chamber of commerce)\b/i,
  13: /\b(series [a-c]|growth (capital|funding)|venture (capital|funding)|institutional capital|late[-\s]?stage)\b/i,
  14: /\b(strategic planning|scale|growth strategy|expansion strategy|operational efficiency)\b/i,
  15: /\b(workforce|talent|recruit(ing|ment)|hire engineers|talent acquisition|workforce services|apprentice)\b/i,
  16: /\b(government contracts?|federal contract|gsa|procurement|set[-\s]?aside|hubzone)\b/i,
  17: /\b(international trade|export(ing|er|s)?|world trade|foreign market|tariff)\b/i,
  18: /\b(relocate|move (your|the) business|expansion to utah|incentive to move)\b/i,
  19: /\b(close (your|the) business|exit|wind down|dissolve|sell (your|the) (business|company)|m&a)\b/i,
};

// Topics from the source sheet that have direct stage meaning.
const TOPIC_TO_STEPS = {
  'pre-seed': [3, 9],
  'seed': [9],
  'early stage': [3, 4, 9],
  'late stage growth': [13, 14],
  'growth stage': [13, 14],
  'mature': [14, 18],
  'exit': [19],
};

function mapJourneySteps(description, topics) {
  const text = `${description || ''} ${(topics || []).join(' ')}`;
  const matched = new Set();

  for (const [step, regex] of Object.entries(STEP_KEYWORDS)) {
    if (regex.test(text)) matched.add(Number(step));
  }
  for (const t of topics || []) {
    const key = String(t).toLowerCase();
    const steps = TOPIC_TO_STEPS[key];
    if (steps) for (const s of steps) matched.add(s);
  }

  return Array.from(matched).sort((a, b) => a - b);
}

const cleanString = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const normalizeText = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeAddress = (v) => normalizeText(v).replace(/[^a-z0-9]/g, '');

const getDomainFromUrl = (v) => {
  const s = cleanString(v);
  if (!s) return '';
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

const ensureUniqueId = (baseId, usedIds) => {
  const normalizedBase = cleanString(baseId) || 'company';
  if (!usedIds.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  let candidate = `${normalizedBase}-${suffix}`;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
  return candidate;
};

const buildCompanyDuplicateKeys = (company) => {
  const keys = [];
  const name = normalizeText(company.name);
  const address = normalizeAddress(company.address);
  const domain = getDomainFromUrl(company.website);
  if (name && address) keys.push(`${name}|address|${address}`);
  if (name && domain) keys.push(`${name}|domain|${domain}`);
  return keys;
};

const pickBetterString = (current, incoming) => {
  const currentText = cleanString(current) || '';
  const incomingText = cleanString(incoming) || '';
  if (!currentText) return incoming ?? null;
  if (!incomingText) return current;
  return incomingText.length > currentText.length ? incoming : current;
};

const pickBetterNumber = (current, incoming) => current ?? incoming ?? null;

const mergeCompanyRows = (current, incoming) => ({
  ...current,
  name: pickBetterString(current.name, incoming.name),
  linkedin: pickBetterString(current.linkedin, incoming.linkedin),
  address: pickBetterString(current.address, incoming.address) || '',
  city: pickBetterString(current.city, incoming.city),
  lat: pickBetterNumber(current.lat, incoming.lat),
  lng: pickBetterNumber(current.lng, incoming.lng),
  description: pickBetterString(current.description, incoming.description),
  website: pickBetterString(current.website, incoming.website),
  stage: pickBetterString(current.stage, incoming.stage),
  employees: pickBetterString(current.employees, incoming.employees),
  sector: pickBetterString(current.sector, incoming.sector),
  foundedYear: pickBetterNumber(current.foundedYear, incoming.foundedYear),
  hiring: current.hiring ?? incoming.hiring,
  jobsUrl: pickBetterString(current.jobsUrl, incoming.jobsUrl),
  photoUrl: pickBetterString(current.photoUrl, incoming.photoUrl),
});

// "Stage" column in the company sheet has dates mixed in. Treat any value
// that isn't a recognizable stage word as null.
const KNOWN_STAGES = new Set([
  'idea',
  'pre-seed',
  'preseed',
  'seed',
  'series a',
  'series b',
  'series c',
  'growth',
  'late stage',
  'late stage growth',
  'bootstrapped',
]);
const cleanStage = (v) => {
  const s = cleanString(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (KNOWN_STAGES.has(lower)) return s;
  // SheetJS often gives Date instances for date-typed cells.
  if (v instanceof Date) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s;
};

const parseCity = (address) => {
  if (!address) return null;
  // Format observed: "<street>, <city>, UT"  -> take the second-to-last segment.
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) return parts[parts.length - 2] || null;
  return null;
};

// ---------- geocoding ----------

async function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function geocode(address, cache) {
  if (!address) return { lat: null, lng: null };
  if (cache[address]) return cache[address];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    address
  )}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'utah-startup-state-etl (hackathon, contact: mcotache@tannerco.com)',
    },
  });
  if (!res.ok) {
    console.warn(`  geocode ${res.status} for "${address}"`);
    return { lat: null, lng: null };
  }
  const json = await res.json();
  const hit = Array.isArray(json) && json[0];
  const result = hit
    ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
    : { lat: null, lng: null };
  cache[address] = result;
  await saveCache(cache);
  // Be polite: Nominatim asks for max 1 req/sec.
  await new Promise((r) => setTimeout(r, 1100));
  return result;
}

// ---------- ETL ----------

function readSheet(path) {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

async function readSheetFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} -> ${res.status}`);
  const csv = await res.text();
  const wb = XLSX.read(csv, { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

async function loadRows({ url, file, label }) {
  if (url) {
    console.log(`  source: ${label} <- ${url}`);
    return readSheetFromUrl(url);
  }
  await ensureExists(file, `${label} xlsx`);
  console.log(`  source: ${label} <- ${file}`);
  return readSheet(file);
}

function buildResources(rows) {
  return rows
    .map((r) => {
      const name = cleanString(r.Title);
      if (!name) return null;
      const description = cleanString(r.description) || '';
      const topics = splitPipes(r.Topics);
      return {
        id: cleanString(r.id) || slug(name),
        name,
        description,
        communities: splitPipes(r.Communities),
        industries: splitPipes(r.Industries),
        locations: splitPipes(r.Locations),
        topics,
        url: cleanString(r.link) || '',
        email: cleanString(r.email),
        journeySteps: mapJourneySteps(description, topics),
      };
    })
    .filter(Boolean);
}

async function buildCompanies(rows) {
  const cache = await loadCache();
  const out = [];
  const duplicateIndexByKey = new Map();
  const usedIds = new Set();
  let i = 0;
  for (const r of rows) {
    i += 1;
    const name = cleanString(r['Startup Name '] ?? r['Startup Name']);
    if (!name) continue;
    const address = cleanString(r['Full Address']);
    const { lat, lng } = address ? await geocode(address, cache) : { lat: null, lng: null };
    if (i % 10 === 0) console.log(`  geocoded ${i}/${rows.length}`);
    const candidate = {
      id: slug(name) || `co-${i}`,
      name,
      linkedin: cleanString(r['LinkedIn Link (map it to Links to get the logo)']),
      address: address || '',
      city: parseCity(address),
      lat,
      lng,
      description: cleanString(r['Description of startup']),
      website: cleanString(r.Website),
      stage: cleanStage(r.Stage),
      employees: cleanString(r['# of Employees ']) ?? cleanString(r['# of Employees']),
      sector: cleanString(r.Section),
      foundedYear: null,
      hiring: null,
      jobsUrl: null,
      photoUrl: null,
    };

    const duplicateKeys = buildCompanyDuplicateKeys(candidate);
    const existingIndex = duplicateKeys
      .map((key) => duplicateIndexByKey.get(key))
      .find((index) => Number.isInteger(index));

    if (existingIndex !== undefined) {
      out[existingIndex] = mergeCompanyRows(out[existingIndex], candidate);
      for (const key of duplicateKeys) duplicateIndexByKey.set(key, existingIndex);
      continue;
    }

    candidate.id = ensureUniqueId(candidate.id, usedIds);
    usedIds.add(candidate.id);
    const nextIndex = out.push(candidate) - 1;
    for (const key of duplicateKeys) duplicateIndexByKey.set(key, nextIndex);
  }
  return out;
}

async function ensureExists(p, label) {
  try {
    await access(p);
  } catch {
    throw new Error(`${label} not found at ${p}`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Reading resources…');
  const resourceRows = await loadRows({
    url: process.env.RESOURCES_URL,
    file: RESOURCES_PATH,
    label: 'Resources',
  });
  const resources = buildResources(resourceRows);
  await writeFile(join(OUT_DIR, 'resources.json'), JSON.stringify(resources, null, 2));
  console.log(`  wrote ${resources.length} resources -> public/data/resources.json`);

  console.log('Reading companies + geocoding (cached)…');
  const companyRows = await loadRows({
    url: process.env.COMPANIES_URL,
    file: COMPANIES_PATH,
    label: 'Companies',
  });
  const companies = await buildCompanies(companyRows);
  const withCoords = companies.filter((c) => c.lat != null);
  await writeFile(join(OUT_DIR, 'companies.json'), JSON.stringify(companies, null, 2));
  console.log(
    `  wrote ${companies.length} companies -> public/data/companies.json (${withCoords.length} geocoded)`
  );
}

main().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
