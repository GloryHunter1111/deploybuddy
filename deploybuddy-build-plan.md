# DeployBuddy — Build Plan for Codex

**One-line pitch:** A deployment assistant for "vibe coders" — paste your GitHub repo (from Lovable, Bolt, Replit, Base44, or hand-built), and DeployBuddy checks it, fixes common setup mistakes, and wires it up to Netlify + Supabase. Free to use manually; subscription unlocks full automation + monitoring.

**Who it's for:** People who built an app with an AI coding tool and are now stuck on hosting, database connection, auth, env vars, custom domains, or SSL — the step every vibe-coding guide admits is where beginners get stuck.

**Business model:** Freemium subscription (Stripe). Free tier = guided manual wizard. Paid tier = one-click automation + ongoing monitoring.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast, matches what most vibe-coded repos already use — familiar territory |
| Backend/DB | Supabase (Postgres + Auth + Row Level Security) | You already know this |
| Hosting | Netlify | You already know this |
| Payments | Stripe (Checkout + Customer Portal + Billing webhooks) | Simplest subscription billing to wire up |
| External APIs | Netlify API, Supabase Management API, GitHub API | Needed to actually automate deployment for paid users |
| Deployment | Netlify (the tool hosts itself on the same stack it manages — good demo value) |

---

## 2. Core Concept — Free vs Paid

### Free tier (anyone, no card required)
- Connect a GitHub repo (read-only OAuth or paste public repo URL)
- **Scanner**: static analysis of the repo — detects framework (Vite/Next/CRA), missing `.env.example`, hardcoded API keys, missing `netlify.toml`, missing Supabase client config, common CORS/auth redirect mistakes
- **Step-by-step wizard**: turns scan results into a plain-English checklist ("You're missing a redirect rule for client-side routing — here's the exact netlify.toml snippet to add")
- Manual copy-paste snippets for Netlify + Supabase setup
- One saved project (single project limit)

### Paid tier ($9–15/mo, Stripe subscription)
- Unlimited saved/tracked projects
- **One-click automated deploy**: DeployBuddy calls the Netlify API + Supabase Management API directly to create the site, set env vars, and link the repo — no manual dashboard work
- Custom domain + SSL automation
- **Uptime + deploy-failure monitoring** with email alerts (poll Netlify deploy status + a simple uptime ping)
- "Fix my broken deploy" — re-run the scanner against a failing live site and produce a fix list automatically
- Priority — deploy history, rollback button

---

## 3. Database Schema (Supabase / Postgres)

```sql
-- Users are handled by Supabase Auth (auth.users) automatically.

create table profiles (
  id uuid references auth.users primary key,
  email text,
  plan text not null default 'free', -- 'free' | 'pro'
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  name text not null,
  repo_url text not null,
  framework text, -- detected: 'vite' | 'next' | 'cra' | 'unknown'
  netlify_site_id text,
  supabase_project_ref text,
  custom_domain text,
  last_scan_result jsonb,
  last_deploy_status text, -- 'success' | 'failed' | 'pending' | null
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  issues jsonb not null, -- array of {severity, title, description, fix_snippet}
  created_at timestamptz default now()
);

create table deploy_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  status text not null, -- 'success' | 'failed'
  message text,
  created_at timestamptz default now()
);

-- Row Level Security: users only see their own data
alter table profiles enable row level security;
alter table projects enable row level security;
alter table scans enable row level security;
alter table deploy_events enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own projects" on projects for all using (auth.uid() = user_id);
create policy "own scans" on scans for all using (
  project_id in (select id from projects where user_id = auth.uid())
);
create policy "own deploy events" on deploy_events for all using (
  project_id in (select id from projects where user_id = auth.uid())
);
```

---

## 4. Repo Scanner Logic (the core free-tier value)

The scanner should check, in order of importance:

1. **Missing `netlify.toml`** → generate one with correct build command/publish dir based on detected framework, plus SPA redirect rule (`/* /index.html 200`) — the #1 cause of "works locally, 404s on Netlify."
2. **Hardcoded secrets** → regex-scan for API-key-shaped strings in committed source (not `.env`) → flag as critical.
3. **Missing `.env.example`** → generate one from any `import.meta.env.X` / `process.env.X` references found in code.
4. **Supabase client misconfiguration** → check that `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (or Next equivalents) are referenced correctly and not swapped with the service-role key (a very common and dangerous beginner mistake).
5. **Auth redirect URLs** → flag if Supabase Auth redirect URLs likely don't match the eventual Netlify domain.
6. **Build command mismatch** → detect `package.json` scripts vs what a default Netlify config would assume.

Each issue returned as:
```json
{
  "severity": "critical" | "warning" | "info",
  "title": "Hardcoded Supabase key found in src/lib/supabase.js",
  "description": "...",
  "fix_snippet": "..."
}
```

---

## 5. Automation Layer (paid tier only)

Uses two APIs:
- **Netlify API** (`https://api.netlify.com/api/v1/`) — create site, link repo, set env vars, trigger deploy, poll deploy status.
- **Supabase Management API** — read project URL/anon key for the user's linked Supabase project (user provides a personal access token once, stored encrypted).

Flow:
1. User connects GitHub repo + Netlify account (OAuth) + Supabase project (via access token).
2. DeployBuddy creates a Netlify site linked to the repo, injects required env vars automatically (pulled from the scan step), sets build settings.
3. Triggers deploy, polls status, writes to `deploy_events`.
4. If custom domain provided, calls Netlify DNS/SSL provisioning endpoints.
5. Sets up a scheduled check (Netlify Scheduled Function or Supabase cron) that pings the live site + checks latest deploy status every N hours; on failure, emails the user and logs to `deploy_events`.

---

## 6. Subscription / Billing

- Stripe Checkout for upgrade ($9-15/mo, pick one price point after checking 2-3 competitor prices like Stackwatch/FreeTier Sentinel for anchoring).
- Stripe Customer Portal for cancel/manage.
- Webhook endpoint (Netlify Function) listens for `customer.subscription.updated/deleted` → updates `profiles.plan`.
- Gate paid features in the UI based on `profiles.plan === 'pro'`, and enforce it server-side (never trust the client) in every Netlify Function that performs automation.

---

## 7. Build Phases (feed these to Codex one at a time)

### Phase 1 — MVP: Free scanner + wizard (ship this first, no billing yet)
- [ ] Vite + React + Tailwind project scaffold, deployed to Netlify
- [ ] Supabase project + schema above + Auth (email/password + magic link)
- [ ] Landing page explaining the tool + "Paste your repo URL" input
- [ ] Backend function (Netlify Function) that clones/reads a public GitHub repo (via GitHub API, no auth needed for public repos) and runs the Scanner Logic (section 4)
- [ ] Results page: checklist UI showing issues by severity, each with a copy-paste fix snippet
- [ ] Save one project per free user (auth required to save; scanning itself can be anonymous/no-login to reduce friction)
- [ ] Basic dashboard listing saved project(s) and last scan result

### Phase 2 — Paid tier + billing
- [ ] Stripe Checkout integration + webhook handler
- [ ] Plan gating (free = 1 project, pro = unlimited)
- [ ] Upgrade prompts at the natural friction point (trying to save a 2nd project, or clicking "auto-deploy")

### Phase 3 — Automation
- [ ] Netlify OAuth connection flow (user authorizes DeployBuddy to manage sites on their behalf)
- [ ] Supabase personal access token input (encrypted at rest)
- [ ] "One-click deploy" button implementing the Automation Layer (section 5)
- [ ] Deploy history view

### Phase 4 — Monitoring
- [ ] Scheduled function pinging live sites + checking Netlify deploy status
- [ ] Email alerts (Resend or Netlify's built-in email, or Supabase + a transactional email API)
- [ ] "Fix my broken deploy" — re-run scanner against a failing project automatically

---

## 8. Ready-to-Paste Codex Prompts

Paste these into Codex **one at a time, in order**. Don't skip ahead — each phase depends on the last actually working.

**Prompt 1 (scaffold):**
> Create a Vite + React + TypeScript + Tailwind project called "deploybuddy". Set up Supabase client using environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Add React Router with routes: `/` (landing page), `/scan` (paste repo URL + results), `/dashboard` (saved projects, requires auth), `/login`. Include a netlify.toml with correct build command, publish directory, and SPA redirect rule.

**Prompt 2 (schema):**
> Using the Supabase SQL in section 3 of deploybuddy-build-plan.md, create the database migration. Set up Supabase Auth email/password and magic link sign-in on the `/login` route.

**Prompt 3 (scanner):**
> Create a Netlify serverless function `scan-repo` that accepts a public GitHub repo URL, fetches the repo file tree via the GitHub API (no auth), reads package.json, any .env.example, and source files for env var references, and runs the checks described in section 4 of deploybuddy-build-plan.md. Return a JSON array of issues in the format specified. Build the `/scan` page to call this function and render results as a severity-sorted checklist with copyable fix snippets.

**Prompt 4 (save + dashboard):**
> Add "Save this project" on the scan results page (requires login), writing to the `projects` and `scans` tables. Build `/dashboard` to list the logged-in user's saved projects with their last scan status, enforcing the 1-project limit for `plan = 'free'` users via a Supabase RLS-safe server-side check in a Netlify function.

**Prompt 5 (billing):**
> Integrate Stripe Checkout for a $[X]/mo subscription. Add an "Upgrade" button that appears when a free user tries to save a 2nd project. Create a Netlify function Stripe webhook handler that updates `profiles.plan` on subscription events. Add a "Manage billing" link to the Stripe Customer Portal in the dashboard.

**Prompt 6 (automation):**
> Add Netlify OAuth so pro users can connect their own Netlify account. Add a form for pro users to paste a Supabase personal access token (encrypt before storing). Build a "Deploy now" button on the dashboard for pro users that calls the Netlify API to create a site linked to the project's repo, sets the env vars found during scanning, and triggers a deploy. Poll deploy status and write results to `deploy_events`. Show deploy history on the project detail view.

**Prompt 7 (monitoring):**
> Add a Netlify scheduled function that runs every 6 hours for all pro-tier projects: pings the live site URL and checks the latest Netlify deploy status via the API. On failure, insert a `deploy_events` row and send an email alert to the project owner. Add a "Fix my broken deploy" button that re-runs the scanner against the currently deployed repo and shows updated results.

---

## 9. Environment Variables Needed

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never exposed to client
GITHUB_TOKEN=                    # optional, raises API rate limits for scanning
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
NETLIFY_OAUTH_CLIENT_ID=
NETLIFY_OAUTH_CLIENT_SECRET=
RESEND_API_KEY=                  # or whichever email provider you pick
```

---

## 10. Launch Checklist (after Phase 1 ships)

- [ ] Post the free scanner (no login wall) on r/webdev, r/SideProject, r/ChatGPTCoding, Indie Hackers
- [ ] Short demo video: "I fixed my broken Lovable deploy in 30 seconds" posted to X/YouTube Shorts
- [ ] List the manual-fix version of this service as a Fiverr gig in parallel — same expertise, immediate cash while the product grows
- [ ] Collect emails from every free scan (even without login) for later launch announcements
- [ ] Track: scans run, signups, free→paid conversion rate — this tells you whether to keep investing in Phase 3/4 automation or pivot the free tool into pure lead-gen for the Fiverr service
