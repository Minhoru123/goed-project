# Admin Guide - Staff Approval Queue

For GOED staff who review company claims and update requests. Everything happens in the web UI. No coding, no SQL, no developer needed for day-to-day work.

---

## What lands in your queue

- **Company claims** - someone says "I work at this company, give me ownership of the listing."
- **Update requests** - an existing company member is asking for a profile change to be published.

You only see requests that need a human decision. Auto-verified claims (where the requester's work email already matches the company website domain) skip the queue and become active immediately. Anything that fails the auto-check, or anything that needs content review, comes here.

---

## Daily workflow

### 1. Sign in
Go to `/add-company`, enter your staff email, click **Send magic link**. Open the link from your inbox.

### 2. Open the queue
Click **Admin** in the top nav. (Only visible to staff.)

You'll see two sections:
- **Pending claims** - ownership requests
- **Pending update requests** - content change requests

### 3. Review each row

Each row shows you:
- **Company name** - click to open the public profile in a new tab and sanity-check the request.
- **Verification badge** (claims only):
  - 🟢 **Domain verified** - the requester's email already matches the company website domain. Strong trust signal. Approve unless something looks off.
  - 🟡 **Manual review needed** - the email/website domain didn't match. Confirm the person actually works there before approving (LinkedIn, phone the company, email a role account).
- **Requester** - name and stated role.
- **Email** - the verified work email tied to the request.
- **Requested changes** - free-text from the requester.
- **Proposed profile data** *(collapsible)* - structured field updates the requester pasted in.

### 4. Approve or deny

- **Approve a claim** - immediately grants the requester ownership of the company. They can edit the listing right away through the directory page.
- **Approve an update** - if the requester pasted structured profile data, the changes go live immediately on the company profile. Otherwise it just records your sign-off and the requester applies the edit through their existing access.
- **Deny / Reject** - closes the request. The requester can resubmit if needed.

The row disappears from the queue once you act on it. That's it.

---

## Common situations

**Requester has a Gmail address, not a work email** -> manual review. Verify ownership through LinkedIn or a phone call. Approve if confirmed.

**Two people from the same company submit claims** -> approve both. Multiple owners per company is fine.

**Requester wants to change a company they don't own** -> deny. Direct them to the **Claim or update** flow first.

**Spam or low-effort request** -> deny.

**Company isn't in the directory yet** -> not a claim/update use case. Direct the requester to **Add new listing** at `/add-company`.

---

## One-time setup (only for the very first staff member)

The very first staff person needs their email seeded into the allowlist. Once that's done, everyone else can be added through the admin UI - no developer needed.

If you're the first staff member:

1. Open the Supabase project -> **SQL Editor**.
2. Run:
   ```sql
   insert into public.staff_users (email)
   values ('your.email@goed.utah.gov');
   ```
3. Sign in via magic link at `/add-company` using that email.
4. The **Admin** link appears in the top navigation.

After that, ask the engineer once to add an "Invite teammate" button on the admin page (~30 minutes of work). With that button in place, no SQL is ever needed again.

To remove access at any time, ask any current staff member to remove the row, or run:
```sql
delete from public.staff_users where email = 'person@goed.utah.gov';
```

---

## Troubleshooting

**"Admin" link doesn't show up** -> your email isn't in `staff_users`, or you haven't signed in yet. Try signing out and back in.

**Approving throws an error** -> the database policies may not be applied. Run [supabase/schema.sql](./supabase/schema.sql) in the Supabase SQL Editor (it's idempotent - safe to re-run).

**Queue is empty but you know requests exist** -> they may have already been processed, or you're signed in as a non-staff account.

---

## What approval actually does, under the hood

For your awareness (you don't need to act on any of this):

- **Approve claim** -> writes to `company_memberships` (role: owner, status: active) AND marks `company_claim_requests.review_status = approved`. Both happen in one click.
- **Approve update with structured data** -> applies the JSON-formatted changes to `companies` AND marks `company_update_requests.review_status = approved`.
- **Approve update without structured data** -> just marks the request approved. The requester can apply edits live through their existing membership.
- **Deny / Reject** -> only flips the status. No other side effects.
