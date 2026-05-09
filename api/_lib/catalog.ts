import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import rawCompaniesJson from '../../public/data/companies.json';
import rawResourcesJson from '../../public/data/resources.json';

const STEP_KEYWORDS: Record<number, RegExp> = {
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

const TOPIC_TO_STEPS: Record<string, number[]> = {
  'pre-seed': [3, 9],
  seed: [9],
  'early stage': [3, 4, 9],
  'late stage growth': [13, 14],
  'growth stage': [13, 14],
  mature: [14, 18],
  exit: [19],
};

export interface ResourceCatalogItem {
  id: string;
  name: string;
  description: string;
  communities: string[];
  industries: string[];
  locations: string[];
  topics: string[];
  url: string;
  email: string | null;
  journeySteps: number[];
}

export interface CompanyCatalogItem {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  stage: string | null;
  employees: string | null;
  description: string | null;
  lat?: number | null;
  lng?: number | null;
}

function splitPipes(value: unknown): string[] {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toNumberArray(value: unknown, max: number, min: number, maxValue: number): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (typeof item === 'number' && Number.isFinite(item) && item >= min && item <= maxValue) {
      out.push(Math.trunc(item));
    }
    if (out.length >= max) break;
  }
  return out;
}

function toStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slug(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapJourneySteps(description: string, topics: string[]): number[] {
  const text = `${description} ${topics.join(' ')}`;
  const matched = new Set<number>();

  for (const [step, regex] of Object.entries(STEP_KEYWORDS)) {
    if (regex.test(text)) matched.add(Number(step));
  }
  for (const topic of topics) {
    const steps = TOPIC_TO_STEPS[topic.toLowerCase()];
    if (steps) {
      for (const step of steps) matched.add(step);
    }
  }

  return Array.from(matched).sort((a, b) => a - b);
}

function sanitizeResource(value: unknown): ResourceCatalogItem | null {
  if (!value || typeof value !== 'object') return null;
  const resource = value as Record<string, unknown>;
  const name = cleanText(resource.name, 120);
  if (!name) return null;

  return {
    id: cleanText(resource.id, 80) || slug(name),
    name,
    description: cleanText(resource.description, 280),
    communities: toStringArray(resource.communities, 10, 60),
    industries: toStringArray(resource.industries, 10, 60),
    locations: toStringArray(resource.locations, 10, 60),
    topics: toStringArray(resource.topics, 10, 60),
    url: cleanText(resource.url, 240),
    email: cleanText(resource.email, 120) || null,
    journeySteps: toNumberArray(resource.journeySteps, 5, 1, 19),
  };
}

function sanitizeCompany(value: unknown): CompanyCatalogItem | null {
  if (!value || typeof value !== 'object') return null;
  const company = value as Record<string, unknown>;
  const id = typeof company.id === 'string' ? company.id : null;
  const name = typeof company.name === 'string' ? company.name : null;
  if (!id || !name) return null;

  return {
    id,
    name,
    city: typeof company.city === 'string' ? company.city : null,
    sector: typeof company.sector === 'string' ? company.sector : null,
    stage: typeof company.stage === 'string' ? company.stage : null,
    employees: typeof company.employees === 'string' ? company.employees : null,
    description: typeof company.description === 'string' ? company.description.slice(0, 200) : null,
    lat: typeof company.lat === 'number' ? company.lat : null,
    lng: typeof company.lng === 'number' ? company.lng : null,
  };
}

async function readSheetRowsFromUrl(url: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch ${url} -> ${response.status}`);
  }
  const csv = await response.text();
  const workbook = XLSX.read(csv, { type: 'string' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false }) as Record<string, unknown>[];
}

function buildResources(rows: Record<string, unknown>[]): ResourceCatalogItem[] {
  return rows
    .map((row) => {
      const name = cleanString(row.Title);
      if (!name) return null;
      const description = cleanString(row.description) || '';
      const topics = splitPipes(row.Topics);
      return {
        id: cleanString(row.id) || slug(name),
        name,
        description,
        communities: splitPipes(row.Communities),
        industries: splitPipes(row.Industries),
        locations: splitPipes(row.Locations),
        topics,
        url: cleanString(row.link) || '',
        email: cleanString(row.email),
        journeySteps: mapJourneySteps(description, topics),
      };
    })
    .filter((item): item is ResourceCatalogItem => item !== null);
}

export async function loadResourceCatalog(): Promise<ResourceCatalogItem[]> {
  const resourcesUrl = process.env.RESOURCES_URL;
  if (resourcesUrl) {
    try {
      const rows = await readSheetRowsFromUrl(resourcesUrl);
      return buildResources(rows);
    } catch {
      // Fall back to the checked-in catalog so the app still works if the live sheet is unavailable.
    }
  }

  if (!Array.isArray(rawResourcesJson)) return [];
  return rawResourcesJson.map(sanitizeResource).filter((resource): resource is ResourceCatalogItem => resource !== null);
}

export async function loadCompanyCatalog(): Promise<CompanyCatalogItem[]> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, city, sector, stage, employees, description, lat, lng')
      .order('name');

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(sanitizeCompany).filter((company): company is CompanyCatalogItem => company !== null);
    }
  }

  if (!Array.isArray(rawCompaniesJson)) return [];
  return rawCompaniesJson.map(sanitizeCompany).filter((company): company is CompanyCatalogItem => company !== null);
}
