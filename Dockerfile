# The API. The web app is static and goes to Cloudflare; this is the half that
# needs a Node runtime, a Postgres pool, and argon2's native binding.
FROM node:24-slim AS deps
WORKDIR /app

# Only the manifests, so a source-only change does not reinstall the world.
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/fixtures/package.json packages/fixtures/
# The web app is not built here, but npm needs its manifest to resolve the
# workspace graph the lockfile was written against.
COPY apps/web/package.json apps/web/
# npm hoists to the root node_modules, but a package with awkward peers can
# still nest one under the workspace. mkdir makes the COPY below valid either
# way, rather than depending on which of the two npm chose today.
RUN npm ci --omit=dev --workspace @miftan/api --include-workspace-root \
 && mkdir -p apps/api/node_modules


FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json ./
COPY packages/shared ./packages/shared
COPY packages/fixtures ./packages/fixtures
COPY apps/api ./apps/api

WORKDIR /app/apps/api

# The source is TypeScript and stays that way: tsx strips the types at load.
# There is no build artifact to drift from the source that produced it.
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
