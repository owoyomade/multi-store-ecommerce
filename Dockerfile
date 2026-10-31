# Production image, for hosting on any container platform (Azure Container
# Apps, Fly.io, Railway, a VPS...). Vercel doesn't use this file.
#
#   docker build -t storefront-studio .
#   docker run -p 3210:3210 --env-file .env.production storefront-studio
#
# Database migrations are a separate step, run from a checkout of this
# repository before starting a new version (see docs/runbook.md):
#   DIRECT_URL="<direct database url>" npx prisma migrate deploy

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which needs the schema copied above.
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder settings so the build can load the app's modules. They are not
# secrets and are never used at runtime: real values come from the platform.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    APP_URL="http://localhost:3210" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-real-secret-000" \
    SMTP_HOST="localhost" SMTP_PORT="25" EMAIL_FROM="build@example.test" \
    NEXT_OUTPUT_STANDALONE="1" \
    NEXT_TELEMETRY_DISABLED="1"
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV="production" PORT="3210" HOSTNAME="0.0.0.0" NEXT_TELEMETRY_DISABLED="1"
# Run as an unprivileged user, so a compromised app can't change the image.
RUN addgroup -S app && adduser -S app -G app
# The standalone build holds only the files the server needs.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3210
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3210/api/health || exit 1
CMD ["node", "server.js"]
