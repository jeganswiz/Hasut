# Phase 1 sprint breakdown and development order

Sprints assume roughly one focused delivery increment each. Do not start a sprint until the previous foundation is merged and tests are green. Implementation begins only when requested, starting at Sprint 0.

## Development order (strict)

1. Monorepo, tooling, compose, CI, docs already here
2. Prisma + PostGIS + configuration/audit skeletons
3. Auth (OTP abstraction, sessions)
4. Users, roles, suspend
5. Media presign
6. Categories + current modes (admin-seeded)
7. Profiles + location privacy
8. Professionals, businesses, service offerings
9. Reviews aggregates (write path if time; read path required for rank)
10. Discovery + ranking config
11. Connections + messaging
12. Verification identity
13. Reports/blocks + notifications + support
14. Admin console (can start shell earlier, complete here)
15. Design system + web/mobile discovery UX
16. E2E, security pass, staging

Admin **theme/flags** can land with configuration in step 2–3 so apps boot on tokens from day one of UI work.

## Sprint 0 — Repository bootstrap

**Goal:** Empty apps that build; local data stores; CI.

- pnpm workspaces, Turborepo pipelines
- TypeScript strict on all packages
- `apps/api` NestJS hello + health
- `apps/web`, `apps/admin` Next.js shells
- `apps/mobile` Expo shell
- Package stubs with public exports
- docker-compose: Postgres+PostGIS, MinIO, Redis
- `.env.example`, lint, typecheck, unit placeholder, CI
- Seed pipeline hook (no hardcoded categories in app code)

**Exit:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` succeed locally and in CI. Infra: Compose PostGIS + Redis + MinIO; API `/health/ready` and `/api/v1/health/ready`.

**Status:** Implemented.

## Sprint 1 — Configuration, audit, auth

- `configuration` + `audit` modules
- Theme payload + flags + ranking weight row
- `OtpProvider` + MSG91 adapter + console adapter
- OTP request/verify/resend, session, refresh rotation, logout
- Rate limits on auth

**Exit:** Member can obtain tokens in development via console OTP; production config refuses console provider.

## Sprint 2 — Members, media, profiles, location

- `users`, `media`, `profiles`, `locations`
- Personal profile CRUD, photo, bio, mode, status text
- Exact location write; public approximation
- Presigned uploads

**Exit:** Authenticated member sets profile + location; public profile hides phone and exact coordinates.

## Sprint 3 — Catalog: categories, professionals, businesses, services

- Admin-managed categories (API first; admin UI can be thin)
- Become professional; multiple categories; skills; service area
- Business create/own; hours JSON; categories
- Service offerings without booking

**Exit:** Professional and business records exist and serialize safely.

**Status:** Categories, professional onboarding, service area, availability, professional status, and identity verification requests are implemented. Business listings (create + public profile) landed with Sprint 4 discovery. Service offerings remain for a later increment. Paid subscriptions are out of scope.

## Sprint 4 — Discovery and search

- Nearby people, professionals, businesses
- Keyword, category, distance, verified, available
- Ranking service reading admin weights
- Map-friendly DTOs (bucketed distance, no exact people points)

**Exit:** Ranked nearby list + search filters; ranking weights change without deploy (config).

**Status:** Implemented. `GET /api/v1/discovery/nearby`, `/discovery/search`, `/discovery/preview/:kind/:id`, and `/config/discovery` rank PostGIS candidates with admin weights. Web and mobile are map-first; admin `/discovery` edits defaults and weights without a deploy. People pins are snapped; payloads use `pinLat`/`pinLng` and bucketed distance.

## Sprint 5 — Graph: connections and messaging

- Request / accept / reject
- 1:1 messages text+image, reads, timestamps
- Block implies no connect/chat

**Exit:** Two members connect and chat.

**Status:** Implemented. Architecture uses connections (request/accept), not a follow graph. REST covers history and sync; Socket.IO `/ws/v1/messaging` pushes message, read, connection, and notification events with client reconnect + token refresh. Block cancels pending requests and forbids connect/chat. Peer/chat payloads omit phone numbers. Report reasons and messaging limits come from configuration.

## Sprint 6 — Trust, notify, support

- Identity verification request + admin decide
- Reports, blocks, basic content hide
- Notification templates + in-app feed
- Support tickets, messages, assignment, internal notes, escalation
- Configurable support categories

**Exit:** Member requests verification and opens a ticket; admin can act; events audited.

## Sprint 7 — Admin console completeness

- All admin capabilities in `apps/admin`
- Theme editor + publish + cache bust
- Feature flags, remote config, discovery config
- Audit log viewer
- Suspend/restore

**Exit:** Admin E2E path works: login → user search → verification approve → audit entry visible.

## Sprint 8 — Design system and member UX

- `packages/ui` primitives on tokens
- Web + mobile discovery map, sheet, nearby cards, search
- Profile, professional, business screens
- Loading/empty/error/success everywhere touched

**Exit:** Member E2E path works on at least one client (mobile preferred) plus web.

## Sprint 9 — Hardening

- Playwright critical flows
- Security review (headers, PII, uploads, OTP abuse)
- Performance pass on nearby query (explain analyze)
- Documentation sync

**Exit:** CI E2E green; security notes updated; no known PII leaks on public endpoints.

## What each sprint must not do

Pull in payments, booking, subscriptions, live, CRM, or a second deployable service.

## After Phase 1

Only then: Protected Service design, marketplace, billing, multi-city operations, skill verification productization.
