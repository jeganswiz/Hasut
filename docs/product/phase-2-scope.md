# Phase 2 product scope — Presence stories and live

Phase 2 starts **only after Sprint 9** (Phase 1 hardening) is green. It is not a generic social network and not a second identity. HASUT stays a location-intelligent professional and business network; stories are **map presence**.

**Status:** Implemented behind feature flag `stories.live`. Modules: `apps/api/src/modules/stories`. Web composer `/story`, viewer `/stories/[memberId]` (HLS via `hls.js`). Map pin DTO includes `pinMediaKind` and `previewHlsUrl`; web pins attach muted HLS previews (capped, data-saver aware). Admin `/stories` moderates stories and live. Optional MediaMTX: `docker compose --profile live up mediamtx`.

## In

A member can:

1. Always appear on the discovery map as a **rounded profile circle** (photo or initials). Never a blank hole.
2. Add a time-bounded presence story: image (optional music), or video (trim + add audio).
3. Go live from the story composer.
4. Watch nearby stories and lives in a full-screen vertical viewer.
5. See map-pin media with this **priority**: live HLS preview → video story preview → image story → idle profile. If they have not posted, the pin still shows the profile and the owner is prompted to add a story.
6. Stream playback uses **HLS with buffering / ABR** (YouTube-like), not progressive MP4 on the map.

Admin can moderate stories and live sessions. Feature-flag the whole phase.

## Map pin playback rules

- Low rung only (about 240p), muted, short buffer.
- Viewport-culled; cap concurrent decodes (about 3).
- Pause when the sheet covers the pin or the tab is backgrounded.
- One unmuted player: the full-screen viewer.
- Data saver: no autoplay pin video on cellular without an explicit control.
- Privacy unchanged: snapped `pinLat` / `pinLng`, no phone, no exact coordinates.

## Composer

- Client-side edit first (browser `MediaRecorder` / trim). Server stores transcoded HLS, not raw camera files.
- Image + optional audio; video trim + audio; go live.

## Infra

Still one NestJS API. Add a **media ingest container** (for example MediaMTX) next to MinIO/Redis — not a HASUT microservice.

Sketch: browser WHIP/WebRTC ingest → MediaMTX → HLS in MinIO/CDN → API stores playback URLs, ~24h expiry, and moderation state.

## Out

Marketplace checkout, creator tokens, billing, treating live as a second product identity, Instagram visual clone, fake analytics.

## Sprints (draft, split when Phase 1 exits)

1. Story domain + media policy (video/audio) + composer image/video + 24h expiry + idle rings
2. HLS VOD transcode + full-screen viewer + map preview rungs
3. Live ingest + HLS live + pin priority LIVE first + admin moderation
4. Hardening: abuse limits, PII, data-saver, battery, feature flags
