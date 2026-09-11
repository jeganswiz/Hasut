# API architecture

Base path: `/api/v1`. Single NestJS application.

## Envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "pagination": { "cursor": "…", "hasMore": false }
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "OTP_ATTEMPTS_EXCEEDED",
    "message": "Too many attempts. Try later.",
    "details": {}
  },
  "meta": { "requestId": "uuid" }
}
```

`message` is client-safe. Internal exception text stays in logs keyed by `requestId`.

## Cross-cutting stack

| Concern          | Implementation                                                     |
| ---------------- | ------------------------------------------------------------------ |
| Request ID       | Incoming `X-Request-Id` or generated UUID; echo header + body meta |
| Authn            | Bearer access token and/or cookie; `AuthGuard`                     |
| Authz            | Role + resource ownership in services; `Policies` per module       |
| Validation       | Shared Zod schemas from `packages/validation`                      |
| Rate limit       | Redis; route families (auth stricter)                              |
| CORS             | Explicit origins per environment                                   |
| Security headers | Helmet-equivalent                                                  |
| Logging          | Structured JSON: requestId, memberId, route, duration, status      |
| Pagination       | Cursor for lists (discovery, chat, admin tables)                   |

## Resource map (Phase 1)

Prefix `/api/v1`.

| Area          | Examples                                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| Auth          | `/auth/otp/request`, `/auth/otp/verify`, `/auth/token/refresh`, `/auth/logout` |
| Me            | `/me`, `/me/profile`, `/me/location`, `/me/mode`                               |
| Media         | `/media/presign`, `/media/complete`                                            |
| Categories    | `/categories` (public read)                                                    |
| Discovery     | `/discovery/nearby`, `/discovery/search`                                       |
| Members       | `/members/:id` (public projection)                                             |
| Professionals | `/professionals/:id`, `/me/professional`                                       |
| Businesses    | `/businesses/:id`, `/me/businesses`                                            |
| Services      | `/professionals/:id/services`                                                  |
| Connections   | `/connections`, `/connections/with/:memberId`, `/connections/:id/accept        | reject | cancel` |
| Messaging     | `/conversations`, `/conversations/:id/messages`, `/conversations/:id/read`     |
| Verification  | `/verification/identity`                                                       |
| Reports       | `/reports`, `/blocks`                                                          |
| Notifications | `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`     |
| Support       | `/support/tickets`                                                             |
| Config        | `/config/theme`, `/config/flags`, `/config/messaging`, `/config/reports`       |
| Admin         | `/admin/...` (role gated)                                                      |

WebSocket (optional in chat sprint): `/ws/v1/messaging` authenticated; still persists via the same messaging module. If WS slips, polling messages remains acceptable for MVP.

## Authorization matrix (summary)

| Endpoint class            | Who                                |
| ------------------------- | ---------------------------------- |
| OTP                       | Public + rate limit                |
| Theme/flags public subset | Public                             |
| Member mutations          | Owner                              |
| Connection/chat           | Authenticated + relationship rules |
| Admin                     | Role                               |
| Exact location GET        | Owner only                         |
| Phone                     | Owner, or admin/support with audit |

## Versioning

`v1` is additive. Breaking changes require `v2`. Shared `packages/types` versions with the API.

Client rule: only `packages/api-client` talks to these routes.

See also [API conventions](../api/conventions.md).
