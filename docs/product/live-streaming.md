# Live streaming

HASUT live is a neighborhood broadcast on MediaMTX, not a marketplace or SFU.

## What members see

- **Host studio** (`/story` Live tab): camera permission, device pickers, preview, audience (Everyone / Patrons / Private invitees), chat and recording toggles, then health, viewers, chat moderation, and a confirmed end with a summary.
- **Viewer** (`/live/[id]`): HLS player with waiting / reconnecting / ended / restricted states, chat, reactions, share and report.
- **Discovery** (`/live`): Live now, My Patrons, upcoming, recommended, recent replays. Profile pages show a LIVE badge. Public lives offer **Remind me** instead of a follow graph.
- **Patrons** remain accepted connections only.

## Media path

Host publishes WebRTC WHIP to MediaMTX. Viewers pull HLS. The API Control port (`:9997`) is the health source. Playback (`:9996`) is fetched only by the API after a recorded live ends. Those ports stay on the API host, not the public web origin.

## Recording and replay

When `LIVE_RECORDING_ENABLED` is on and playback + ffmpeg are configured, MediaMTX records fmp4. On end the session moves to `PROCESSING`, the API stores a `Story` of `kind: LIVE`, and the existing ffmpeg worker publishes `story-hls`. Hosts publish, keep private, or discard the replay. Replays expire after `live.policy.replayRetentionDays`.

## Realtime

`/ws/v1/live` uses the same access-token handshake as messaging. Join re-checks audience, blocks, and invites. Chat is rate-limited, optional patrons-only, and closed after end. Optional `REALTIME_REDIS_URL` fans rooms out across API processes.

## Notifications and push

Templates: `live.started`, `live.reminder`, `live.replay.published`. `Notification.dedupeKey` prevents duplicates. Recipients are Patrons plus Remind-me subscribers, minus blocks, minus quiet hours. Web Push uses VAPID keys on the API only.

## Blocked by MediaMTX (shown as unavailable)

Guest co-hosts, captions, and a server multi-bitrate ladder. Screen share uses `replaceTrack` when the browser supports it.

## Manual verification

1. Start compose (Postgres, Redis, MinIO, MediaMTX). Apply Prisma migrations and seed.
2. Open `/story` → Live. Grant camera. Go live. Confirm `/me/live/health` and a heartbeat.
3. From another session open `/live/{id}` and `/live`. Confirm chat, viewer count, and restricted copy on a Patrons/Private live.
4. End with the confirm dialog. If recording is on, wait for replay READY and publish from the summary.
5. Schedule a live and confirm a reminder inside `scheduleReminderMinutes`.
6. Admin `/stories` shows viewer count and can end a live.
