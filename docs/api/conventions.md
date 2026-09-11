# API conventions

Complement to [API architecture](../architecture/07-api.md).

## Headers

| Header                   | Direction       | Purpose                                    |
| ------------------------ | --------------- | ------------------------------------------ |
| `X-Request-Id`           | both            | Correlation                                |
| `Authorization`          | in              | `Bearer <access>`                          |
| `Idempotency-Key`        | in              | OTP verify and ticket create (recommended) |
| `ETag` / `If-None-Match` | theme and flags | Cache                                      |

## Error codes (initial set)

Stable `error.code` strings. Clients switch on codes, not HTTP text.

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `OTP_EXPIRED`
- `OTP_INVALID`
- `OTP_ATTEMPTS_EXCEEDED`
- `OTP_RESEND_COOLDOWN`
- `SESSION_REVOKED`
- `REFRESH_REUSE`
- `ACCOUNT_SUSPENDED`
- `NOT_CONNECTED`
- `MEDIA_REJECTED`
- `FEATURE_DISABLED`

HTTP mapping: 400 validation, 401 authn, 403 authz/suspended, 404, 409, 429, 500 unexpected.

## Public vs private projections

Serializers live next to modules and are tested.

| Field        | Public member   | Owner | Admin            |
| ------------ | --------------- | ----- | ---------------- |
| phone        | no              | yes   | yes (audited)    |
| exact geog   | no              | yes   | support elevated |
| approx label | if discoverable | yes   | yes              |
| current mode | if discoverable | yes   | yes              |

## Pagination

Cursor opaque (base64 of `{ createdAt, id }`). No large offsets on discovery.

## Idempotency

`POST /auth/otp/verify` and connection accept should be safe to retry.

## OpenAPI

Generate from NestJS in the API sprint. Published under `docs/api` when the server exists. Do not hand-write a duplicate spec that can drift.
