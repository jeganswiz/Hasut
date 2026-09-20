# Module boundaries

Phase 1 backend is a NestJS modular monolith. Modules may depend **down** the graph only. Circular imports are a build failure.

## Identity model

| Concept       | Kind     | Notes                                                    |
| ------------- | -------- | -------------------------------------------------------- |
| Member        | Identity | The only account. Phone OTP login.                       |
| Professional  | Profile  | A member can become a professional. Multiple categories. |
| Business      | Entity   | A member can own a business. Not a second login.         |
| Admin         | Role     | Full operations access.                                  |
| Support Agent | Role     | Tickets, not theme/flags unless granted.                 |
| Moderator     | Role     | Reports, content, not billing-equivalent config.         |

Never create a parallel `User` vs `Tasker` identity. Capability is `member_roles` plus profile rows.

## Module catalog

| Module          | Responsibility                                                                              | Must not                                    |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `configuration` | Feature flags, remote config, theme payload, discovery ranking weights                      | Know HTTP clients or UI                     |
| `audit`         | Append-only admin audit records                                                             | Own business workflows                      |
| `auth`          | OTP orchestration, sessions, refresh rotation, logout                                       | Own profile fields                          |
| `users`         | Member lifecycle, status, suspend/restore, roles                                            | Own professional catalog                    |
| `media`         | Presigned upload, metadata, virus/type/size checks                                          | Store bytes in Postgres                     |
| `categories`    | Admin-managed taxonomy tree                                                                 | Hardcode names in code                      |
| `locations`     | Store exact points, derive approximate public location, service areas, distance             | Return exact personal coords on public APIs |
| `profiles`      | Personal profile, current mode, status text                                                 | Rank discovery                              |
| `professionals` | Professional profile, categories, skills, service area, availability                        | Payments/booking                            |
| `businesses`    | Business profile, hours, categories, media                                                  | Invoicing                                   |
| `services`      | Professional-offered service listings (name, category, description, optional display price) | Checkout, calendar holds                    |
| `reviews`       | Ratings and aggregates used by discovery                                                    | Skill verification claims                   |
| `stories`       | 24h map presence stories (image/video) behind `stories.live`                                | Social feed, marketplace                    |
| `live`          | Live session URLs / WHIP ingest pointers; HLS playback URLs                                 | A second product identity                   |
| `discovery`     | Search + rank nearby people, professionals, businesses                                      | Bypass privacy rules                        |
| `connections`   | Request, accept, reject                                                                     | Chat storage                                |
| `messaging`     | 1:1 chat for accepted connections; text, image, read, timestamps                            | Groups, calls, disappearing messages        |
| `verification`  | Identity verification foundation; typed requests                                            | Treat identity as skill proof               |
| `notifications` | In-app notifications from templates                                                         | Marketing blast engine                      |
| `reports`       | Report and block                                                                            | Support ticket workflows                    |
| `support`       | Tickets, messages, assignment, internal notes, escalation                                   | Replace admin user mgmt                     |
| `admin`         | HTTP surface for operators; composes other modules                                          | Duplicate domain logic                      |

## Allowed dependency direction

```
configuration, audit, media, categories
        ↑
      auth, locations
        ↑
      users
        ↑
      profiles
        ↑
      professionals, businesses, services
        ↑
      reviews, connections, verification
        ↑
      discovery, messaging, reports, notifications, support
        ↑
      admin
```

Arrows mean “depends on” (upward is toward foundations). `admin` is a façade: it calls other modules’ exported application services. Domain modules never import `admin`.

`discovery` may read from professionals, businesses, services, profiles, locations, reviews, and configuration. It does not write those aggregates.

`messaging` depends on `connections` (must be ACCEPTED) and `media` (image attachments). It does not create connections.

## Cross-cutting rules

- Authorization is enforced in **services**, not only guards.
- Each module owns its Prisma models as much as possible; shared FKs are documented in [ERD](../database/erd.md).
- Events (in-process) may notify `notifications` and `audit`. No message broker in Phase 1.
- Tests live beside the module (`*.spec.ts`) plus API e2e under `apps/api/test`.

## Future module slots (names reserved)

`billing`, `subscriptions`, `invoices`, `crm`, `bookings`, `payments`, `tokens`, `analytics`. Do not create these folders until a later phase. `stories` and live session APIs live in `apps/api/src/modules/stories` (Phase 2).
