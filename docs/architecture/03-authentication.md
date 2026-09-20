# Authentication architecture

## Goals

- Phone OTP login for members (India first), plus email OTP, email + password, and Google / Facebook SSO.
- No business logic coupled to MSG91, Twilio, reCAPTCHA, or any single vendor.
- No raw OTP storage and no raw password storage.
- Short-lived access tokens, rotating refresh tokens, multi-device sessions.
- Rate limits, cooldowns, attempt caps, captcha, and abuse controls.
- Two-step verification for staff, so an admin password alone is never enough.

## Sign-in methods

One `Member` row backs every method. Choosing a new method links to the same identity instead of creating a second account.

| Method            | Entry point                             | Notes                                                                   |
| ----------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Phone OTP         | `POST /auth/otp/request` with `phone`   | Original Phase 1 path; unchanged for existing members                   |
| Email OTP         | `POST /auth/otp/request` with `email`   | Same challenge lifecycle, `EmailProvider` delivery                      |
| Email + password  | `POST /auth/password/login`             | Argon2id hash; may return `TWO_FACTOR_REQUIRED`                         |
| Google / Facebook | `POST /auth/sso`                        | Provider token verified server side, then linked in `member_identities` |
| Password reset    | `POST /auth/password/forgot` → `/reset` | OTP first, then a short-lived ticket exchanged for the new password     |

A request carries exactly one destination. Sending `phone` and `email` together is a validation error, not a silent preference.

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

Three more vendor seams follow the same shape, each resolved by a factory from configuration so no service imports a vendor SDK:

| Interface         | Adapters                                       | Selected by        | Dev default |
| ----------------- | ---------------------------------------------- | ------------------ | ----------- |
| `EmailProvider`   | `SmtpEmailProvider`, `ConsoleEmailProvider`    | `EMAIL_PROVIDER`   | `console`   |
| `CaptchaVerifier` | `RecaptchaVerifier`, `NoopCaptchaVerifier`     | `CAPTCHA_PROVIDER` | `none`      |
| `OAuthProvider`   | `GoogleOAuthProvider`, `FacebookOAuthProvider` | client IDs present | disabled    |

`console` email and `none` captcha are local-dev only; production boot refuses both, the same rule the console OTP adapter already follows.

## OTP challenge (HASUT-owned)

Table `otp_challenges` (see ERD):

- `channel` (`SMS`, `EMAIL`) with `phone_e164` **or** `email` set, never both
- `phone_e164` (or a keyed hash if we later tighten storage; Phase 1 stores E.164 only on this restricted table, never in public APIs)
- `member_id` when the challenge was raised for a known member (two-step verification, password reset)
- `code_hash` (Argon2id or bcrypt; **never** plaintext)
- `purpose` (`LOGIN`, `REAUTH`, `PASSWORD_RESET`, `TWO_FACTOR`)
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

On success: consume challenge, upsert `members` by phone or email, issue session.

`PASSWORD_RESET` and `TWO_FACTOR` are internal purposes. The public `POST /auth/otp/request` rejects them, so the only way to mint one is the reset or password-login flow that owns it.

## Passwords

- Argon2id via `SecretHasher`; the hash never leaves the service layer and never appears in a DTO.
- Minimum length comes from `AuthPolicy.passwordMinLength`, published to clients through `GET /auth/config` so the three apps show one rule.
- Unknown email and wrong password return the identical `UNAUTHENTICATED` envelope, so the endpoint is not an account-existence oracle. `POST /auth/password/forgot` answers the same way whether or not the account exists.
- Failed attempts are rate limited per destination (`AuthPolicy.maxPasswordAttemptsPerHour`), separately from OTP limits.
- Changing or resetting a password revokes every session for that member, the caller's included, and returns the revoked count. A stolen session cannot outlive the password it was born under.

## Password reset

1. `POST /auth/password/forgot` with `phone` **or** `email` issues a `PASSWORD_RESET` challenge.
2. `POST /auth/password/reset/verify` consumes the code and returns a single-use ticket that lives for `AuthPolicy.resetTicketTtlSeconds`.
3. `POST /auth/password/reset` exchanges the ticket for the new password.

The ticket exists so the OTP is not replayed as a bearer credential on the final step. It is single use and is deleted on redemption whether or not it resolves to an account.

Step 1 records a challenge for an unknown address and returns a normal receipt, but sends no message. The response is identical either way, and the endpoint still cannot be used to text or email a stranger. A guess at the resulting code fails with the same `OTP_INVALID` as a wrong code.

## Two-step verification (staff)

`members.two_factor_enabled` is off by default and set per member. When it is on, `POST /auth/password/login` returns `{ status: "TWO_FACTOR_REQUIRED", challenge }` instead of tokens, and the caller finishes at `POST /auth/two-factor/verify`. The first step alone issues no session, so a leaked staff password is not a login. Members manage the flag through `PUT /auth/two-factor`.

## Captcha

`CaptchaVerifier` guards the unauthenticated, cost-bearing endpoints: registration, password login, OTP request/resend, and forgot password. The action name is passed through so reCAPTCHA scores can be tuned per flow against `RECAPTCHA_MIN_SCORE`. Clients read the site key from `GET /auth/config` and omit the widget entirely when the provider is `none`.

## SSO

`POST /auth/sso` takes a provider id and the token the client obtained from Google or Facebook. The API verifies that token with the provider, then upserts `member_identities` (`provider`, `provider_account_id`, `member_id`). An existing member with the same verified email is linked rather than duplicated. Client IDs are published through `GET /auth/config`; provider secrets stay server side.

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

| Route                         | Auth   | Purpose                                          |
| ----------------------------- | ------ | ------------------------------------------------ |
| `GET /config`                 | Public | Captcha site key, SSO client IDs, password rules |
| `POST /otp/request`           | Public | Phone or email code (`LOGIN` / `REAUTH` only)    |
| `POST /otp/verify`            | Public | Consume code, issue session                      |
| `POST /otp/resend`            | Public | Resend within cooldown rules                     |
| `POST /password/register`     | Public | Create a member with email + password            |
| `POST /password/login`        | Public | Session, or a two-step challenge                 |
| `POST /two-factor/verify`     | Public | Finish the two-step login                        |
| `POST /sso`                   | Public | Google / Facebook token exchange                 |
| `POST /password/forgot`       | Public | Start a reset, uniform response                  |
| `POST /password/reset/verify` | Public | Code → single-use ticket                         |
| `POST /password/reset`        | Public | Ticket → new password                            |
| `POST /password`              | Bearer | Change password for the current member           |
| `PUT /two-factor`             | Bearer | Turn two-step verification on or off             |
| `POST /token/refresh`         | Public | Rotate refresh token                             |
| `POST /logout`                | Bearer | Revoke this session                              |
| `POST /logout-all`            | Bearer | Revoke every session                             |
| `GET /sessions`               | Bearer | List active devices                              |

OTP receipts carry a masked `destinationHint` (`+91•••••43210`, `j•••n@example.com`), never the full destination. Phone numbers never appear in discovery, profile, or chat payloads. Support/admin views of phone are authorized, audited, and not copied into client logs.

## Client adapters (`packages/auth`)

- Web: prefer httpOnly secure cookies for refresh if same-site; access in memory.
- Mobile: refresh and access in Expo SecureStore via an interface; never AsyncStorage for tokens.
- Admin: same as web with role claim `ADMIN` | `SUPPORT_AGENT` | `MODERATOR`.

## Shared sign-in UI

`packages/ui` owns `AuthCard`, `AuthTabs`, `TextField`, `PasswordField`, `SsoButton`, and `OtpInput` so web and admin cannot drift. `OtpInput` renders six separate boxes; its behaviour (advance on type, step back on backspace, spread a pasted code, submit on the last digit) lives in `otp-input.logic.ts` as a pure reducer that is unit tested without a DOM. Mobile reimplements the same boxes natively in `apps/mobile/src/auth.tsx` because React Native has no shared DOM input, but consumes the identical contracts.

`AuthCard` takes a `tone`, which is how the admin portal reads as a staff console rather than a copy of the member portal while still using theme tokens.

## Abuse prevention

- Redis (or equivalent) rate limiter keyed by destination (phone or email), IP, and device.
- Separate hourly cap on password attempts, independent of OTP caps.
- reCAPTCHA on registration, password login, OTP request/resend, and forgot password.
- Exponential backoff after failed verifies.
- Device/session cap from config.
- File and OTP endpoints isolated from general API quota.

Details: [Security](../security/overview.md).
