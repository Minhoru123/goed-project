import type { Company, Resource } from '../types';
import { listLiveCompanies } from './companyDirectoryBackend';
import { isSupabaseEnabled } from './supabase';

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isResource(value: unknown): value is Resource {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isString(candidate.id) &&
    isString(candidate.name) &&
    isString(candidate.description) &&
    isStringArray(candidate.communities) &&
    isStringArray(candidate.industries) &&
    isStringArray(candidate.locations) &&
    isStringArray(candidate.topics) &&
    isString(candidate.url) &&
    isNullableString(candidate.email) &&
    isNumberArray(candidate.journeySteps)
  );
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function isCompany(value: unknown): value is Company {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isString(candidate.id) &&
    isString(candidate.name) &&
    isNullableString(candidate.linkedin) &&
    isString(candidate.address) &&
    isNullableString(candidate.city) &&
    isFiniteNumberOrNull(candidate.lat) &&
    isFiniteNumberOrNull(candidate.lng) &&
    isNullableString(candidate.description) &&
    isNullableString(candidate.website) &&
    isNullableString(candidate.stage) &&
    isNullableString(candidate.employees) &&
    isNullableString(candidate.sector) &&
    isFiniteNumberOrNull(candidate.foundedYear) &&
    isNullableBoolean(candidate.hiring) &&
    isNullableString(candidate.jobsUrl) &&
    isNullableString(candidate.photoUrl)
  );
}

async function loadStaticResources(): Promise<Resource[]> {
  const response = await fetch('/data/resources.json');
  if (!response.ok) throw new Error('Failed to load resources.json');
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !data.every(isResource)) {
    throw new Error('resources.json has an invalid shape');
  }
  return data;
}

async function loadStaticCompanies(): Promise<Company[]> {
  const response = await fetch('/data/companies.json');
  if (!response.ok) throw new Error('Failed to load companies.json');
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !data.every(isCompany)) {
    throw new Error('companies.json has an invalid shape');
  }
  return data;
}

export async function loadResources(): Promise<Resource[]> {
  try {
    const response = await fetch('/api/resources');
    if (!response.ok) {
      throw new Error(`Failed to load live resources (${response.status})`);
    }
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || !data.every(isResource)) {
      throw new Error('Live resource payload has an invalid shape');
    }
    return data;
  } catch {
    return loadStaticResources();
  }
}

export async function loadCompanies(): Promise<Company[]> {
  if (!isSupabaseEnabled) {
    return loadStaticCompanies();
  }

  try {
    const companies = await listLiveCompanies();
    return companies.length > 0 ? companies : loadStaticCompanies();
  } catch {
    return loadStaticCompanies();
  }
}
