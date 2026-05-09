# Admin Guide - Staff Approval Queue

This guide is for GOED staff who review company claims and update requests submitted through the directory. No coding required.

---

## What the admin queue does

Two kinds of requests land in the queue:

1. **Company claims** — someone says "I work at this company, give me ownership of the listing so I can edit it."
2. **Update requests** — an already-approved company member is asking for a profile change to be published.

You see only requests that need a human decision. Auto-verified claims (where the requester's work email matches the company website domain) skip the queue and become active immediately. Anything that fails that automatic check, or anything that requires a content review, ends up here.

---

## One-time setup (do this once per staff member)

Each new staff person needs their email added to the staff allowlist. Currently this is the one step that requires somebody with database access — after the first staff member is seeded, that person can add others by re-running the same SQL through the Supabase dashboard.

**To add a staff email:**

1. Open Supabase project → **SQL Editor**.
2. Run:
   ```sql
   insert into public.staff_users (email)
   values ('person@goed.utah.gov');
   ```
3. The new staff member signs in via magic link at `/add-company` using that email.
4. The **Admin** link will appear in the top navigation for them.

To remove access:

```sql
delete from public.staff_users where email = 'person@goed.utah.gov';
```

---

## Daily workflow

### 1. Sign in

Go to `/add-company`, enter your staff email, click **Send magic link**. Open the link from your inbox.

### 2. Open the queue

Click **Admin** in the top nav. (Only visible if your email is in `staff_users`.)

You'll see two sections:

- **Pending claims** — ownership requests
- **Pending update requests** — content change requests from existing owners

### 3. Review each row

For each request you'll see:

- **Company name** with a link to open the public profile in a new tab — useful for sanity-checking the request against the live listing.
- **Verification badge** (claims only):
  - 🟢 **Domain verified** — the requester's work email already matches the company website domain. This is a soft signal that they're legitimate. Approve unless something looks off.
  - 🟡 **Manual review needed** — the email/website domain didn't match. You need to confirm the person actually works there. Useful checks:
    - LinkedIn profile under "Requested changes"
    - Phone the company's main number
    - Email the staff role-account at the company directly
- **Requester** — name and stated role.
- **Email** — the verified work email tied to the request.
- **Requested changes** — free-text from the requester explaining what they want.
- **Proposed profile data** *(optional, collapsible)* — structured field updates the requester pasted in.

### 4. Approve or deny

- **Approve** — flips the request to `approved` in the database. For claims, this **does not yet automatically grant ownership** — see the "Approving claims" note below. For updates, this marks the request as approved-for-publication.
- **Deny / Reject** — closes the request. The requester can resubmit if they want to try again.

The row disappears from the queue once you act on it.

---

## Approving claims (important detail)

Approving a claim in the admin UI marks the **request** as approved, but does not automatically insert the requester into the `company_memberships` table. For domain-verified claims this happens automatically through the existing flow, but for manual-review claims you need to grant the membership manually:

```sql
-- After approving a manual-review claim, grant ownership:
insert into public.company_memberships (company_id, user_id, role, status)
select '<company-id-from-the-claim-row>',
       (select id from auth.users where lower(email) = lower('<claimant-email>')),
       'owner',
       'active';
```

This step is necessary because we want the human approval to be deliberate — the database doesn't auto-grant ownership without explicit confirmation.

(If you're going to be approving a lot of manual-review claims, ask the engineer to add a one-click "Approve and grant membership" button — straightforward to add.)

---

## Approving update requests

Update requests are slightly looser — they're already from active company members, so the trust signal is high. The "Approve" action marks the request `approved`. The actual content edit needs to be applied separately:

- **If the requester already has active membership**, they can apply the change themselves through the company profile editor on `/add-company?mode=claim&company=<id>`. Approving here is your sign-off that the change is acceptable to publish.
- **If you want to publish the change for them**, copy the values from "Proposed profile data" into the company's row in Supabase Studio's `companies` table, or ask the engineer to wire up an "Approve and apply" button.

---

## Common situations

**Requester has a Gmail address, not a work email** → manual review. Verify ownership through LinkedIn or a phone call. Approve and grant membership manually if confirmed.

**Two people from the same company submit claims** → approve both. Multiple owners per company is fine — they'll each get their own `company_memberships` row.

**Requester wants to change a company they don't own** → deny. Tell them to file a claim first (i.e., switch to "Claim or update" mode and submit a claim with verification).

**Spam or low-effort request** → deny. No need to engage.

**Company is not in the directory yet** → this isn't a claim/update use case. Direct the requester to **Add new listing** mode at `/add-company`.

---

## Where the data lives (for your reference)

You normally never need to touch the database directly, but if you want to look up something:

- **`staff_users`** — who can see the admin queue
- **`companies`** — the directory itself
- **`company_memberships`** — who can edit which company
- **`company_claim_requests`** — claims (this table feeds the admin queue's left side)
- **`company_update_requests`** — update requests (right side)

Open Supabase Studio to view any of these. Most of the time the admin UI at `/admin` is enough.

---

## Troubleshooting

**"Admin" link doesn't show up in the nav** → your email isn't in `staff_users`. Ask whoever has DB access to insert you, or do it yourself if you have access.

**Approving a request throws an error** → most likely the RLS policies haven't been applied. Re-run [supabase/schema.sql](./supabase/schema.sql) in the SQL Editor.

**Queue is empty but you know requests exist** → either the requests have already been processed (check `review_status` column directly), or you're signed in as a non-staff account.

**You signed in but `isStaff` shows false** → sign out and back in. The staff status is fetched on session load; after adding your row to `staff_users`, you need a fresh session.
