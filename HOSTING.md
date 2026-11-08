# Hosting

## The shape of it

Everything runs in one Cloudflare Worker, `miftan`:

| Piece | Where |
|---|---|
| Web app (`apps/web`) | The Worker's static assets |
| API (`apps/api`) | The same Worker, under `/api/*` (`apps/web/worker/index.js` → `apps/api/src/worker.ts`) |
| Database | D1 database `miftan` (binding `DB`) |
| Uploads | R2 bucket `miftan-uploads` (binding `FILES`) |

There is no second host, no connection string and no API address to keep in
sync. The app and the API share one origin, so the refresh cookie is
first-party (`SameSite=lax`, path `/api/auth`) and a reload stays signed in.

## Deploying

Cloudflare Workers Builds deploys every push to main:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** leave empty — the root `wrangler.jsonc` handles it

`npm run build` also renders the demo portfolio
(`apps/api/scripts/render-demo-seed.ts`) that the Worker bundles.

CI (`verify.yml`) bundles the Worker with `wrangler deploy --dry-run`, so an
import the Workers runtime cannot load fails the PR, not the deploy.

## Database (D1)

The schema is `apps/api/src/db/schema.ts`. After changing it:

```
npm run db:generate -w @miftan/api
```

That writes SQL to `apps/api/migrations` and bundles it into
`src/db/migrations.gen.ts`. CI fails if the two drift.

Nobody runs migrations by hand. On its first request each Worker isolate
applies whatever is missing (`src/db/migrate.ts`, tracked in `__migrations`).

D1 has no interactive transactions. Writes that must land together go through
one `db.batch` (`src/db/atomic.ts`); "only if nobody beat me to it" is a
conditional update followed by `expectChanged()`, which fails the whole batch
if the update matched nothing.

### The demo data

`wrangler.jsonc` sets `DEMO_DATABASE=true` and `DEMO_MODE=true`. With
`DEMO_DATABASE`, a Worker that finds **no users at all** loads the demo
portfolio in one batch (`src/db/demo-seed.ts`). It never touches a database
with even one account in it.

To reset the live demo, empty the D1 database (Cloudflare dashboard → D1 →
`miftan` → Console, or `wrangler d1 execute miftan --remote`) and drop its
tables; the next request migrates and reseeds.

**Before the first real user:** remove `DEMO_DATABASE` and `DEMO_MODE` from
`wrangler.jsonc`, and empty the database of the demo accounts — they share a
published password.

Locally, `npm run dev:api` runs the same Worker on a local D1 under
`.wrangler/state`. `npm run db:reset` and `npm run db:seed` act on that local
copy only.

## Uploads (R2)

The client asks the API for an upload; the API answers with a signed,
15-minute, same-origin `PUT /api/uploads/<key>` link and the Worker writes the
bytes to the `FILES` bucket. Files are read back through signed
`/api/files/<key>` links. The bucket needs no public access and no CORS.

The S3 driver (`src/storage/s3.ts`) is still there: setting `S3_ENDPOINT`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` and
`S3_PUBLIC_URL` switches to direct-to-bucket uploads instead.

## Secrets

All optional. Set them with `npx wrangler secret put <NAME>` or in the
dashboard (Workers → `miftan` → Settings → Variables and Secrets). `keep_vars`
stops deploys from wiping them. Never commit one — the repository is public.

- `RESEND_API_KEY` — unset, mail is printed to the Worker log.
- `JWT_SECRET` — unset, the Worker generates one on first start and keeps it
  in D1 (`app_meta`). Setting it later signs everyone out once.
- `DEEPSEEK_API_KEY` — unset, the built-in rule parser reads search requests.

`API_URL` and `PROXY_SECRET`, left over from when the API ran elsewhere, are
no longer read and can be deleted.

## Backups and monitoring

- **Backups.** D1 Time Travel is always on: the database can be restored to
  any minute in the last 7 days (30 on a paid Workers plan). Restoring
  overwrites the database in place and prints a bookmark to undo it.

  ```
  npx wrangler d1 time-travel info miftan --timestamp=2026-11-08T09:00:00+02:00
  npx wrangler d1 time-travel restore miftan --timestamp=2026-11-08T09:00:00+02:00
  ```

  For a copy that outlives that window: `npx wrangler d1 export miftan --remote --output=miftan.sql`.
- **Uptime.** `.github/workflows/uptime.yml` checks `/` and `/api/ready`
  (Worker plus D1) every 30 minutes; GitHub emails a failed run.
- **Errors.** Worker logs are on (`observability` in `wrangler.jsonc`):
  Workers → `miftan` → Observability. Every API request is logged with its
  status and time; a 500 carries the stack.

## Limits worth knowing

- Passwords are PBKDF2-SHA256 at 50,000 iterations (`src/lib/auth.ts`), sized
  for the free plan's CPU allowance. On a paid Workers plan raise
  `PBKDF2_ITERATIONS`. The count is stored in each hash, so existing
  passwords keep verifying; they get the new count when next changed.
- D1 allows 100 bound parameters per statement. Bulk inserts go through
  `insertChunks`, and long `IN` lists through `src/db/in-list.ts`.
- Each Worker isolate builds the Fastify app on its first request; that one
  request is slower.

## Email (Resend)

After `baalabait.co.il` is on Cloudflare, add these DNS records from the Resend
dashboard (Domain → baalabait.co.il):

| Type | Name | Purpose |
|---|---|---|
| TXT | `@` | SPF (`v=spf1 include:amazonses.com ~all` or whatever Resend shows) |
| CNAME | `resend._domainkey` (or as shown) | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:privacy@baalabait.co.il` |

From: `בעל הבית <noreply@baalabait.co.il>`. Forward `support@`, `privacy@` and
`accessibility@` with Cloudflare Email Routing.
