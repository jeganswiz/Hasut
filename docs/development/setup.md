# Local development setup

Open the generated HTML guide in a browser: [setup.html](./setup.html) (installation, scripts, ports, and environment in one page).

## Prerequisites

- Node.js 22.14+ (see `.nvmrc`)
- pnpm 10.15+ (`corepack enable` then `corepack prepare pnpm@10.15.1 --activate`, or `npx pnpm`)
- Docker Engine with Compose v2 (PostgreSQL/PostGIS, Redis, MinIO)

## Install

```bash
pnpm install
cp .env.example .env
```

`pnpm install` generates the Prisma client (`apps/api` postinstall) and installs Husky hooks.

## One command

Redis runs in Docker only (not a local Redis install). Postgres/PostGIS and MinIO use the same Compose file because the API needs them. API, web, and admin run on the host.

```bash
pnpm dev:up
```

Windows: `.\scripts\dev-up.ps1`. macOS/Linux: `./scripts/dev-up.sh`.

| Flag             | Meaning                                               |
| ---------------- | ----------------------------------------------------- |
| `--skip-seed`    | Do not seed demo data                                 |
| `--seed`         | Re-run seed even if demo data already exists          |
| `--infra-only`   | Start Docker data stores, migrate, seed; skip apps    |
| `--skip-install` | Skip `pnpm install` even if `node_modules` is missing |

The script starts Docker Desktop if the daemon is down, waits until Redis answers `PONG`, then prints URLs when health checks pass. Ctrl+C stops the apps; Docker Redis stays up.

```bash
pnpm dev:down          # stop API / web / admin
pnpm dev:down --infra  # also stop Redis, Postgres, MinIO
```

## Infrastructure (manual)

Start data stores:

```bash
pnpm infra:up
```

This starts PostgreSQL 16 + PostGIS, Redis 7, and MinIO (bucket `hasut-media`). Redis is the Compose `redis` service on port 6379 — do not run a second Redis on the host.

Apply migrations and seed the bootstrap row:

```bash
pnpm db:migrate:deploy
pnpm db:seed
```

The seed loads configuration plus a demo neighborhood (members, professionals, businesses, connections, chats, and notifications).

Local admin login at http://localhost:3002/login: `admin@hasut.local` / `Chennai-Patron-42`. The seeded admin has two-step verification on, so the password step is followed by a phone code — console OTP `123456`. Phone-only sign-in with `7010358490` still works. Set `ADMIN_BOOTSTRAP_PHONE` and `DEV_OTP_CODE` in `.env`.

`pnpm db:migrate` is for creating new migrations during later sprints (`prisma migrate dev`).

## Run apps (manual)

```bash
pnpm --filter @hasut/api dev
pnpm --filter @hasut/web dev
pnpm --filter @hasut/admin dev
pnpm --filter @hasut/mobile dev
```

`apps/mobile` is Expo SDK 57 so it opens in current Expo Go. Windows cannot run the iOS Simulator; use Expo Go on a phone on the same Wi-Fi. Point Metro and the API at your PC's LAN IPv4 (not `localhost`):

```bash
# PowerShell example — replace with ipconfig IPv4
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.7"
$env:EXPO_PUBLIC_API_URL="http://192.168.1.7:3001"
pnpm --filter @hasut/mobile exec expo start --go --lan
```

Then open `exp://<LAN-IP>:8081` in Expo Go.

| App                | URL                                       |
| ------------------ | ----------------------------------------- |
| API                | http://localhost:3001                     |
| Health (k8s alias) | http://localhost:3001/health/ready        |
| Health (versioned) | http://localhost:3001/api/v1/health/ready |
| OpenAPI            | http://localhost:3001/api/docs            |
| Web                | http://localhost:3000                     |
| Admin              | http://localhost:3002                     |

Full API in Docker (after lockfile exists):

```bash
pnpm infra:up:api
```

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:scripts
pnpm build
```

Sprint 0 quality gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:scripts`, `pnpm build`. CI (`.github/workflows/ci.yml`) starts PostGIS 16 and Redis 7, applies migrations, and runs the same gates.

```bash
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm --filter @hasut/api start
# GET http://localhost:3001/health/ready
# GET http://localhost:3001/api/v1/health/ready
```

Full API in Docker after data stores are up: `pnpm infra:up:api`.

Pre-commit runs lint-staged (Prettier + ESLint) via Husky.

## Environment

Copy `.env.example`. Never commit `.env`. `SENTRY_DSN` empty disables Sentry; production should set it through a secret manager.

Web and admin sign-in posts to the API at `127.0.0.1:3001` (or the same LAN host on port 3001). OTP requests are stored in Postgres (`otp_challenges`) and verified through `OtpProvider`. Local console OTP is `123456` after Send code / Continue.

Set `OTP_PROVIDER` (`console` locally; never in production) plus `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ characters). MSG91/Twilio keys are optional until that adapter is selected.

Email OTP, captcha, and SSO use the same pattern. Locally they stay off and sign-in still works:

| Variable                                                            | Local default | Notes                                                        |
| ------------------------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| `EMAIL_PROVIDER`                                                    | `console`     | `smtp` in production; console prints the code to the API log |
| `SMTP_URL`, `EMAIL_FROM`                                            | empty         | Required once `EMAIL_PROVIDER=smtp`                          |
| `CAPTCHA_PROVIDER`                                                  | `none`        | `recaptcha` in production                                    |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE` | empty         | Required once `CAPTCHA_PROVIDER=recaptcha`                   |
| `GOOGLE_CLIENT_ID`                                                  | empty         | Empty hides the Google button                                |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`                            | empty         | Empty hides the Facebook button                              |

Production boot refuses `EMAIL_PROVIDER=console` and `CAPTCHA_PROVIDER=none`, and refuses a provider whose keys are missing. Clients never read these directly — they call `GET /api/v1/auth/config` and adapt, which is why an empty client ID simply removes the button instead of rendering a broken one.

`GEOCODER_PROVIDER` defaults to `console` (nearest-city approximation). `MEDIA_STORAGE=memory` is for local/test; production must use `s3`.

Optional discovery basemap keys: `MAPTILER_API_KEY` (MapTiler Dataviz primary) and `STADIA_API_KEY` (Stadia Alidade Smooth). Empty MapTiler key skips that layer; CARTO Positron is the last fallback. Admins pick the primary provider under Discovery without a redeploy.

## Why these dependencies were added

| Package                                     | Reason                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| turbo                                       | Monorepo task graph (lint/typecheck/test/build)           |
| eslint / typescript-eslint / prettier       | Strict lint + format                                      |
| husky / lint-staged                         | Pre-commit validation                                     |
| nestjs + swagger + terminus-adjacent health | API server, OpenAPI, probes                               |
| prisma / @prisma/client                     | ORM and migrations (Prisma 6: NestJS CommonJS compatible) |
| ioredis                                     | Redis health and future rate limits                       |
| nestjs-pino / pino                          | Structured JSON logs                                      |
| @sentry/node                                | Error reporting when DSN is configured                    |
| helmet                                      | Security headers                                          |
| zod                                         | Shared validation (`packages/validation`, env parsing)    |
| axios                                       | Shared HASUT API HTTP client (`@hasut/api-client`)        |

Do not add a second HTTP client, type package, or ORM. Apps call `@hasut/api-client` (Axios). Nest vendor adapters (MSG91, Nominatim) may use platform `fetch`.
