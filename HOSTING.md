# Hosting

## The shape of it

Three things have to live somewhere, and they cannot all live in the same place:

| Piece | Where | Why not elsewhere |
|---|---|---|
| Web app (`apps/web`) | Cloudflare | Static files. Nothing to run. |
| API (`apps/api`) | A Node host — Fly.io, Railway, Render | Fastify holds a Postgres connection pool and uses argon2 (native). Cloudflare Workers run neither. |
| Database | Neon, or the Node host's own Postgres | — |
| Uploads | Cloudflare R2 | Photos of a leak and receipts must outlive a container. |

## What is already wired

Cloudflare builds from GitHub. The root `wrangler.jsonc` tells it which app in the
workspace to ship — without that it stops at *"application detection logic has been
run in the root of a workspace"*, which is the error you hit.

Build settings in the Cloudflare dashboard:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** leave empty — the root `wrangler.jsonc` handles it

## The gap: `VITE_API_URL`

**Cloudflare serves the web app only. There is no API behind `/api` there.**

Unset, the app calls `/api` on its own origin. On Cloudflare that path hits the SPA
fallback and returns `index.html` with a 200. The client now recognises this and
raises `api_unreachable` (*"אין חיבור לשרת"*) instead of an unexplained JSON parse
error — but the app still cannot sign anyone in.

So: deploy the API first, then set `VITE_API_URL=https://api.miftan.co.il` as a
Cloudflare build environment variable and redeploy. It is read at build time, not
run time; changing it needs a rebuild.

Two knock-on settings once the API has a hostname:

- `WEB_ORIGIN` on the API must be the Cloudflare origin, for CORS.
- `COOKIE_PATH` becomes `/auth` when the API is on its own hostname. It is
  `/api/auth` only because the Vite dev proxy mounts it under `/api`.

If the API and the web app end up on different hostnames, the `sameSite=lax`
refresh cookie will not be sent and every reload will look like a signed-out
session. Put the API on a subdomain of the same registrable domain
(`api.miftan.co.il` + `miftan.co.il`) and it works.

## R2

The driver is `apps/api/src/storage/r2.ts`. It signs a 15-minute PUT so the bytes
go straight from the client to R2 and never through the API process.

Five variables, all required together (`apps/api/.env.example` has them):

```
R2_ACCOUNT_ID  R2_BUCKET  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_PUBLIC_URL
```

`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` come from **R2 → Manage R2 API Tokens →
Create API token → Object Read & Write**. A Cloudflare API token (`cfut_…`) is a
different credential and cannot sign an S3 request.

The bucket needs a public read origin for `R2_PUBLIC_URL` — either a custom domain
on the bucket, or its `r2.dev` subdomain. Uploads are keyed by UUID, so filenames
never come from the client.

With none of these set the API writes to `apps/api/uploads` in development, and
**refuses to boot** in production rather than writing a tenant's evidence to a
filesystem that the next deploy throws away.

## Agent tracing

Cloudflare's `agent-setup/tracing.md` configures `observability.traces` for a
**Worker running agent code**. Miftan's Cloudflare deployment is static assets with
no `main` — there is no Worker and no agent turn to trace. Enabling it here would
be configuration that does nothing. If the API ever moves onto Workers, revisit it.
