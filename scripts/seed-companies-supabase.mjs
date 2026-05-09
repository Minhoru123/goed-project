import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
].filter(Boolean);

if (missing.length > 0) {
  throw new Error(`Missing required env var(s): ${missing.join(', ')}. Add them to .env before running this script.`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const filePath = resolve('public/data/companies.json');
const raw = await readFile(filePath, 'utf8');
const companies = JSON.parse(raw);

if (!Array.isArray(companies)) {
  throw new Error('public/data/companies.json is not an array.');
}

const timestamp = new Date().toISOString();
const dedupeIndexByKey = new Map();
const usedIds = new Set();
const payload = [];

for (const company of companies) {
  const candidate = {
    id: company.id,
    name: company.name,
    linkedin: normalizeUrl(company.linkedin),
    address: company.address,
    city: company.city,
    lat: company.lat,
    lng: company.lng,
    description: company.description,
    website: normalizeUrl(company.website),
    stage: company.stage,
    employees: company.employees,
    sector: company.sector,
    founded_year: company.foundedYear,
    hiring: company.hiring,
    jobs_url: normalizeUrl(company.jobsUrl),
    photo_url: normalizeUrl(company.photoUrl),
    updated_at: timestamp,
  };

  const duplicateKeys = buildDuplicateKeys(candidate);
  const existingIndex = duplicateKeys
    .map((key) => dedupeIndexByKey.get(key))
    .find((index) => Number.isInteger(index));

  if (existingIndex !== undefined) {
    payload[existingIndex] = mergeCompany(payload[existingIndex], candidate);
    for (const key of duplicateKeys) dedupeIndexByKey.set(key, existingIndex);
    continue;
  }

  candidate.id = ensureUniqueId(candidate.id, usedIds);
  usedIds.add(candidate.id);
  const nextIndex = payload.push(candidate) - 1;
  for (const key of duplicateKeys) dedupeIndexByKey.set(key, nextIndex);
}

const { error, count } = await supabase
  .from('companies')
  .upsert(payload, { onConflict: 'id', ignoreDuplicates: false, count: 'exact' });

if (error) {
  throw new Error(error.message);
}

console.log(`Upserted ${count ?? payload.length} companies into Supabase (${companies.length} source rows -> ${payload.length} live rows).`);

function ensureUniqueId(baseId, usedIds) {
  const normalizedBase = typeof baseId === 'string' && baseId.trim() ? baseId.trim() : 'company';
  if (!usedIds.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  let candidate = `${normalizedBase}-${suffix}`;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
  return candidate;
}

function buildDuplicateKeys(company) {
  const keys = [];
  const name = normalizeText(company.name);
  const address = normalizeAddress(company.address);
  const domain = getWebsiteDomain(company.website);
  if (name && address) keys.push(`${name}|address|${address}`);
  if (name && domain) keys.push(`${name}|domain|${domain}`);
  return keys;
}

function mergeCompany(existing, incoming) {
  return {
    ...existing,
    name: pickBetter(existing.name, incoming.name),
    linkedin: pickBetter(existing.linkedin, incoming.linkedin),
    address: pickBetter(existing.address, incoming.address),
    city: pickBetter(existing.city, incoming.city),
    lat: pickBetterNumber(existing.lat, incoming.lat),
    lng: pickBetterNumber(existing.lng, incoming.lng),
    description: pickBetter(existing.description, incoming.description),
    website: pickBetter(existing.website, incoming.website),
    stage: pickBetter(existing.stage, incoming.stage),
    employees: pickBetter(existing.employees, incoming.employees),
    sector: pickBetter(existing.sector, incoming.sector),
    founded_year: pickBetterNumber(existing.founded_year, incoming.founded_year),
    hiring: existing.hiring ?? incoming.hiring,
    jobs_url: pickBetter(existing.jobs_url, incoming.jobs_url),
    photo_url: pickBetter(existing.photo_url, incoming.photo_url),
    updated_at: incoming.updated_at,
  };
}

function pickBetter(current, incoming) {
  const currentText = typeof current === 'string' ? current.trim() : '';
  const incomingText = typeof incoming === 'string' ? incoming.trim() : '';
  if (!currentText) return incoming ?? null;
  if (!incomingText) return current;
  return incomingText.length > currentText.length ? incoming : current;
}

function pickBetterNumber(current, incoming) {
  return current ?? incoming ?? null;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeAddress(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function getWebsiteDomain(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
