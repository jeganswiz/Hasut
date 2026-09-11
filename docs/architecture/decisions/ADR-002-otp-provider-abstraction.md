# ADR-002: OTP provider abstraction; MSG91 first

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

India launch needs a local SMS/OTP vendor (MSG91). Later regions may use Twilio or others. Embedding MSG91 in use-cases would freeze the product to one vendor.

## Decision

`auth` depends only on `OtpProvider` (`sendOtp`, `verifyOtp`, `resendOtp`). HASUT owns hashing, expiry, attempts, and sessions. MSG91 is the first transport adapter. Twilio is a future adapter. A `console` adapter exists for development and is forbidden in production.

## Consequences

- OTP policy is consistent across vendors.
- Raw codes are never stored.
- Vendor outages are isolated behind the interface.
