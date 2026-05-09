import type { Company } from '../types';

const STREET_WORDS = new Set([
  'ave',
  'avenue',
  'blvd',
  'boulevard',
  'cir',
  'circle',
  'court',
  'ct',
  'dr',
  'drive',
  'hwy',
  'highway',
  'lane',
  'ln',
  'pkwy',
  'parkway',
  'pl',
  'place',
  'rd',
  'road',
  'sq',
  'street',
  'st',
  'ter',
  'terrace',
  'trl',
  'trail',
  'way',
]);

export function toTitleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeCityToken(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

export function isLikelyCityName(value: string | null): value is string {
  const normalized = normalizeCityToken(value);
  if (!normalized) return false;
  if (/\d/.test(normalized)) return false;
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(normalized)) return false;
  if (/^(ut|utah)(\s+\d{5})?$/i.test(normalized)) return false;
  if (/\b(?:suite|ste|unit)\b/i.test(normalized)) return false;
  const words = normalized.split(' ');
  return words.length <= 3;
}

export function getKnownCities(companies: readonly Company[]): string[] {
  const unique = new Map<string, string>();
  for (const company of companies) {
    if (!isLikelyCityName(company.city)) continue;
    const normalized = toTitleCase(normalizeCityToken(company.city)!);
    unique.set(normalized.toLowerCase(), normalized);
  }
  return Array.from(unique.values()).sort();
}

export function extractCityFromAddress(address: string | null, knownCities: readonly string[]): string | null {
  const normalizedAddress = address?.trim().replace(/\s+/g, ' ');
  if (!normalizedAddress) return null;

  const addressLower = normalizedAddress.toLowerCase();
  const knownMatch = [...knownCities]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => addressLower.includes(candidate.toLowerCase()));
  if (knownMatch) return knownMatch;

  const cleaned = normalizedAddress
    .replace(/\b(?:Suite|Ste|Unit)\s+[A-Za-z0-9-]+\b/gi, ' ')
    .replace(/\bUS\b/gi, ' ')
    .replace(/\b(?:UT|Utah)\b(?:\s+\d{5}(?:-\d{4})?)?/gi, ' ')
    .replace(/\b\d{5}(?:-\d{4})?\b/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const words = cleaned.split(' ');
  for (let size = Math.min(3, words.length); size >= 1; size -= 1) {
    const phraseWords = words.slice(-size);
    const firstWord = phraseWords[0].replace(/[.'-]/g, '').toLowerCase();
    if (firstWord.length === 1) continue;
    if (STREET_WORDS.has(firstWord)) continue;
    const candidate = phraseWords.join(' ');
    if (isLikelyCityName(candidate)) return toTitleCase(candidate);
  }

  return null;
}

export function cleanCity(city: string | null, address: string | null, knownCities: readonly string[]): string | null {
  if (isLikelyCityName(city)) return toTitleCase(normalizeCityToken(city)!);
  return extractCityFromAddress(address, knownCities);
}

export function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getWebsiteDomain(value: string | null): string | null {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function getEmailDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1];
}
