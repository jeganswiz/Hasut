# Security overview

Phase 1 security baseline. Aligns with OWASP ASVS / API Top 10 at a practical SaaS level.

## Identity and session

- OTP hashed at rest; plaintext only in SMS and never logged.
- Refresh rotation; reuse detection revokes the session family.
- Multi-device; explicit logout-all.
- Suspended members fail all authenticated routes with `ACCOUNT_SUSPENDED`.
- Admin role changes are audited.

## Authorization

- RBAC: Member, Admin, Support Agent, Moderator.
- Resource checks in services (object owner, connection ACCEPTED, ticket participant).
- Guards are necessary but not sufficient.

## Privacy

- No public phones.
- No default exact personal coordinates (see [location](../architecture/04-location.md)).
- Chat is not a phone-number leak prevention product; do not build aggressive regex blockers. Protected Service is a future value proposition, not a Phase 1 filter.

## Injection and data

- Prisma parameterized queries only.
- PostGIS via tagged parameters, never string-built SQL from client input.
- Zod validation on all inputs (query, body, params).

## Media

- Presigned PUT to S3 with content-type and size cap from config.
- Complete endpoint verifies HEAD/size/mime/magic bytes where feasible.
- Allowlist: jpeg, png, webp, heic (if we support). No SVG in chat (XSS).
- Verification documents: private ACL, not CDN-public.

## HTTP

- CORS allowlist per environment.
- Security headers (CSP for web/admin, HSTS in production, `X-Content-Type-Options`, frame deny).
- Rate limits: auth, discovery, media, messaging, reports separately.

## Secrets

- Environment variables / secret manager. Never commit `.env` values.
- `.env.example` keys only.
- OTP provider keys, JWT keys, S3, DB URLs.

## Abuse

- OTP per-phone and per-IP limits.
- Report rate limits.
- Discovery query rate limits to reduce location triangulation.

## Logging and audit

- No OTP, tokens, or exact location in application logs.
- Admin mutations → `audit_logs` with redaction policy.
- `request_id` on every log line.

## Web and mobile clients

- Web: httpOnly Secure SameSite cookies for refresh when applicable; XSS-aware CSP.
- Mobile: SecureStore via `packages/auth`; no tokens in Redux persist or logcat.
- Certificate pinning is optional later; not a Phase 1 blocker.

## Threat notes (accepted for Phase 1)

- Users may exchange contact info in chat; we do not police it.
- Approximate map markers can still leak neighborhood; cell size is a config tradeoff.
- Console OTP adapter is a critical misconfiguration risk — production boot must refuse it.
