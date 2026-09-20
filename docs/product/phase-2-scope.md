# Phase 2 product scope — Presence stories and live

Phase 2 starts **only after Sprint 9** (Phase 1 hardening) is green. It is not a generic social network and not a second identity. HASUT stays a location-intelligent professional and business network; stories are **map presence**.

**Status:** Implemented behind feature flag `stories.live`. Modules: `apps/api/src/modules/stories`. Web composer `/story` (Activity / Live tabs), viewer `/stories/[memberId]` (HLS via `hls.js`). Map pin DTO includes `pinMediaKind` and `previewHlsUrl`; web pins attach muted HLS previews (capped, data-saver aware). Admin `/stories` moderates stories and live; admin `/stories/audio` curates the soundtrack library. Optional MediaMTX: `docker compose --profile live up mediamtx`.

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

### Sprint 11 authoring surface (implemented)

`/story` splits into two tabs, **Activity** and **Live**, matching the viewer.

| Control            | Contract field                            | Rule                                                                                                                                           |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Photo / video pick | `imageMediaId` / `videoMediaId`           | Preview is a local blob; only the chosen file uploads.                                                                                         |
| Caption            | `caption`                                 | Trimmed, capped at `story.policy.captionMaxLength`.                                                                                            |
| Caption colour     | `captionColor`                            | Must match a swatch in `story.policy.captionColors`. The service rejects anything else, so a caption can never be made unreadable.             |
| Video trim         | `trimStartSeconds` / `trimEndSeconds`     | Two-handle scrubber. Span capped at `maxVideoDurationSeconds`.                                                                                 |
| Soundtrack         | `audio.source`                            | `NONE`, `LIBRARY` (HASUT cloud), or `UPLOAD` (member file).                                                                                    |
| Audio portion      | `audio.startSeconds` / `audio.endSeconds` | Span capped at `maxAudioSegmentSeconds` and clamped to the track length.                                                                       |
| Original sound     | `originalAudioMode`                       | `KEEP`, `MUTE` (drop the camera audio), or `OVERLAY` (layer the chosen track on top). Rejected on image stories, which have no original sound. |

Trim and audio bounds are enforced twice: `packages/validation` shapes the request, and `StoriesService` re-checks against configuration because the caps are operator-owned and a stale client will not know they moved.

### Audio library

`AudioTrack` is an admin-curated catalogue so the licensing question is answered once per track instead of once per member upload. Staff manage it at admin `/stories/audio`; members read only active tracks through `GET /stories/audio`, and only while `story.policy.audioLibraryEnabled` is on. A story that references a retired track is rejected at create time rather than published silently.

### Audience — Patrons

A story or a live is either visible to **everyone nearby** or to the member's **Patrons**.

Patrons are accepted connections. The word comes from חסות, patronage, and is deliberately not "follower": HASUT has no one-way subscribe, so the set is symmetric and both sides consented to it. `PatronsService` owns the definition; every audience check reads from it, so there is one place to audit rather than a connection query scattered across services.

Enforcement runs on both read paths:

- `GET /stories/:memberId` filters on audience for the calling viewer. Before Sprint 12 this endpoint returned every story to any authenticated caller.
- Map pin previews resolve Patron status for the whole visible set in one query. A Patrons-only story or live never appears as a pin preview to someone who could not open it, and a signed-out viewer is nobody's Patron.

Members always see their own posts at any audience. Moderators see everything, because moderation cannot depend on the audience a member chose.

`GET /me/live` and `GET /stories/:memberId/live` return `{ live }` so a missing session is not an empty-body error. The nearby watch payload never includes `ingestUrl`. The full-screen viewer plays caption, the audio window, and the live title; a live session opens on the Live tab.

### Composer configuration

`story.policy` in `packages/config` owns the caption palette, caption length, video cap, audio segment cap, and the library switch. Clients fetch it from `GET /stories/composer`; no app hardcodes a swatch or a duration.

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
