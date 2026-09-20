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

| Area          | Examples                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `/auth/otp/request`, `/auth/otp/verify`, `/auth/token/refresh`, `/auth/logout`                                                   |
| Me            | `/me`, `/me/profile`, `/me/location`, `/me/mode`                                                                                 |
| Media         | `/media/presign`, `/media/complete`                                                                                              |
| Categories    | `/categories` (public read)                                                                                                      |
| Discovery     | `/discovery/nearby`, `/discovery/search`                                                                                         |
| Members       | `/members/:id` (public projection)                                                                                               |
| Professionals | `/professionals/:id`, `/me/professional`                                                                                         |
| Businesses    | `/businesses/:id`, `/me/businesses`                                                                                              |
| Services      | `/me/services`, `/professionals/:id/services`                                                                                    |
| Reviews       | `/reviews`, `/reviews/aggregate`                                                                                                 |
| Stories       | `/me/stories`, `/stories/:memberId`, `/me/live`; admin `/admin/stories`, `/admin/live` (flag `stories.live`)                     |
| Connections   | `/connections`, `/connections/with/:memberId`, `/connections/:id/accept                                                          | reject | cancel` |
| Messaging     | `/conversations`, `/conversations/:id/messages`, `/conversations/:id/read`                                                       |
| Verification  | `/verification/identity`; admin `/admin/verification`, `/admin/verification/:id/decide`                                          |
| Reports       | `/reports`, `/blocks`; admin `/admin/reports`, hide/dismiss                                                                      |
| Notifications | `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`; admin `/admin/notification-templates`                |
| Support       | `/support/categories`, `/support/tickets`, messages; admin assign/notes/escalate                                                 |
| Ops summary   | `/admin/ops/summary` (pending verifications, open reports, open tickets, suspended members)                                      |
| Config        | `/config/theme`, `/config/flags`, `/config/messaging`, `/config/reports`, `/config/discovery` (includes resolved map tile chain) |
| Discovery WS  | `/ws/v1/discovery` (`presence.updated`, `presence.sync`)                                                                         |
| Admin         | `/admin/members`, `/admin/professionals`, `/admin/businesses`, `/admin/theme`, `/admin/flags`, `/admin/audit`, queues            |

WebSocket: `/ws/v1/messaging` (chat) and `/ws/v1/discovery` (snapped presence). Both are authenticated; guests do not join discovery rooms. Presence payloads are snapped map pins, not exact tracks. Location writes still persist through `PUT /api/v1/me/location`.

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
