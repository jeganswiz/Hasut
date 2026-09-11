# Admin architecture

`apps/admin` is a Next.js operations console. It uses the same API, types, validation, and design tokens as member apps. It is not a second backend.

## Access

- Authentication: same OTP (or a later email/password **not** in Phase 1 unless we add `purpose=ADMIN_LOGIN` on the same OTP flow). Phase 1: phone OTP; member must hold `ADMIN`, `SUPPORT_AGENT`, or `MODERATOR`.
- UI routes check role. **Every mutation is authorized again in API services.**
- Support Agent: tickets, limited user read.
- Moderator: reports, content hide, blocks review.
- Admin: everything below plus theme, flags, remote config, ranking, categories.

## Capability map

| Admin must                      | API module                    | Audit     |
| ------------------------------- | ----------------------------- | --------- |
| Manage users                    | `users`                       | yes       |
| Suspend/restore                 | `users`                       | yes       |
| Manage professionals            | `professionals`               | yes       |
| Manage businesses               | `businesses`                  | yes       |
| Manage categories               | `categories`                  | yes       |
| Verification queue              | `verification`                | yes       |
| Reports / moderate              | `reports`                     | yes       |
| Support tickets                 | `support`                     | yes       |
| Theme / tokens                  | `configuration`               | yes       |
| Remote config                   | `configuration`               | yes       |
| Feature flags                   | `configuration`               | yes       |
| Notification templates          | `notifications`               | yes       |
| Discovery ranking / radius caps | `configuration` + `discovery` | yes       |
| Audit log viewer                | `audit`                       | read only |

## Theme and remote configuration

Admin theme editor writes a versioned document:

- colors listed in the design-system token table
- logo media id (uploaded via `media` presign)
- basic UI keys (`cardRadius`, default map center for empty states — not member PII)

Publish:

1. Validate contrast warnings
2. Persist `theme_configs`
3. Increment `config_version`
4. Bust Redis + CDN cache
5. Audit `THEME_PUBLISH`

Feature flags: boolean or percentage, optional role targeting. Evaluated in API and exposed to clients as a **safe public subset**. Secret flags never go to mobile/web.

## Information architecture (screens)

1. Dashboard (counts: pending verifications, open reports, open tickets)
2. Members search
3. Member detail (roles, sessions revoke, suspend)
4. Professionals / businesses lists
5. Categories tree
6. Verification queue (identity Phase 1)
7. Reports queue
8. Support inbox
9. Theme
10. Flags / remote config
11. Notification templates
12. Discovery config
13. Audit logs (filter by actor, entity, request id)

## Audit

Every mutating admin endpoint writes:

`admin_id`, `action`, `entity`, `entity_id`, `before`, `after`, `timestamp`, `ip`, `request_id`

`before`/`after` must not dump OTP hashes, refresh hashes, or exact location into logs without redaction. Redact phone in default audit views; full phone only on elevated reveal with its own audit event.

## Out of scope for admin Phase 1

Billing dashboards, CRM, invoice tools, live moderation of streams, creator payouts.
