# Supabase setup

## 1. Create the project
1. Go to https://supabase.com/dashboard → **New project**.
2. Pick a name, region, and a strong database password.
3. Once provisioned, grab these into your `.env.local`:
   - **Project URL** (Settings → Data API) → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** (Settings → API Keys) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (Settings → API Keys, "reveal") → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Apply the schema

**Option A — Dashboard (simplest):**
Open **SQL Editor** in the dashboard, paste the contents of
`migrations/0001_initial_schema.sql`, and run it.

**Option B — Supabase CLI:**
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push             # applies everything in supabase/migrations/
```

## 3. Verify
In the dashboard's **Table Editor** you should see 9 tables:
`account_managers, dealers, pmas, priority_models, eligibility,
page_templates, pages, audit_runs, audit_findings`.

Every table has Row Level Security **enabled** with a single policy granting
authenticated users full access. The service-role key bypasses RLS for the
seed script and cron audit job.

## 4. Auth configuration (required for magic-link login)

In the Supabase dashboard:

1. **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:3000` for dev (set to your Vercel URL in prod).
   - **Redirect URLs**: add `http://localhost:3000/auth/confirm` (and the prod equivalent).

2. **Authentication → Email Templates → Magic Link**
   Replace the link with the token_hash flow our `/auth/confirm` route expects:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

3. **Authentication → Providers / Sign In → "Allow new users to sign up"**
   Turn this **OFF** — the app is invite-only. Our login action also passes
   `shouldCreateUser: false`.

4. **Invite your AMs**: Authentication → Users → **Invite user** (or add by email).
   Only invited users can request a magic link.

## Notes
- `pmas.mod_score` and `priority_models.mod_score` are **generated columns**:
  `1 - ((priority_order - 1) * 0.111)`. You never insert them — set
  `priority_order` (1–9) and the score follows automatically when the AM
  reorders cities/models in the wizard.
- `gate_rules` on `page_templates` is a JSON array of eligibility `flag_key`s
  that ALL must be true for a dealer to get that page (empty array = applies to
  everyone).
