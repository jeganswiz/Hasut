"use client";

import type {
  LiveChatMessageView,
  LiveComposerConfig,
  LiveHealthView,
  LiveRecordingStatus,
  LiveSessionView,
  LiveSummaryView,
  StoryAudience,
} from "@hasut/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
  TextField,
} from "@hasut/ui";
import { createHasutLiveRealtimeClient } from "@hasut/api-client";
import { useEffect, useRef, useState } from "react";
import { createWebApiClient, webApiBaseUrl } from "../../lib/api";
import { IDLE, failure, loading, success, type AuthFeedback } from "../../lib/auth-flow";
import {
  canShareScreen,
  formatLiveClock,
  healthLabel,
  mapMediaDevices,
} from "../../lib/live-devices";
import { publishWhip, reachableIngestUrl, whipEndRequest, type WhipPeer } from "../../lib/whip";
import { webTokenStorage } from "../../lib/token-storage";
import { AuthFeedbackNote } from "../auth/auth-feedback";
import { AudiencePicker } from "../story/audience-picker";
import { LiveChatPanel } from "./live-chat-panel";

export function HostStudio({
  config,
  onClose,
}: {
  config: LiveComposerConfig;
  onClose?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(config.categories[0] ?? null);
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatPatronsOnly, setChatPatronsOnly] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [session, setSession] = useState<LiveSessionView | null>(null);
  const [summary, setSummary] = useState<LiveSummaryView | null>(null);
  const [health, setHealth] = useState<LiveHealthView | null>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [permission, setPermission] = useState<"idle" | "denied" | "ready">("idle");
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [mics, setMics] = useState<Array<{ id: string; label: string }>>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [feedback, setFeedback] = useState<AuthFeedback>(IDLE);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [messages, setMessages] = useState<LiveChatMessageView[]>([]);
  const [pinned, setPinned] = useState<LiveChatMessageView | null>(null);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [patrons, setPatrons] = useState<Array<{ id: string; displayName: string }>>([]);
  const [setupOpen, setSetupOpen] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closePublish = useRef<(() => void) | null>(null);
  const facing = useRef<"user" | "environment">("user");
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const busy = feedback.status === "loading";

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = preview;
    }
  }, [preview]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    return () => {
      closePublish.current?.();
      closePublish.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      preview?.getTracks().forEach((track) => track.stop());
    };
  }, [preview]);

  useEffect(() => {
    void createWebApiClient()
      .listConnections()
      .then((rows) =>
        setPatrons(rows.filter((row) => row.status === "ACCEPTED").map((row) => row.peer)),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void createWebApiClient()
      .getMyLive()
      .then((current) => {
        if (current === null) {
          return;
        }
        setSession(current);
        setTitle(current.title);
        setAudience(current.audience);
        if (reachableIngestUrl(current.ingestUrl)) {
          void sendCamera(
            current.ingestUrl,
            closePublish,
            setPreview,
            peerRef,
            cameraId,
            micId,
            facing.current,
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const client = createHasutLiveRealtimeClient({
      baseUrl: webApiBaseUrl(),
      tokenStorage: webTokenStorage,
    });
    let active = true;
    void client.connect().then((socket) => {
      if (!active) {
        client.disconnect();
        return;
      }
      socket.emit("join", { liveId: session.id });
      socket.on("chat.message", (payload) => {
        const message = payload as LiveChatMessageView;
        setMessages((current) => [...current, message]);
      });
      socket.on("chat.pinned", (payload) => setPinned(payload as LiveChatMessageView | null));
      socket.on("chat.hidden", (payload) => {
        const hidden = payload as { messageId: string };
        setMessages((current) => current.filter((item) => item.id !== hidden.messageId));
      });
      socket.on("viewers.updated", (payload) => {
        const update = payload as { viewerCount: number };
        setSession((current) =>
          current === null ? current : { ...current, viewerCount: update.viewerCount },
        );
      });
    });
    void createWebApiClient()
      .listLiveChat(session.id)
      .then((page) => {
        setMessages(page.messages);
        setPinned(page.pinned);
      })
      .catch(() => undefined);
    const beat = window.setInterval(() => {
      void createWebApiClient()
        .heartbeatLive()
        .then((result) => {
          setSession(result.live);
          setHealth(result.health);
        })
        .catch(() => undefined);
    }, config.heartbeatSeconds * 1000);
    return () => {
      active = false;
      client.disconnect();
      window.clearInterval(beat);
    };
  }, [session?.id, config.heartbeatSeconds]);

  async function openPreview(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:
          cameraId.length > 0 ? { deviceId: { exact: cameraId } } : { facingMode: facing.current },
        audio: micId.length > 0 ? { deviceId: { exact: micId } } : true,
      });
      const listed = mapMediaDevices(await navigator.mediaDevices.enumerateDevices());
      setCameras(listed.cameras);
      setMics(listed.mics);
      if (cameraId.length === 0 && listed.cameras[0] !== undefined) {
        setCameraId(listed.cameras[0].id);
      }
      if (micId.length === 0 && listed.mics[0] !== undefined) {
        setMicId(listed.mics[0].id);
      }
      setPreview(stream);
      setPermission("ready");
    } catch {
      setPermission("denied");
    }
  }

  async function goLive(): Promise<void> {
    if (title.trim().length === 0) {
      setFeedback({ status: "error", message: "Give your live a title so people know to join." });
      return;
    }
    setFeedback(loading("Opening your live session…"));
    const client = createWebApiClient();
    try {
      const started = await client.startLive({
        title,
        description,
        category,
        audience,
        chatEnabled,
        chatPatronsOnly,
        recordingEnabled: config.recordingAvailable ? recordingEnabled : false,
        inviteeIds: audience === "PRIVATE" ? inviteeIds : undefined,
      });
      if (reachableIngestUrl(started.ingestUrl)) {
        setFeedback(loading("Connecting your camera…"));
        await sendCamera(
          started.ingestUrl,
          closePublish,
          setPreview,
          peerRef,
          cameraId,
          micId,
          facing.current,
        );
      }
      setSession(started);
      setFeedback(success("You are live."));
    } catch (error) {
      closePublish.current?.();
      setFeedback(failure(error, "Unable to go live."));
    }
  }

  async function confirmStop(): Promise<void> {
    setConfirmEnd(false);
    setFeedback(loading("Ending your live session…"));
    closePublish.current?.();
    closePublish.current = null;
    try {
      const ended = await createWebApiClient().endLive();
      const next = await createWebApiClient().getLiveSummary(ended.id);
      setSession(null);
      setSummary(next);
      setFeedback(success("Live ended."));
    } catch (error) {
      setFeedback(failure(error, "Unable to end the session."));
    }
  }

  if (summary !== null) {
    return (
      <div className="lv-studio">
        <h2>Live summary</h2>
        <p>
          {summary.live.title} · {Math.floor(summary.durationSeconds / 60)}m{" "}
          {summary.durationSeconds % 60}s
        </p>
        <ul className="lv-summary">
          <li>Peak viewers {summary.peakViewers}</li>
          <li>Total views {summary.totalViews}</li>
          <li>Reactions {summary.reactionCount}</li>
          <li>Messages {summary.messageCount}</li>
        </ul>
        {summary.live.recordingEnabled ? (
          <ReplayEditor liveId={summary.live.id} status={summary.live.recordingStatus} />
        ) : (
          <p className="hint">Recording was off for this live.</p>
        )}
        <Button onClick={() => setSummary(null)}>Back to setup</Button>
      </div>
    );
  }

  return (
    <div className="lv-studio">
      <div className="story-frame ps-live-frame">
        {preview !== null ? (
          <video ref={videoRef} muted playsInline autoPlay className="live-camera" />
        ) : (
          <p className="live-waiting">
            {permission === "denied"
              ? "Camera or microphone access is blocked. Allow it in the browser to preview."
              : "Your camera appears here after you allow access."}
          </p>
        )}
        <div className="ps-live-top">
          <button type="button" className="ps-round" aria-label="Close" onClick={onClose}>
            ×
          </button>
          {session === null ? (
            <span className="ps-live-pill is-idle">LIVE</span>
          ) : (
            <span className="ps-live-pill">
              <span className="live-dot" aria-hidden />
              LIVE {formatLiveClock(session.startedAt, now)}
            </span>
          )}
          {session === null ? null : (
            <button
              type="button"
              className="ps-end"
              disabled={busy}
              onClick={() => setConfirmEnd(true)}
            >
              End Live
            </button>
          )}
        </div>
      </div>
      {session === null ? (
        <>
          <div className="ps-rail" role="toolbar" aria-label="Live setup">
            <button
              type="button"
              className={setupOpen ? "is-active" : ""}
              aria-label="Title and audience"
              onClick={() => setSetupOpen((value) => !value)}
            >
              ⌂
            </button>
          </div>
          <div className={setupOpen ? "ps-card ps-live-form is-open" : "ps-card ps-live-form"}>
            <p className="hint">
              Preview your camera, then go live. Neighbors see this on your pin.
            </p>
            <Button onClick={() => void openPreview()} disabled={permission === "ready"}>
              {permission === "ready" ? "Camera ready" : "Allow camera and microphone"}
            </Button>
            {cameras.length > 1 ? (
              <label className="lv-field">
                Camera
                <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
                  {cameras.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {mics.length > 1 ? (
              <label className="lv-field">
                Microphone
                <select value={micId} onChange={(event) => setMicId(event.target.value)}>
                  {mics.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <TextField
              label="Live title"
              value={title}
              onChange={setTitle}
              maxLength={config.titleMaxLength}
            />
            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              maxLength={config.descriptionMaxLength}
            />
            <label className="lv-field">
              Category
              <select
                value={category ?? ""}
                onChange={(event) =>
                  setCategory(event.target.value.length === 0 ? null : event.target.value)
                }
              >
                {config.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <AudiencePicker
              value={audience}
              onChange={setAudience}
              patronCount={config.patronCount}
              allowPrivate
            />
            {audience === "PRIVATE" ? (
              <fieldset className="lv-invites">
                <legend>Invite Patrons</legend>
                {patrons.map((patron) => (
                  <label key={patron.id}>
                    <input
                      type="checkbox"
                      checked={inviteeIds.includes(patron.id)}
                      onChange={() =>
                        setInviteeIds((current) =>
                          current.includes(patron.id)
                            ? current.filter((id) => id !== patron.id)
                            : [...current, patron.id],
                        )
                      }
                    />
                    {patron.displayName}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <label className="lv-switch">
              <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
              Chat on
            </label>
            <label className="lv-switch">
              <Switch
                checked={chatPatronsOnly}
                onCheckedChange={setChatPatronsOnly}
                disabled={!chatEnabled}
              />
              Patrons-only chat
            </label>
            {config.recordingAvailable ? (
              <label className="lv-switch">
                <Switch checked={recordingEnabled} onCheckedChange={setRecordingEnabled} />
                Record this live
              </label>
            ) : (
              <p className="hint">Recording is not available on this server.</p>
            )}
            <AuthFeedbackNote feedback={feedback} />
            <Button onClick={() => void goLive()} disabled={busy}>
              {busy ? "Starting…" : "Go live"}
            </Button>
          </div>
        </>
      ) : (
        <div className="lv-live-side">
          <p className="hint" aria-live="polite">
            {healthLabel(health?.state ?? "UNKNOWN")} · {session.viewerCount} watching
          </p>
          <div className="studio-pills">
            <button
              type="button"
              className="studio-pill"
              onClick={() => toggleTrack(preview, "audio")}
            >
              Mute
            </button>
            <button
              type="button"
              className="studio-pill"
              onClick={() => toggleTrack(preview, "video")}
            >
              Camera
            </button>
            <button
              type="button"
              className="studio-pill"
              onClick={() => {
                facing.current = facing.current === "user" ? "environment" : "user";
                if (session.ingestUrl !== null) {
                  void sendCamera(
                    session.ingestUrl,
                    closePublish,
                    setPreview,
                    peerRef,
                    cameraId,
                    micId,
                    facing.current,
                  );
                }
              }}
            >
              Flip
            </button>
            {canShareScreen() ? (
              <button
                type="button"
                className="studio-pill"
                onClick={() => void shareScreen(peerRef.current)}
              >
                Share screen
              </button>
            ) : (
              <span className="hint">Screen share is not available here.</span>
            )}
          </div>
          <LiveChatPanel
            live={session}
            messages={messages}
            pinned={pinned}
            canModerate
            onSend={(body) =>
              createWebApiClient()
                .sendLiveChat(session.id, body)
                .then(() => undefined)
            }
            onReact={(emoji) => {
              const client = createHasutLiveRealtimeClient({
                baseUrl: webApiBaseUrl(),
                tokenStorage: webTokenStorage,
              });
              void client.connect().then((socket) => socket.emit("reaction", { emoji }));
            }}
            onPin={(messageId) => void createWebApiClient().pinLiveChat(session.id, messageId)}
            onHide={(messageId) => void createWebApiClient().hideLiveChat(session.id, messageId)}
          />
          <AuthFeedbackNote feedback={feedback} />
        </div>
      )}
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogTitle>End this live?</DialogTitle>
          <DialogDescription>
            Viewers will see that the stream ended. This cannot be undone.
          </DialogDescription>
          <div className="lv-end-actions">
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              Keep live
            </Button>
            <Button onClick={() => void confirmStop()}>End live</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function sendCamera(
  ingestUrl: string,
  closePublish: { current: (() => void) | null },
  setPreview: (stream: MediaStream | null) => void,
  peerRef: { current: RTCPeerConnection | null },
  cameraId: string,
  micId: string,
  facing: "user" | "environment",
): Promise<void> {
  closePublish.current?.();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: cameraId.length > 0 ? { deviceId: { exact: cameraId } } : { facingMode: facing },
    audio: micId.length > 0 ? { deviceId: { exact: micId } } : true,
  });
  const handle = await publishWhip({
    ingestUrl,
    stream,
    createConnection: () => {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      return peer as unknown as WhipPeer;
    },
    post: async (request) => {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return {
        status: response.status,
        body: await response.text(),
        location: response.headers.get("Location"),
      };
    },
  });
  const end = whipEndRequest(handle.resourceUrl);
  closePublish.current = () => {
    handle.close();
    stream.getTracks().forEach((track) => track.stop());
    if (end !== null) {
      void fetch(end.url, { method: end.method }).catch(() => undefined);
    }
  };
  setPreview(stream);
}

function toggleTrack(stream: MediaStream | null, kind: "audio" | "video"): void {
  const track = kind === "audio" ? stream?.getAudioTracks()[0] : stream?.getVideoTracks()[0];
  if (track !== undefined) {
    track.enabled = !track.enabled;
  }
}

function ReplayEditor({ liveId, status }: { liveId: string; status: LiveRecordingStatus }) {
  const [recordingStatus, setRecordingStatus] = useState(status);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState(
    status === "READY" ? "Replay is ready. Publish it or discard it." : "Replay is processing.",
  );

  useEffect(() => {
    if (
      recordingStatus === "READY" ||
      recordingStatus === "FAILED" ||
      recordingStatus === "DISCARDED"
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void createWebApiClient()
        .getLiveReplayStatus(liveId)
        .then((next) => {
          setRecordingStatus(next.recordingStatus);
          if (next.recordingStatus === "READY") {
            setNote("Replay is ready. Publish it or discard it.");
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [liveId, recordingStatus]);

  if (recordingStatus !== "READY") {
    return <p className="hint">{note}</p>;
  }

  return (
    <div className="lv-replay">
      <p className="hint">{note}</p>
      <label className="lv-field">
        Replay title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="lv-end-actions">
        <Button
          onClick={() => {
            void createWebApiClient()
              .updateLiveReplay(liveId, { title, visibility: "EVERYONE" })
              .then(() => setNote("Replay published."))
              .catch(() => setNote("Unable to publish the replay."));
          }}
        >
          Publish replay
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void createWebApiClient()
              .updateLiveReplay(liveId, { visibility: "DISCARD" })
              .then(() => {
                setRecordingStatus("DISCARDED");
                setNote("Replay discarded.");
              })
              .catch(() => setNote("Unable to discard the replay."));
          }}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

async function shareScreen(peer: RTCPeerConnection | null): Promise<void> {
  if (peer === null || !canShareScreen()) {
    return;
  }
  const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const next = display.getVideoTracks()[0];
  const sender = peer.getSenders().find((item) => item.track?.kind === "video");
  if (next !== undefined && sender !== undefined) {
    await sender.replaceTrack(next);
  }
}
