# Security overview

Phase 1 security baseline. Aligns with OWASP ASVS / API Top 10 at a practical SaaS level.

## Identity and session

- OTP hashed at rest; plaintext only in SMS or email and never logged.
- Passwords hashed with Argon2id; the hash never enters a DTO and never reaches a client.
- Password login, registration, OTP request/resend, and forgot password sit behind `CaptchaVerifier`.
- Unknown email and wrong password return the same `UNAUTHENTICATED` envelope; forgot password answers uniformly. Neither endpoint confirms that an account exists.
- Password reset is two-legged: OTP first, then a single-use short-lived ticket. The OTP is never replayed as a bearer credential.
- Forgot password sends nothing when the address has no account, so it is not an outbound SMS/email relay, while the response stays identical.
- Changing or resetting a password revokes every session for that member, including the caller's.
- Two-step verification for staff: email + password issues no session on its own when the flag is on.
- SSO tokens are verified server side against the provider; provider secrets stay on the API.
- Refresh rotation; reuse detection revokes the session family.
- Multi-device; explicit logout-all.
- Suspended members fail all authenticated routes with `ACCOUNT_SUSPENDED`.
- Admin role changes, password changes, resets, SSO links, and two-step toggles are audited.

## Authorization

- RBAC: Member, Admin, Support Agent, Moderator.
- Resource checks in services (object owner, connection ACCEPTED, ticket participant).
- Guards are necessary but not sufficient.

## Privacy

- No public phones and no public emails.
- OTP receipts return a masked `destinationHint` only, so a receipt cannot be used to read back the address it was sent to.
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

- Helmet on the API (`contentSecurityPolicy` in production, `X-Content-Type-Options` via Helmet defaults).
- Playwright smoke: member chrome on web and admin login chrome (`pnpm test:e2e`).
- Public member, discovery, report, ticket, and admin member payloads omit phone and exact lat/lng.
- Story/live URLs are playback pointers; they do not expose phone or exact coordinates.
- Story and live audience (`EVERYONE` or `PATRONS`) is enforced in `StoriesService`, not in a guard, and on both read paths: reading a member's stories and rendering map pin previews. A Patrons-only post never surfaces as a pin preview to a viewer who could not open it, and a signed-out viewer is treated as nobody's Patron. Patrons means accepted connections only — a `PENDING` request does not grant access.
- `GET /stories/:memberId/live` strips `ingestUrl`. Only `GET /me/live` and admin moderation return the WHIP URL. Ingest uses `LIVE_WHIP_BASE_URL` (port 8889), separate from the HLS origin. The web app proxies `/media/hls` and `/media/whip` to those origins. The API also proxies `GET`/`HEAD` `/media/hls` to the HLS origin only, after refusing path traversal, so a phone can fetch a relative playlist against `EXPO_PUBLIC_API_URL`. The proxy does not forward cookies and does not log playlist bodies. The owner’s browser publishes to that URL and does not render it. Ending the broadcast deletes only a WHIP session URL on that same ingest origin, or the matching `/media/whip` path when ingest was proxied. SDP offers and answers are not logged.
- A video story is stored as `PENDING` until a playlist exists. Members cannot mark it ready. The playback worker may set `READY` only after it has stored a public HLS playlist. Map pins skip a pending video so a dead playlist is not promoted over an image. The mobile viewer reads the same audience-filtered endpoints and attaches `expo-video` only to an absolute `http(s)` playlist. A live on the phone waits until that document is `#EXTM3U`. A relative `/media/hls` path is fetched only against the API origin (Nest HLS proxy), never against MediaMTX ports on the device. Added soundtrack plays through `expo-audio` only on an absolute `http(s)` file; KEEP on video still drops that track. The Expo audio plugin does not request microphone access. Mobile map pins fetch only an absolute preview playlist and play it muted, with a three-decoder cap; they do not expose phone or exact coordinates. Native pin autoplay reads the radio type from `expo-network` and does not call the public-IP helper. The mobile composer publishes through the same owner endpoints as the web composer. Live ingest (WHIP) is not opened from the phone.
- Story captions are member content and are not written to the audit trail; entries record whether a caption exists, not its text.
- Story and live publishing is capped by `story.policy`: active stories, stories per hour, and live starts per hour. A member cannot flood the map by retrying faster than those caps.

## Secrets

- Environment variables / secret manager. Never commit `.env` values.
- `.env.example` keys only.
- OTP provider keys, JWT keys, S3, DB URLs.
- SMTP credentials, `RECAPTCHA_SECRET_KEY`, and `FACEBOOK_APP_SECRET` are server side only. Site keys and OAuth client IDs are public by design and ship through `GET /auth/config`.

## Abuse

- OTP per-destination (phone or email) and per-IP limits.
- Password attempt cap per hour, tracked separately from OTP limits.
- Report rate limits.
- Discovery query rate limits to reduce location triangulation.

## Logging and audit

- No OTP, passwords, reset tickets, SSO tokens, captcha tokens, or exact location in application logs.
- Admin mutations → `audit_logs` with redaction policy.
- `request_id` on every log line.

## Web and mobile clients

- Web: httpOnly Secure SameSite cookies for refresh when applicable; XSS-aware CSP.
- Mobile: SecureStore via `packages/auth`; no tokens in Redux persist or logcat.
- Certificate pinning is optional later; not a Phase 1 blocker.

## Threat notes (accepted for Phase 1)

- Users may exchange contact info in chat; we do not police it.
- Approximate map markers can still leak neighborhood; cell size is a config tradeoff.
- Console OTP adapter is a critical misconfiguration risk — production boot must refuse it. The same rule covers `EMAIL_PROVIDER=console` and `CAPTCHA_PROVIDER=none`; `packages/config` fails validation rather than booting insecure.
- SSO trusts the provider's email verification. A provider account takeover is an account takeover here too; two-step verification is the mitigation for staff.
- Registration returns `CONFLICT` for an email that already exists, so it is a weak account-existence oracle. Captcha and rate limits are the mitigation; the alternative (silent success) is worse for real users.
