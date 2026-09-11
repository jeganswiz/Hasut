# Authentication architecture

## Goals

- Phone OTP login for members (India first).
- No business logic coupled to MSG91, Twilio, or any single vendor.
- No raw OTP storage.
- Short-lived access tokens, rotating refresh tokens, multi-device sessions.
- Rate limits, cooldowns, attempt caps, and abuse controls.

## Provider abstraction

HASUT owns challenge lifecycle. SMS vendors send messages; they do not own HASUT session policy.

```ts
export interface OtpProvider {
  sendOtp(input: SendOtpInput): Promise<SendOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  resendOtp(input: ResendOtpInput): Promise<SendOtpResult>;
}
```

Two adapter styles are supported without leaking into services:

| Style                                      | When                                | HASUT still owns                                                                                    |
| ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Transport** (default for MSG91)          | Provider is SMS delivery            | Generate OTP, hash, expiry, attempts, verify locally                                                |
| **Delegated verify** (Twilio Verify later) | Provider generates and checks codes | Map provider results to the same `verifyOtp` contract; still enforce HASUT rate limits and sessions |

`auth` selects the adapter from configuration (`OTP_PROVIDER=msg91|twilio|console`). The `console` adapter is local-dev only and must be impossible to enable in production.

Phase 1 ships: `Msg91OtpProvider` + `ConsoleOtpProvider`. Twilio is an interface-compatible stub folder, not a working integration.

## OTP challenge (HASUT-owned)

Table `otp_challenges` (see ERD):

- `phone_e164` (or a keyed hash if we later tighten storage; Phase 1 stores E.164 only on this restricted table, never in public APIs)
- `code_hash` (Argon2id or bcrypt; **never** plaintext)
- `purpose` (`LOGIN`, `REAUTH`)
- `expires_at`
- `attempt_count`
- `max_attempts` from remote config, not a magic number in code
- `last_sent_at` for resend cooldown
- `consumed_at`

Rules (values from `configuration`, not source literals):

- Expiry window
- Resend cooldown
- Max attempts per challenge
- Max challenges per phone per hour
- Max challenges per IP per hour

On success: consume challenge, upsert `members` by phone, issue session.

## Sessions

| Token      | Storage                                                                | Life                           |
| ---------- | ---------------------------------------------------------------------- | ------------------------------ |
| Access JWT | Memory / Authorization header (mobile); optional httpOnly cookie (web) | Minutes, from config           |
| Refresh    | Hashed in `sessions.refresh_token_hash`                                | Days, rotated on every refresh |

`sessions` columns: `id`, `member_id`, `device_id`, `refresh_token_hash`, `expires_at`, `revoked_at`, `ip`, `user_agent`, `last_seen_at`.

Rotation: refresh succeeds → new refresh hash → old hash invalid. Reuse of a revoked/old refresh revokes the **family** (session row) and is audited.

Logout: revoke one session or all sessions for the member.

## API surface (auth)

All under `/api/v1/auth`:

- `POST /otp/request`
- `POST /otp/verify`
- `POST /otp/resend`
- `POST /token/refresh`
- `POST /logout`
- `POST /logout-all`
- `GET /sessions`

Phone numbers never appear in discovery, profile, or chat payloads. Support/admin views of phone are authorized, audited, and not copied into client logs.

## Client adapters (`packages/auth`)

- Web: prefer httpOnly secure cookies for refresh if same-site; access in memory.
- Mobile: refresh and access in Expo SecureStore via an interface; never AsyncStorage for tokens.
- Admin: same as web with role claim `ADMIN` | `SUPPORT_AGENT` | `MODERATOR`.

## Abuse prevention

- Redis (or equivalent) rate limiter keyed by phone, IP, and device.
- Exponential backoff after failed verifies.
- Device/session cap from config.
- File and OTP endpoints isolated from general API quota.

Details: [Security](../security/overview.md).
