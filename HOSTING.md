# Hosting

## The shape of it

Three things have to live somewhere, and they cannot all live in the same place:

| Piece | Where | Why not elsewhere |
|---|---|---|
| Web app (`apps/web`) | Cloudflare | Static files. Nothing to run. |
| API (`apps/api`) | A Node host — Fly.io, Railway, Render | Fastify holds a Postgres connection pool and uses argon2 (native). Cloudflare Workers run neither. |
| Database | Neon, or the Node host's own Postgres | — |
| Uploads | Cloudflare R2 | Photos of a leak and receipts must outlive a container. |

## Live state

| Thing | Status |
|---|---|
| Fly app `miftan` (fra) | created, image builds, **not deployed — needs a database** |
| R2 bucket `miftan-uploads` (WEUR) | live, public read + CORS set, verified end to end |
| Fly secrets (JWT, all five R2) | staged, apply on first deploy |
| Postgres | **not provisioned** — Neon, region eu-central-1, both connection strings needed |
| Cloudflare web build | building from GitHub |

## What is already wired

Cloudflare builds from GitHub. The root `wrangler.jsonc` tells it which app in the
workspace to ship — without that it stops at *"application detection logic has been
run in the root of a workspace"*, which is the error you hit.

Build settings in the Cloudflare dashboard:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** leave empty — the root `wrangler.jsonc` handles it

## How the app reaches the API

The browser never calls the API's own hostname. The web Worker
(`apps/web/worker/index.js`) answers `/api/*` on the app's origin and passes
the request to `API_URL` with the `/api` prefix removed. The app and the API
therefore share one origin, so the refresh cookie is first-party: `SameSite=lax`
is enough, Safari's third-party cookie blocking cannot drop it, and a reload
stays signed in.

Set these in the Cloudflare dashboard (Workers → `miftan-web` → Settings →
Variables and Secrets). `keep_vars` in `wrangler.jsonc` stops deploys from
wiping them:

- `API_URL`: the API's address, e.g. the Cloud Run URL printed by the deploy
  workflow's Health check. Changing it needs no rebuild.
- `PROXY_SECRET` (secret): 32+ random characters, the same value as the
  `PROXY_SECRET` GitHub secret the API gets. With it the API rate-limits per
  user. Without it, everyone behind the Worker shares one address.

On the API, `COOKIE_PATH` is `/api/auth` (the path the browser sees) and
`COOKIE_SAMESITE` stays at its default, `lax`. `deploy.yml` sets both.

`VITE_API_URL` is no longer read. A value left in the Cloudflare build settings
is harmless, but it can be deleted.

Unset or unreachable, the Worker answers `/api/*` with a JSON
`api_unreachable` error, which the app shows as *"אין חיבור לשרת"*.

## Database (Supabase)

The shared database is the Supabase project `kpyzuzlgdfbkacoqmqtb` (region
ap-southeast-2, Sydney). The app talks to it as plain Postgres — it does not use
Supabase's Data API or keys.

Two GitHub secrets, both from **Connect** in the Supabase dashboard, with the
database password filled in (URL-encode any special characters) and
`?sslmode=require` appended:

- `DATABASE_DIRECT_URL` — the **session pooler**, port **5432**
  (`postgresql://postgres.kpyzuzlgdfbkacoqmqtb:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require`).
  Migrations and seeding use it. The direct `db.<ref>.supabase.co` host is
  IPv6-only and GitHub's runners cannot reach it.
- `DATABASE_POOLED_URL` — the **transaction pooler**: the same address on port
  **6543**. The running app uses it; `db/client.ts` recognises it and turns off
  prepared statements.

The `database` job in `deploy.yml` applies every migration on main to it after
each green build, so a table anyone adds reaches the shared database without
anybody connecting by hand. To load the demo data: Actions → deploy → Run
workflow → data `reset-demo`, confirm `erase-demo-database`.

Every table gets row-level security with no policies (`db/migrate.ts`), so the
Data API — reachable with the project's public key — sees nothing. The app's own
connection owns the tables and is unaffected.

`.mcp.json` registers Supabase's MCP server for Claude Code, for inspecting the
database; it carries the project id only, no credentials.

## Database (Neon)

Create the project in **AWS eu-central-1 (Frankfurt)** — the same city as the API,
and inside the EU.

Neon gives you two connection strings and they are not interchangeable:

- The **pooled** one, with `-pooler` in the hostname. This is `DATABASE_URL` for
  the running app. It is PgBouncer in transaction mode, so `db/client.ts` detects
  the `-pooler` host and turns off prepared statements. Without that the app works
  fine until it starts reporting `prepared statement "s1" does not exist` under
  concurrency.
- The **direct** one, without `-pooler`. Use this for migrations and for
  `db:seed`. DDL through a transaction pooler is a bad idea.

Both need `?sslmode=require`, which Neon's copy button already includes.

## R2

The driver is `apps/api/src/storage/r2.ts`. It signs a 15-minute PUT so the bytes
go straight from the client to R2 and never through the API process.

Five variables, all required together (`apps/api/.env.example` has them):

```
S3_ENDPOINT  S3_BUCKET  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY  S3_REGION  S3_PUBLIC_URL
```

The bucket is `miftan-uploads`, in WEUR, reading publicly from
`https://pub-ac84dd5958724504aa061dcd3959715c.r2.dev`. CORS lists the app's
origins explicitly rather than `*`, because a wildcard would let any site on the
internet spend a leaked upload URL.

Verified against the real bucket: a signed PUT returns 200, the object reads back
from the public origin with the right content type, and a PUT whose content type
does not match the one that was signed is rejected with 403.

`S3_ENDPOINT` is what selects the provider — `https://<account>.r2.cloudflarestorage.com`
for R2, `https://<ref>.supabase.co/storage/v1/s3` for Supabase, whose keys come from
**Storage → S3 Access Keys**. `S3_REGION` is `auto` for R2 and the project's region for
Supabase.

On R2, `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` come from **R2 → Manage R2 API Tokens →
Create API token → Object Read & Write**. A Cloudflare API token (`cfut_…`) is a
different credential and cannot sign an S3 request.

The bucket needs a public read origin for `S3_PUBLIC_URL` — either a custom domain
on the bucket, or its `r2.dev` subdomain. Uploads are keyed by UUID, so filenames
never come from the client.

With none of these set the API writes to `apps/api/uploads` in development, and
**refuses to boot** in production rather than writing a tenant's evidence to a
filesystem that the next deploy throws away.

## Email (Resend)

`RESEND_API_KEY` lives in Fly secrets, never in the repo. Unset, the API prints
mail to the console (dev, tests, demo).

After `baalabait.co.il` is on Cloudflare, add these DNS records from the Resend
dashboard (Domain → baalabait.co.il):

| Type | Name | Purpose |
|---|---|---|
| TXT | `@` | SPF (`v=spf1 include:amazonses.com ~all` or whatever Resend shows) |
| CNAME | `resend._domainkey` (or as shown) | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:privacy@baalabait.co.il` |

From: `בעל הבית <noreply@baalabait.co.il>`. Forward `support@`, `privacy@` and
`accessibility@` with Cloudflare Email Routing.

## Agent tracing

Cloudflare's `agent-setup/tracing.md` configures `observability.traces` for a
**Worker running agent code**. Miftan's Cloudflare deployment is static assets with
no `main` — there is no Worker and no agent turn to trace. Enabling it here would
be configuration that does nothing. If the API ever moves onto Workers, revisit it.
