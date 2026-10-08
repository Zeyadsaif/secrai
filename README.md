# Secrai

**AI-powered cybersecurity risk management with live Microsoft Defender & Entra sync.**

Secrai connects to a company's Microsoft 365 / Defender tenant, pulls their real
security posture through the Microsoft Graph and Defender APIs, evaluates it
against a 26-rule risk engine, and turns the result into a security score,
prioritized findings, and an asset inventory.

This repository is the **real, deployable foundation** — Next.js + Supabase with
a genuine Microsoft integration. It is not a hosted service; you deploy it and
register your own Microsoft app. See *What's wired vs. scaffolded* below for an
honest map of what runs end-to-end today.

---

## Architecture

```
 Browser ──▶ Next.js (App Router)
                │  Supabase Auth (RLS-enforced, per-organization)
                │
                ├─ /api/microsoft/consent  ── admin consent redirect
                ├─ /api/microsoft/callback ── stores tenant_connections row
                ├─ /api/sync               ── sync one tenant (user-triggered)
                └─ /api/cron               ── sync all tenants (scheduled)
                        │
                        ▼
   integrations/microsoft ──▶ Microsoft Graph  (Secure Score, Entra, alerts, audit)
        (app-only tokens)  └─▶ Defender API     (devices, vulnerabilities, TVM)
                        │
                        ▼
        engine/map.ts  ── evaluate snapshot against 26 rules
                        │
                        ▼
        Supabase (service role) ── assets, findings, secure_score_history, activity
```

Data isolation is enforced at the database with Row-Level Security: every table
is keyed by `organization_id` and policies only ever expose a user's own org.
The sync job is the one trusted writer that uses the service-role key.

---

## Prerequisites

- Node.js 18.18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A Microsoft Entra tenant you can register an app in. **No production tenant?**
  Get a free [Microsoft 365 Developer sandbox](https://developer.microsoft.com/microsoft-365/dev-program)
  — an E5 tenant with sample users, ideal for testing Graph and Defender calls.

---

## 1. Supabase

1. Create a project. In **Project Settings → API** copy the Project URL, the
   `anon` key, and the `service_role` key.
2. Open the **SQL editor** and run, in order:
   - `supabase/schema.sql` (tables, enums, RLS, helper functions)
   - `supabase/seed.sql` (the 26 rules + compliance frameworks)
3. (Dev only) **Authentication → Providers → Email**: turn off "Confirm email"
   so signup logs you straight in. Leave it on for production.

## 2. Microsoft Entra app registration

In the [Entra admin center](https://entra.microsoft.com) → **App registrations → New registration**:

1. **Name**: Secrai. **Supported account types**: *Accounts in any organizational
   directory (multitenant)*.
2. **Redirect URI** (Web): `http://localhost:3000/api/microsoft/callback`
   (add your production URL later).
3. Copy the **Application (client) ID** → `MS_CLIENT_ID`.
4. **Certificates & secrets → New client secret** → copy the *value* → `MS_CLIENT_SECRET`.
   (For production prefer a certificate over a secret.)
5. **API permissions → Add a permission**, all **Application** permissions:

   **Microsoft Graph**
   - `SecurityEvents.Read.All` — Secure Score
   - `User.Read.All`, `Directory.Read.All` — Entra users & roles
   - `AuditLog.Read.All` — sign-in logs + MFA registration report
   - `IdentityRiskyUser.Read.All` — risky users
   - `SecurityAlert.Read.All`, `SecurityIncident.Read.All` — Defender XDR alerts

   **WindowsDefenderATP** (Defender for Endpoint)
   - `Machine.Read.All` — device inventory
   - `Vulnerability.Read.All` — TVM vulnerabilities
   - `SecurityRecommendation.Read.All` — TVM recommendations

6. Click **Grant admin consent** for your own tenant (so you can test).
   Each customer later grants consent for *their* tenant through the in-app flow.

> Identity Protection (risky users) and sign-in activity need **Entra ID P1/P2**;
> Defender for Endpoint TVM needs a **Defender for Endpoint P2** license. Secrai
> degrades gracefully — a missing license/permission is recorded as a "skipped"
> source rather than failing the whole sync.

## 3. Environment

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
openssl rand -base64 32   # → SECRAI_ENCRYPTION_KEY
openssl rand -hex 32      # → SYNC_SECRET
```

## 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Sign up → this creates your organization, an owner membership and a 3-day trial.
Go to **Integrations → Connect Microsoft tenant** → complete admin consent → back
in Secrai click **Sync now**. Your Overview and Findings then populate from live
Microsoft data.

## 5. Deploy (Vercel + Supabase)

1. Push to a Git repo and import it into Vercel.
2. Add every variable from `.env.local` to the Vercel project (set
   `NEXT_PUBLIC_APP_URL` and `MS_REDIRECT_URI` to your production URL, and add
   that redirect URI to the Entra app registration).
3. `vercel.json` already schedules `/api/cron` every 6 hours. Protect it by
   sending `Authorization: Bearer $SYNC_SECRET`; configure the header on the
   Vercel cron or front it with a small wrapper.

---

## How Microsoft signals map to Secrai findings

| Rule | Fires when (live signal) | Source |
|------|--------------------------|--------|
| SEC-001 MFA on privileged accounts | admins with `isMfaRegistered = false` | Entra |
| SEC-002 Weak/compromised credentials | users in Identity Protection at-risk state | Entra |
| SEC-003 Inactive admin accounts | enabled admins, no sign-in > 90 days | Entra |
| SEC-004 Unsupported OS | Defender devices on EOL OS | Defender Endpoint |
| SEC-005 Missing endpoint protection | devices not fully onboarded to EDR | Defender Endpoint |
| SEC-006 Critical vulnerabilities | TVM critical / exploitable CVEs | Defender Endpoint |
| SEC-011 Unpatched critical systems | TVM software-update recommendations | Defender Endpoint |
| SEC-010 Email threats | Defender for Office 365 phishing/malware alerts | Defender Office |
| SEC-012 Excessive admin privileges | admin ratio > 5% | Entra |
| SEC-019 Weak remote access | legacy-auth sign-ins in last 30 days | Audit logs |
| SEC-024 Brute-force exposure | high failed sign-in volume | Audit logs |
| Security score | Microsoft Secure Score, normalized to 0–100 | Secure Score |

The remaining rules in the catalog (backup, DR, segmentation, awareness, etc.)
have no Microsoft signal and are surfaced through the in-app assessment instead.

---

## What's wired vs. scaffolded

**End-to-end and real:**
- Supabase auth, multi-tenant schema + RLS, org bootstrap on signup.
- The complete Microsoft integration: OAuth admin consent, per-tenant app-only
  tokens, Graph + Defender clients with paging/throttling, all five data
  pullers, the 26-rule evaluation, and idempotent persistence with a sync-run log.
- API routes for consent, callback, per-tenant sync, and scheduled cron sync.
- Overview, Findings and Integrations pages reading live data from Supabase.

**Scaffolded / next up (UI only, or not yet built):**
- Assets, Risk Engine, Compliance, Activity, Team, Settings pages exist in the
  navigation but are not all rendered yet — the polished designs for every screen
  live in the Secrai visual prototype (shareable link) and can be ported here.
- Attack simulation, report generation (PDF/CSV), and the AI assistant are
  designed in the prototype and not yet in this codebase.
- Assessment questionnaire flow (for the non-Microsoft rules).

This split is deliberate: the hard, genuinely valuable part — real Microsoft
sync feeding a real risk engine — is built and correct; the remaining pages are
mechanical UI work on top of the same data layer.

---

## Security notes

- Secrets never reach the browser. `SUPABASE_SERVICE_ROLE_KEY`, `MS_CLIENT_SECRET`
  and `SECRAI_ENCRYPTION_KEY` are server-only; the service-role client is used
  solely by the sync job.
- All tenant data access from the app goes through the RLS-enforced anon/user
  key. RLS is the last line of defense against cross-tenant leakage.
- `src/lib/crypto.ts` provides AES-256-GCM envelope encryption for any secret
  stored at rest (e.g. per-tenant refresh tokens if you move off a shared app secret).
- `/api/sync` and `/api/cron` require either a signed-in org member or the
  `SYNC_SECRET` bearer token.
- Going to production with customer data means Microsoft **publisher
  verification**, a **security review / penetration test**, and a data-processing
  agreement. This code is the engineering foundation, not a substitute for that.

## Project layout

```
src/
  app/                     Next.js routes (auth, dashboard, api)
  components/              Sidebar, integration actions
  engine/
    rules.ts               the 26-rule catalog
    map.ts                 snapshot → findings/assets/score evaluation
  integrations/microsoft/
    config.ts auth.ts graph.ts        OAuth + Graph/Defender clients
    secureScore.ts entra.ts defenderEndpoint.ts defenderOffice.ts auditLogs.ts
    snapshot.ts            collect a full tenant snapshot
    sync.ts                orchestrate + persist a sync
  lib/
    supabase/{client,server,admin}.ts
    env.ts crypto.ts org.ts database.types.ts
supabase/
  schema.sql               tables, enums, RLS, helper functions
  seed.sql                 26 rules + compliance frameworks
```
