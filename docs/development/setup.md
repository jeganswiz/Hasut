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
pnpm dev:down --infra  # also stop Redis, Postgres, MinIO, and MediaMTX (live on :8888 / :8889)
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

The seed loads configuration plus a demo neighborhood (members, professionals, businesses, connections, chats, and notifications). Story soundtracks play when the audio files are on the active storage. The default is server disk (`MEDIA_STORAGE=local`). `MEDIA_STORAGE=s3` seeds MinIO from the `S3_*` variables instead.

Local admin login at http://localhost:3002/login: `admin@hasut.local` / `Chennai-Patron-42`. The seeded admin has two-step verification on, so the password step is followed by a phone code — console OTP `123456`. Phone-only sign-in with `7010358490` still works. Set `ADMIN_BOOTSTRAP_PHONE` and `DEV_OTP_CODE` in `.env`.

`pnpm db:migrate` is for creating new migrations during later sprints (`prisma migrate dev`).

## Run apps (manual)

On a phone browser, HASUT can be installed as a PWA (Chromium install prompt, or Add to Home Screen on iOS). The service worker does not cache API or media.

`pnpm dev:up` also starts MediaMTX so live ingest is available: HLS on port 8888 and WHIP on port 8889. WebRTC media uses port 8189 on both UDP and TCP, because Docker Desktop often drops the UDP path and the HLS playlist stays missing until ICE connects. The web app proxies `/media/hls` and `/media/whip` to those ports. The browser rewrites the WHIP answer before applying it, and prefers H.264 so the HLS muxer can include video. A viewer waits without requesting the missing playlist directly, so the console stays quiet until `#EXTM3U` exists.

Launch path (`pnpm dev:up` or):

```bash
pnpm --filter @hasut/api dev
pnpm --filter @hasut/web dev
pnpm --filter @hasut/admin dev
```

`apps/mobile` is **parked** until after web launch. Expo SDK 57 still opens in current Expo Go if you opt in. Windows cannot run the iOS Simulator; use Expo Go on a phone on the same Wi-Fi. Point Metro and the API at your PC's LAN IPv4 (not `localhost`):

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

## Public web tunnel (ngrok)

With the member web app already listening on port 3000:

```bash
ngrok config add-authtoken <token>
pnpm dev:ngrok
```

The token comes from the ngrok dashboard (https://dashboard.ngrok.com/get-started/your-authtoken) and stays in your user config, not in this repo. Install the agent first if the command is missing: `winget install --id Ngrok.Ngrok -e`.

`pnpm dev:ngrok` forwards a public `https://<subdomain>.ngrok-free.app` URL to `127.0.0.1:3000`. Next allows those dev origins. Browser REST uses that same origin, and the Next `/api` rewrite reaches the local API. Loopback and private-LAN media URLs in API responses are rewritten onto the tunnel origin.

This publishes the local dev stack, including the console OTP and demo accounts, to anyone with the URL. Stop the tunnel when you are done. Chat and live sockets are not proxied through it.

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

`GEOCODER_PROVIDER` defaults to `console` (nearest-city approximation). `MEDIA_STORAGE=local` stores uploads on the API server and serves them over HTTP. `memory` is rejected in production. Admins change the live backend under Storage (server disk, S3, Backblaze B2, Wasabi, Cloudflare R2, DigitalOcean Spaces, or MinIO). If files already exist, the switch asks before copying them and keeps a per-file log.

Optional discovery basemap keys: `MAPTILER_API_KEY` (MapTiler Satellite) and `STADIA_API_KEY` (Stadia Satellite). Empty keys skip those layers. Esri World Imagery is the satellite map when no key is set. Admins pick the primary provider under Discovery without a redeploy.

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
