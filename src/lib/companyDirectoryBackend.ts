import type { Company } from '../types';
import { getEmailDomain, getWebsiteDomain, normalizeUrl } from './companyMeta';
import { geocodeAddress } from './geocode';
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
  lat?: number | null;
  lng?: number | null;
}

export interface ClaimRequestInput {
  claimantEmail: string;
  claimantName: string;
  claimantRole: string;
  requestedChanges: string;
}

export interface UpdateRequestInput {
  requesterEmail: string;
  requesterName: string;
  requesterRole: string;
  requestedChanges: string;
  profile: CompanyProfileInput;
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
  contact_email: string | null;
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
    contactEmail: row.contact_email ?? null,
  };
}

function buildProfilePatch(profile: CompanyProfileInput) {
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
  };
}

function buildCompanyPayload(profile: CompanyProfileInput, userId?: string) {
  const coordinates =
    'lat' in profile || 'lng' in profile
      ? { lat: profile.lat ?? null, lng: profile.lng ?? null }
      : {};

  return {
    ...buildProfilePatch(profile),
    ...coordinates,
    updated_at: new Date().toISOString(),
    ...(userId ? { created_by_user_id: userId } : {}),
  };
}

function buildGeocodeQueryFromParts(addressValue: string, cityValue: string | null | undefined): string {
  const address = addressValue.trim();
  const city = cityValue?.trim();
  const includesCity = city ? address.toLowerCase().includes(city.toLowerCase()) : false;
  return [address, includesCity ? null : city, 'Utah', 'USA'].filter(Boolean).join(', ');
}

function buildGeocodeQuery(profile: CompanyProfileInput): string {
  return buildGeocodeQueryFromParts(profile.address, profile.city);
}

async function withFreshCoordinates(profile: CompanyProfileInput): Promise<CompanyProfileInput> {
  const coordinates = await geocodeAddress(buildGeocodeQuery(profile));
  return {
    ...profile,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
  };
}

function getVerificationStatus(email: string, website: string | null): 'verified' | 'failed' {
  const emailDomain = getEmailDomain(email);
  const websiteDomain = getWebsiteDomain(website);
  if (!emailDomain || !websiteDomain) return 'failed';
  return emailDomain === websiteDomain || emailDomain.endsWith(`.${websiteDomain}`) ? 'verified' : 'failed';
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
    .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls, contact_email')
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
  const profileWithCoordinates = await withFreshCoordinates(profile);

  const attemptInsert = async (companyId: string) => {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        id: companyId,
        ...buildCompanyPayload(profileWithCoordinates, userId),
      })
      .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls, contact_email')
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

export async function submitClaimRequest(companyId: string, userId: string, request: ClaimRequestInput): Promise<void> {
  const supabase = requireSupabase();
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, website')
    .eq('id', companyId)
    .single();

  if (companyError) throw new Error(companyError.message);

  const verificationStatus = getVerificationStatus(request.claimantEmail, company.website as string | null);
  const { error } = await supabase.from('company_claim_requests').insert({
    claimant_user_id: userId,
    claimant_email: request.claimantEmail.trim().toLowerCase(),
    company_id: companyId,
    company_name: company.name,
    claimant_name: request.claimantName.trim(),
    claimant_role: request.claimantRole.trim(),
    requested_changes: request.requestedChanges.trim(),
    proposed_profile_data: null,
    website_domain: getWebsiteDomain(company.website as string | null),
    verification_status: verificationStatus,
  });

  if (error) throw new Error(error.message);
}

export async function submitUpdateRequest(companyId: string, userId: string, request: UpdateRequestInput): Promise<void> {
  const supabase = requireSupabase();
  const membership = await getActiveMembership(companyId, userId);
  if (!membership) {
    throw new Error('Only active company owners can submit profile updates.');
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single();

  if (companyError) throw new Error(companyError.message);

  const proposedProfileData = JSON.stringify(buildProfilePatch(request.profile));
  const { error } = await supabase.from('company_update_requests').insert({
    requester_user_id: userId,
    requester_email: request.requesterEmail.trim().toLowerCase(),
    company_id: companyId,
    company_name: company.name,
    requester_name: request.requesterName.trim(),
    requester_role: request.requesterRole.trim(),
    requested_changes: request.requestedChanges.trim(),
    proposed_profile_data: proposedProfileData,
  });

  if (error) throw new Error(error.message);
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

/**
 * Approve a claim. This both:
 *   1. Marks the request as approved.
 *   2. Inserts an active 'owner' membership for the claimant if one doesn't already exist.
 * Idempotent — safe to retry.
 */
export async function approveClaimRequest(requestId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: claim, error: fetchError } = await supabase
    .from('company_claim_requests')
    .select('company_id, claimant_user_id')
    .eq('id', requestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error: membershipError } = await supabase.from('company_memberships').upsert(
    {
      company_id: claim.company_id,
      user_id: claim.claimant_user_id,
      role: 'owner',
      status: 'active',
    },
    { onConflict: 'company_id,user_id' }
  );
  if (membershipError) throw new Error(membershipError.message);

  const { error: statusError } = await supabase
    .from('company_claim_requests')
    .update({ review_status: 'approved' })
    .eq('id', requestId);
  if (statusError) throw new Error(statusError.message);
}

export async function denyClaimRequest(requestId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('company_claim_requests')
    .update({ review_status: 'denied' })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

/**
 * Approve an update request. If the request includes parseable proposed profile data
 * (JSON object with snake_case column keys), apply it to the companies row and
 * refresh map coordinates when the location changed.
 */
export async function approveUpdateRequest(requestId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: update, error: fetchError } = await supabase
    .from('company_update_requests')
    .select('company_id, proposed_profile_data')
    .eq('id', requestId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const patch = parseProfilePatch(update.proposed_profile_data as string | null);
  if (patch) {
    const { data: currentCompany, error: currentCompanyError } = await supabase
      .from('companies')
      .select('address, city')
      .eq('id', update.company_id)
      .single();
    if (currentCompanyError) throw new Error(currentCompanyError.message);

    const locationChanged =
      typeof patch.address === 'string' || Object.prototype.hasOwnProperty.call(patch, 'city');
    const companyUpdate: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };

    if (locationChanged) {
      const nextAddress =
        typeof patch.address === 'string' ? patch.address : (currentCompany.address as string);
      const nextCity =
        Object.prototype.hasOwnProperty.call(patch, 'city') && (patch.city === null || typeof patch.city === 'string')
          ? (patch.city as string | null)
          : (currentCompany.city as string | null);
      const coordinates = await geocodeAddress(buildGeocodeQueryFromParts(nextAddress, nextCity));
      companyUpdate.lat = coordinates?.lat ?? null;
      companyUpdate.lng = coordinates?.lng ?? null;
    }

    const { error: applyError } = await supabase
      .from('companies')
      .update(companyUpdate)
      .eq('id', update.company_id);
    if (applyError) throw new Error(applyError.message);
  }

  const { error: statusError } = await supabase
    .from('company_update_requests')
    .update({ review_status: 'approved' })
    .eq('id', requestId);
  if (statusError) throw new Error(statusError.message);
}

export async function rejectUpdateRequest(requestId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('company_update_requests')
    .update({ review_status: 'rejected' })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

const ALLOWED_PATCH_KEYS = new Set<string>([
  'name',
  'website',
  'linkedin',
  'address',
  'city',
  'description',
  'stage',
  'employees',
  'sector',
  'founded_year',
  'hiring',
  'jobs_url',
  'photo_url',
  'photo_urls',
  'contact_email',
]);

function parseProfilePatch(raw: string | null): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (ALLOWED_PATCH_KEYS.has(key)) safe[key] = value;
    }
    return Object.keys(safe).length > 0 ? safe : null;
  } catch {
    return null;
  }
}

export async function updateOwnedCompany(companyId: string, profile: CompanyProfileInput): Promise<Company> {
  const supabase = requireSupabase();
  const profileWithCoordinates = await withFreshCoordinates(profile);
  const { data, error } = await supabase
    .from('companies')
    .update(buildCompanyPayload(profileWithCoordinates))
    .eq('id', companyId)
    .select('id, name, linkedin, address, city, lat, lng, description, website, stage, employees, sector, founded_year, hiring, jobs_url, photo_url, photo_urls, contact_email')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCompany(data as CompanyRow);
}
