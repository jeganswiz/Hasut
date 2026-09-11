# Development workflow

## Tooling

| Tool                         | Use                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------- |
| pnpm                         | Package manager                                                                   |
| Turborepo                    | `lint`, `typecheck`, `test`, `build` pipelines                                    |
| TypeScript                   | `strict` true; `noImplicitAny`; no `any` without a one-line justification comment |
| Prisma                       | Schema + migrations                                                               |
| Jest                         | Unit and API integration                                                          |
| Playwright                   | Web + admin E2E                                                                   |
| React Native Testing Library | Mobile unit                                                                       |
| Docker Compose               | Postgres+PostGIS, MinIO, Redis, API                                               |

## Environments

| Name          | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `development` | Local compose; console OTP allowed                  |
| `staging`     | Real OTP provider test credentials; production-like |
| `production`  | Secrets manager; console OTP forbidden              |

Never share production OTP or DB credentials with local `.env`.

## Stage loop (mandatory)

Before each implementation stage:

1. Inspect repository (this docs tree and existing code).
2. Explain current architecture in the change summary.
3. Identify affected modules.
4. Write a short implementation plan.
5. Implement.
6. Run lint.
7. Run typecheck.
8. Run tests for affected packages.
9. Fix failures.
10. Review security (authz, PII, uploads).
11. Review UX (loading/empty/error/success).
12. Update documentation.
13. Summarize files changed.
14. Provide manual verification steps.

Do not claim complete without tests.

## CI

Pipeline must run: lint, typecheck, unit, integration, build. Playwright E2E on web/admin when those apps exist (staging or CI with compose).

## Shared contracts

If an API DTO changes:

1. `packages/types`
2. `packages/validation`
3. NestJS controller uses the same schema
4. `packages/api-client` methods
5. Apps consume the client only

## Do not

- Install a package when an existing workspace package solves it. If installing, state why in the stage notes.
- Hardcode categories, modes, theme hex, ranking weights, OTP timings.
- Duplicate utilities, clients, or types.
- Bypass `OtpProvider`, location privacy helpers, or admin audit.
- Implement deferred phase features “while we are here”.
