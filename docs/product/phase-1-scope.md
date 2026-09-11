# Phase 1 product scope — Local Discovery Network

## Brand

HASUT is inspired by Hebrew חסות: patronage, support, sponsorship, mutual backing, connection. The product is a location-intelligent professional and business network — not a gig-only tasker clone and not a generic social network.

## Member outcomes (in)

A member can:

1. Register/login with phone OTP
2. Create a personal profile
3. Set location (exact stored; approximate shown)
4. Discover nearby people, professionals, and businesses
5. Search by category/service
6. View professional profiles
7. View business profiles
8. Become a professional
9. Select multiple professional categories
10. Set service area
11. Set current mode + short status text
12. Upload basic profile/portfolio media
13. Request/accept connections
14. Chat with connected users (text, image, read, timestamps)
15. Report/block users or content
16. Request professional **identity** verification
17. Receive notifications
18. Contact HASUT support

## Admin outcomes (in)

Manage: users, professionals, businesses, categories, verification requests, reports, support tickets, theme/design tokens, remote configuration, feature flags, notification templates, audit logs, suspend/restore, content moderation, discovery configuration.

## Verification language (in)

States: `NOT_STARTED`, `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `EXPIRED`.

Types exist: Identity, Business, Skill. **Phase 1 implements Identity foundation only.** UI must never say a skill is verified because identity is verified.

## Discovery (in)

Rank by configurable weights: distance, category relevance, availability, verification, rating, activity.

Search filters: category, keyword, distance, professional, business, verified, available.

## Messaging (in / out)

In: connection request/accept/reject; 1:1 text and image; read; timestamps.  
Out: groups, voice, status, disappearing messages, “WhatsApp clone” features.

## Explicitly out (architecture only)

Subscriptions, CRM, invoices, billing, marketplace checkout, booking, payments, live streaming, tokens, creator rewards, advanced analytics, team/business management suites, multi-city ops, Protected Services.

## UX states

Every member and admin surface: loading, empty, error, success. Token-driven UI. Map-first mobile discovery with bottom sheet and nearby cards — inspired by, not copied from, the reference.

## Critical E2E (definition of done for the product)

Member: Registration → OTP → profile → location → discovery → profile → connection → chat.

Admin: Admin login → user search → verification → approve → audit log.
