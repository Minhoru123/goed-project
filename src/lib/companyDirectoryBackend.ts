import type { Company } from '../types';
import { normalizeUrl } from './companyMeta';
import { requireSupabase } from './supabase';

export type MembershipRole = 'owner' | 'editor';
export type MembershipStatus = 'pending' | 'active' | 'revoked';

export interface CompanyMembership {
  companyId: string;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface CompanyProfileInput {
  name: string;
  website: string | null;
  linkedin: string | null;
  address: string;
  city: string | null;
  description: string | null;
  stage: string | null;
  employees: string | null;
  sector: string | null;
  foundedYear: number | null;
  hiring: boolean | null;
  jobsUrl: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  contactEmail: string | null;
}

type CompanyRow = {
  id: string;
  name: string;
  linkedin: string | null;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  website: string | null;
  stage: string | null;
  employees: string | null;
  sector: string | null;
  founded_year: number | null;
  hiring: boolean | null;
  jobs_url: string | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
  contact_email?: string | null;
};

function slugCompanyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    linkedin: row.linkedin,
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    website: row.website,
    stage: row.stage,
    employees: row.employees,
    sector: row.sector,
    foundedYear: row.founded_year,
    hiring: row.hiring,
    jobsUrl: row.jobs_url,
    photoUrl: row.photo_url,
    photoUrls: Array.isArray(row.photo_urls) && row.photo_urls.length > 0
      ? row.photo_urls
      : row.photo_url
        ? [row.photo_url]
        : [],
  };
}

function buildCompanyPayload(profile: CompanyProfileInput, userId?: string) {
  return {
    name: profile.name.trim(),
    website: normalizeUrl(profile.website),
    linkedin: normalizeUrl(profile.linkedin),
    address: profile.address.trim(),
    city: profile.city?.trim() || null,
    description: profile.description?.trim() || null,
    stage: profile.stage?.trim() || null,
    employees: profile.employees?.trim() || null,
    sector: profile.sector?.trim() || null,
    founded_year: profile.foundedYear,
    hiring: profile.hiring,
    jobs_url: normalizeUrl(profile.jobsUrl),
    photo_url: normalizeUrl(profile.photoUrl ?? profile.photoUrls[0] ?? null),
    photo_urls: profile.photoUrls.map((url) => normalizeUrl(url)).filter((url): url is string => !!url),
    contact_email: profile.contactEmail?.trim() || null,
    updated_at: new Date().toISOString(),
    ...(userId ? { created_by_user_id: userId } : {}),
  };
}

async function insertMembership(companyId: string, userId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('company_memberships').insert({
    company_id: companyId,
    user_id: userId,
    role: 'owner',
    status: 'active',
  });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export async function listLiveCompanies(): Promise<Company[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls')
    .order('name');

  if (error) {
    throw new Error(error.message);
  }

  return (data as CompanyRow[]).map(mapCompany);
}

export async function getActiveMembership(companyId: string, userId: string): Promise<CompanyMembership | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('company_memberships')
    .select('company_id, role, status')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    companyId: data.company_id as string,
    role: data.role as MembershipRole,
    status: data.status as MembershipStatus,
  };
}

export async function createCompanyWithOwner(userId: string, profile: CompanyProfileInput): Promise<Company> {
  const supabase = requireSupabase();
  const baseId = slugCompanyName(profile.name) || 'company';

  const attemptInsert = async (companyId: string) => {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        id: companyId,
        ...buildCompanyPayload(profile, userId),
      })
      .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls')
      .single();

    if (error) {
      throw error;
    }

    return data as CompanyRow;
  };

  let row: CompanyRow;
  try {
    row = await attemptInsert(baseId);
  } catch (error) {
    const duplicate = error instanceof Error ? error.message.toLowerCase().includes('duplicate') : false;
    if (!duplicate) {
      throw error instanceof Error ? error : new Error('Failed to create company.');
    }
    row = await attemptInsert(`${baseId}-${crypto.randomUUID().slice(0, 6)}`);
  }

  await insertMembership(row.id, userId);
  return mapCompany(row);
}

export async function claimCompanyOwnership(companyId: string, userId: string): Promise<CompanyMembership> {
  await insertMembership(companyId, userId);
  const membership = await getActiveMembership(companyId, userId);
  if (!membership) {
    throw new Error('Company access could not be verified.');
  }
  return membership;
}

// ---------- Admin / staff approval queue ----------

export type ReviewStatus = 'pending' | 'approved' | 'denied' | 'rejected';

export interface PendingClaimRequest {
  id: string;
  companyId: string;
  companyName: string;
  claimantEmail: string;
  claimantName: string;
  claimantRole: string;
  requestedChanges: string;
  proposedProfileData: string | null;
  websiteDomain: string | null;
  verificationStatus: 'verified' | 'failed';
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface PendingUpdateRequest {
  id: string;
  companyId: string;
  companyName: string;
  requesterEmail: string;
  requesterName: string;
  requesterRole: string;
  requestedChanges: string;
  proposedProfileData: string | null;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export async function listPendingClaimRequests(): Promise<PendingClaimRequest[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('company_claim_requests')
    .select('id, company_id, company_name, claimant_email, claimant_name, claimant_role, requested_changes, proposed_profile_data, website_domain, verification_status, review_status, created_at')
    .eq('review_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    companyId: row.company_id as string,
    companyName: row.company_name as string,
    claimantEmail: row.claimant_email as string,
    claimantName: row.claimant_name as string,
    claimantRole: row.claimant_role as string,
    requestedChanges: row.requested_changes as string,
    proposedProfileData: (row.proposed_profile_data as string | null) ?? null,
    websiteDomain: (row.website_domain as string | null) ?? null,
    verificationStatus: row.verification_status as 'verified' | 'failed',
    reviewStatus: row.review_status as ReviewStatus,
    createdAt: row.created_at as string,
  }));
}

export async function listPendingUpdateRequests(): Promise<PendingUpdateRequest[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('company_update_requests')
    .select('id, company_id, company_name, requester_email, requester_name, requester_role, requested_changes, proposed_profile_data, review_status, created_at')
    .eq('review_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    companyId: row.company_id as string,
    companyName: row.company_name as string,
    requesterEmail: row.requester_email as string,
    requesterName: row.requester_name as string,
    requesterRole: row.requester_role as string,
    requestedChanges: row.requested_changes as string,
    proposedProfileData: (row.proposed_profile_data as string | null) ?? null,
    reviewStatus: row.review_status as ReviewStatus,
    createdAt: row.created_at as string,
  }));
}

export async function setClaimRequestStatus(requestId: string, status: 'approved' | 'denied'): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('company_claim_requests')
    .update({ review_status: status })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

export async function setUpdateRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('company_update_requests')
    .update({ review_status: status })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

export async function updateOwnedCompany(companyId: string, profile: CompanyProfileInput): Promise<Company> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('companies')
    .update(buildCompanyPayload(profile))
    .eq('id', companyId)
    .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCompany(data as CompanyRow);
}
