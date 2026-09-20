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

**Status:** Implemented.

## Sprint 2 — Members, media, profiles, location

- `users`, `media`, `profiles`, `locations`
- Personal profile CRUD, photo, bio, mode, status text
- Exact location write; public approximation
- Presigned uploads

**Exit:** Authenticated member sets profile + location; public profile hides phone and exact coordinates.

**Status:** Implemented. Public profiles omit phone and exact coordinates. Web/mobile profile editors remain a Sprint 8 gap.

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

Member identity request already existed; this sprint completed operator decide, hide, templates, and support.

- Identity verification request + admin decide (`APPROVE` / `REJECT`); never label identity as skill verification
- Reports, blocks, basic content hide / dismiss
- Notification templates CRUD (config-driven) + existing in-app feed
- Support tickets, messages, assignment, internal notes, escalation
- Configurable support categories (seeded; not hardcoded in UI)
- Thin admin queues so the Sprint 6 E2E path works before the Sprint 7 chrome rewrite

**Exit:** Member requests verification and opens a ticket; admin/moderator/support can act; events audited.

**Status:** Implemented. Identity request already existed. Admin decide, content hide/dismiss, notification template updates, support tickets (messages, assign, notes, escalate), seeded support categories, and ops summary counts are live. Thin admin queues and member support/verification screens exist; Admindek chrome is Sprint 7.

## Sprint 7 — Admin console completeness + operations chrome

- All admin capabilities in `apps/admin` from [admin architecture](../architecture/06-admin.md)
- **Admindek-inspired chrome** (not a clone): collapsible left sidebar with grouped, role-filtered nav; top bar with search, appearance toggle, notifications, role badge, logout; dense tables
- Dashboard KPI cards from **real counts only**: pending verifications, open reports, open tickets, suspended members — no fake revenue, conversion, device pie, world map, or sentiment
- Theme editor + publish + contrast warnings + cache bust + HASUT `logoUrl` (`THEME_LOGO`)
- Feature flags, remote config, discovery config
- Audit log viewer
- Members search/detail: suspend/restore, roles, session revoke
- HASUT logo + wordmark in the sidebar

**Exit:** Admin E2E path works: login → user search → verification approve → audit entry visible. Every screen has loading/empty/error/success.

**Status:** Implemented. Sidebar + top bar + KPI cards from `/admin/ops/summary`. Members, professionals, businesses, verification, reports, support, theme (draft/publish + contrast warnings), flags, templates, and audit tables. Role-filtered nav. HASUT logo in the sidebar. Phase 2 adds a Stories queue under Trust.

## Sprint 8 — Design system and native-like member UX

- `packages/ui` primitives on tokens, including `Avatar`, logo mark, and circular **map avatar pins**
- Web + mobile discovery map, sheet, nearby cards, search — polished empty/error/GPS-denied states
- HASUT logo (SVG default; overridable by published `logoUrl`); remote theme on web (not boot defaults only)
- Native-like responsive chrome: bottom tabs on small viewports (Map, Connections, Inbox, Notifications, Me); safe-area; 44px targets; PWA manifest
- Profile / location editor (“Me”) on web and mobile
- Map pins are rounded profile circles (photo or initials). Ring encodes current mode / availability / Socket.IO presence — **not** stories or live video
- Close Phase 1 catalog gaps if still open: service offerings (no booking) and review write path for connected members

**Exit:** Member E2E path works on mobile-width web and Expo: OTP → profile → location → map avatars → connect → chat.

**Status:** Implemented. `Avatar` + `HasutLogo` in `@hasut/ui`. Web bottom tabs, PWA manifest, remote theme boot, `/me` profile + location editor, circular map avatar pins. Service offerings and connected-member review write path. Expo tabs + Me screen + circular pin chips.

## Sprint 9 — Hardening

- Playwright critical flows (member + admin)
- Security review (headers, PII, uploads, OTP abuse)
- Performance pass on nearby query (explain analyze)
- Documentation sync

**Exit:** CI E2E green; security notes updated; no known PII leaks on public endpoints.

**Status:** Implemented. Playwright member chrome smoke (`pnpm test:e2e`). Helmet headers already on the API. Public member/admin payloads omit phone and exact coordinates. Nearby query notes in [discovery performance](../development/discovery-performance.md).

## Sprint 10 — Identity and access

Raises sign-in from phone-only OTP to a full identity surface across web, admin, and mobile. Still one `Member`; still no new deployable.

- Contracts first: email/password, OTP channel, SSO, two-step verification, reset ticket, and captcha config in `packages/types`, `packages/validation`, `packages/api-client`
- Prisma: nullable phone, `email` / `password_hash` / `two_factor_enabled` on `Member`, OTP `channel` and new purposes, `member_identities` for SSO
- Provider seams: `EmailProvider` (SMTP / console), `CaptchaVerifier` (reCAPTCHA / none), `OAuthProvider` (Google, Facebook), all config-selected
- `CredentialsService` owns password login, registration, SSO linking, reset tickets, and two-step verification, with authorization and audit in the service
- `packages/ui`: six-box `OtpInput`, `PasswordField`, `AuthCard`, `AuthTabs`, `SsoButton`, `TextField` on design tokens
- Web: sign in (password / code / SSO), register, forgot and reset password
- Admin: staff chrome, email + password first step, phone code second step for 2FA-enabled staff
- Mobile: password and OTP parity plus forgot password on the same contracts

**Exit:** lint, typecheck, and unit tests green; production boot refuses console email and disabled captcha; no endpoint distinguishes an unknown account from a wrong password; docs synced.

**Status:** Implemented. See [authentication](../architecture/03-authentication.md) and [security](../security/overview.md).

## What each sprint must not do

Pull in payments, booking, subscriptions, CRM, or a second deployable HASUT service during Phase 1. Stories, video trim, music, and live HLS belong to Phase 2 after Sprint 9.

## Sprint 11 — Story composer

Implemented. Authoring on the Activity tab reaches the bar the product asked for, and two contract fields that were being silently discarded now persist.

- Contracts: `caption`, `captionColor`, `audio` (source / track / segment), `originalAudioMode`, trim window, `AudioTrackView`, and `StoryComposerConfig` in `packages/types`, `packages/validation`, `packages/api-client`.
- Prisma: caption, caption colour, trim, and soundtrack columns on `Story`; `title` on `LiveSession`; new `AudioTrack` catalogue. Migration `20260921010000_story_composer` backfills `audio_source` for stories that already carried an uploaded track.
- **Bug fixed:** `storyCreateSchema` accepted `trimStartSeconds` / `trimEndSeconds` and `liveStartSchema` accepted `title`, but neither reached the database — the service never took the fields and the columns did not exist. Both now round-trip, with regression tests.
- API: `StoriesService` validates caption length, palette membership, trim span, and audio span against `story.policy`; `AudioLibraryService` serves the member-facing catalogue and the staff CRUD. Caption text stays out of the audit trail — entries record `hasCaption`, not the words.
- `packages/ui`: `RangeSelect` (two-handle scrubber over two native range inputs, so keyboard and screen readers work), `ColorSwatches`, and `SegmentedTabs` (the old `AuthTabs`, renamed now that stories use it too). Range maths lives in a pure `range-select.logic` module with its own tests.
- Web: `/story` gains Activity / Live tabs, a live caption overlay on the preview, palette swatches, a mood-filtered audio picker with segment selection, and a trim scrubber. Live now sends its title.
- Admin: `/stories/audio` curates the catalogue; the moderation queue shows caption, live title, and how a story will sound.

## Sprint 12 — Live and audience

Implemented. A story or a live can be kept to **Patrons** — HASUT's word for accepted connections, from חסות (patronage). It is deliberately not "follower": the relationship is mutual and consented, so there is no one-way subscribe.

- Contracts: `StoryAudience` (`EVERYONE` | `PATRONS`) on story create, story view, live start, and live view. `StoryComposerConfig` carries `patronCount` so the picker can label the option honestly.
- Prisma: `audience` on `stories` and `live_sessions`, migration `20260921020000_story_audience`. Existing rows were published unrestricted, so `EVERYONE` is the only safe backfill.
- `PatronsService` is the single definition of the relation: accepted connections, symmetric, and a member is always their own Patron. Audience checks read from it rather than querying connections inline, so there is one place to audit.
- **Authorization fixed:** `GET /stories/:memberId` previously returned every story for any authenticated caller, because it called `listMine` with the path parameter. It now goes through `listForViewer`, which filters on audience.
- Map pins go through `pinMediaForMembers(ids, viewerId)`, resolving Patron status for a whole screen in one query. A Patrons-only story or live no longer leaks as a pin preview to someone who could not open it, and a signed-out viewer is nobody's Patron.
- Web: an audience picker on both the Activity and Live tabs, with copy that warns when a member has no Patrons yet. Admin's moderation queue shows the audience alongside caption and sound.
- Watch path: `GET /me/live` restores the owner's session after a refresh (ingest URL stays on the owner). `GET /stories/:memberId/live` is the nearby watch URL — Patrons-only lives are invisible to a stranger, and ingest is always stripped. The viewer at `/stories/[memberId]` shows caption colour, the chosen audio window, trim looping, and a Live tab with the title.

## After Phase 1

[Phase 2 presence stories and live](./phase-2-scope.md) is implemented behind `stories.live`: map pin priority LIVE → video → image → profile; HLS viewer buffering; optional MediaMTX compose profile. After that: Protected Service design, marketplace, billing, multi-city operations, skill verification productization.
