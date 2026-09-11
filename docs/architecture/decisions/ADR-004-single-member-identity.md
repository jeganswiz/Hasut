# ADR-004: Single Member identity

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Some marketplaces split “User” and “Tasker” accounts. HASUT members both discover and offer.

## Decision

One `members` row per person. Professional is a profile. Business is an owned entity. Admin / Support Agent / Moderator are roles on the same member.

## Consequences

- One OTP identity across the product.
- No dual inboxes or dual sessions per person.
- Authorization checks profile existence and roles, not a second user table.
