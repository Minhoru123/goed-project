create extension if not exists pgcrypto;

create table if not exists public.staff_users (
  email text primary key,
  added_at timestamptz not null default now()
);

create table if not exists public.companies (
  id text primary key,
  name text not null,
  linkedin text,
  address text not null,
  city text,
  lat double precision,
  lng double precision,
  description text,
  website text,
  stage text,
  employees text,
  sector text,
  founded_year integer,
  hiring boolean,
  jobs_url text,
  photo_url text,
  photo_urls text[] not null default '{}',
  contact_email text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.company_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  website text not null,
  sector text not null,
  employees text,
  year_founded text,
  address text not null,
  description text not null,
  linkedin text,
  photo_url text,
  hiring_status text,
  job_postings_url text,
  contact_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.company_claim_requests (
  id uuid primary key default gen_random_uuid(),
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  claimant_email text not null,
  company_id text not null,
  company_name text not null,
  claimant_name text not null,
  claimant_role text not null,
  requested_changes text not null,
  proposed_profile_data text,
  website_domain text,
  verification_status text not null check (verification_status in ('verified', 'failed')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

create table if not exists public.company_update_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  company_id text not null,
  company_name text not null,
  requester_name text not null,
  requester_role text not null,
  requested_changes text not null,
  proposed_profile_data text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Migration helpers for existing deployments.
alter table if exists public.staff_users
  add column if not exists added_at timestamptz not null default now();

alter table if exists public.companies
  add column if not exists photo_urls text[] not null default '{}';

alter table if exists public.companies
  add column if not exists contact_email text;

alter table if exists public.companies
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

alter table if exists public.companies
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.companies
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.company_submissions
  add column if not exists contact_email text;

alter table if exists public.company_claim_requests
  add column if not exists proposed_profile_data text;

alter table if exists public.company_claim_requests
  add column if not exists website_domain text;

alter table if exists public.company_claim_requests
  add column if not exists verification_status text;

alter table if exists public.company_claim_requests
  add column if not exists review_status text;

alter table if exists public.company_claim_requests
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.company_update_requests
  add column if not exists proposed_profile_data text;

alter table if exists public.company_update_requests
  add column if not exists review_status text;

alter table if exists public.company_update_requests
  add column if not exists created_at timestamptz not null default now();

alter table public.staff_users enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.company_submissions enable row level security;
alter table public.company_claim_requests enable row level security;
alter table public.company_update_requests enable row level security;

drop policy if exists "staff_users_select_self" on public.staff_users;
create policy "staff_users_select_self"
  on public.staff_users
  for select
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email));

drop policy if exists "companies_select_public" on public.companies;
create policy "companies_select_public"
  on public.companies
  for select
  using (true);

drop policy if exists "companies_insert_authenticated" on public.companies;
create policy "companies_insert_authenticated"
  on public.companies
  for insert
  to authenticated
  with check (
    auth.uid() = created_by_user_id
    and (
      split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) =
        replace(split_part(split_part(lower(coalesce(website, '')), '//', 2), '/', 1), 'www.', '')
      or split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) like '%.' ||
        replace(split_part(split_part(lower(coalesce(website, '')), '//', 2), '/', 1), 'www.', '')
    )
  );

drop policy if exists "companies_update_owned" on public.companies;
create policy "companies_update_owned"
  on public.companies
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.company_memberships memberships
      where memberships.company_id = companies.id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships memberships
      where memberships.company_id = companies.id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
    )
  );

drop policy if exists "company_memberships_select_own" on public.company_memberships;
create policy "company_memberships_select_own"
  on public.company_memberships
  for select
  using (auth.uid() = user_id);

drop policy if exists "company_memberships_insert_own" on public.company_memberships;
create policy "company_memberships_insert_own"
  on public.company_memberships
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1
      from public.companies
      where companies.id = company_memberships.company_id
        and (
          split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) =
            replace(split_part(split_part(lower(coalesce(companies.website, '')), '//', 2), '/', 1), 'www.', '')
          or split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) like '%.' ||
            replace(split_part(split_part(lower(coalesce(companies.website, '')), '//', 2), '/', 1), 'www.', '')
        )
    )
  );

drop policy if exists "company_claim_requests_select_own" on public.company_claim_requests;
create policy "company_claim_requests_select_own"
  on public.company_claim_requests
  for select
  using (auth.uid() = claimant_user_id);

drop policy if exists "company_claim_requests_insert_own" on public.company_claim_requests;
create policy "company_claim_requests_insert_own"
  on public.company_claim_requests
  for insert
  with check (auth.uid() = claimant_user_id);

drop policy if exists "company_update_requests_select_own" on public.company_update_requests;
create policy "company_update_requests_select_own"
  on public.company_update_requests
  for select
  using (auth.uid() = requester_user_id);

drop policy if exists "company_update_requests_insert_own" on public.company_update_requests;
create policy "company_update_requests_insert_own"
  on public.company_update_requests
  for insert
  with check (auth.uid() = requester_user_id);

drop policy if exists "company_submissions_select_own" on public.company_submissions;
create policy "company_submissions_select_own"
  on public.company_submissions
  for select
  using (auth.uid() = submitted_by_user_id);

drop policy if exists "company_submissions_insert_own" on public.company_submissions;
create policy "company_submissions_insert_own"
  on public.company_submissions
  for insert
  with check (auth.uid() = submitted_by_user_id);

drop policy if exists "claim_requests_staff_select" on public.company_claim_requests;
create policy "claim_requests_staff_select"
  on public.company_claim_requests
  for select
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "claim_requests_staff_update" on public.company_claim_requests;
create policy "claim_requests_staff_update"
  on public.company_claim_requests
  for update
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "update_requests_staff_select" on public.company_update_requests;
create policy "update_requests_staff_select"
  on public.company_update_requests
  for select
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "update_requests_staff_update" on public.company_update_requests;
create policy "update_requests_staff_update"
  on public.company_update_requests
  for update
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "submissions_staff_select" on public.company_submissions;
create policy "submissions_staff_select"
  on public.company_submissions
  for select
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "submissions_staff_update" on public.company_submissions;
create policy "submissions_staff_update"
  on public.company_submissions
  for update
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "memberships_staff_insert" on public.company_memberships;
create policy "memberships_staff_insert"
  on public.company_memberships
  for insert
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "memberships_staff_update" on public.company_memberships;
create policy "memberships_staff_update"
  on public.company_memberships
  for update
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "memberships_staff_select" on public.company_memberships;
create policy "memberships_staff_select"
  on public.company_memberships
  for select
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "companies_staff_update" on public.companies;
create policy "companies_staff_update"
  on public.companies
  for update
  using (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1
      from public.staff_users s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
