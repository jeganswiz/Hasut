import { HasutApiError } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type {
  AudioTrackView,
  LiveSessionView,
  StoryAudience,
  StoryComposerConfig,
  StoryOriginalAudioMode,
  ThemeTokens,
} from "@hasut/types";
import { formatClock, moveHandle, type RangeValue } from "@hasut/utils";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient } from "./api";
import {
  captionFits,
  composerBudgetHint,
  imageStoryInput,
  initialVideoTrim,
  liveTitleReady,
  overlayNeedsTrack,
  patronAudienceHint,
  pickerDurationSeconds,
  pickCaptionColor,
  videoStoryInput,
  videoTrimBounds,
  type ComposerTab,
  type StoryKindChoice,
} from "./composer-state";

interface PickedMedia {
  uri: string;
  mimeType: string;
  byteSize: number;
  durationSeconds: number | null;
}

export function ComposerScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [tab, setTab] = useState<ComposerTab>("activity");
  const [config, setConfig] = useState<StoryComposerConfig | null>(null);
  const [tracks, setTracks] = useState<AudioTrackView[]>([]);
  const [message, setMessage] = useState("Loading the composer…");
  const styles = makeStyles(tokens);

  useEffect(() => {
    const client = createMobileApiClient();
    void (async () => {
      try {
        const composer = await client.storyComposerConfig();
        const library = composer.audioLibraryEnabled
          ? await client.listAudioTracks().catch(() => [])
          : [];
        setConfig(composer);
        setTracks(library);
        setMessage("");
      } catch (error) {
        setMessage(
          error instanceof HasutApiError ? error.message : "Stories are not available right now.",
        );
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Presence story</Text>
      <Text style={styles.status}>A time-bounded presence on the discovery map.</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.chip, tab === "activity" ? styles.chipActive : null]}
          onPress={() => setTab("activity")}
        >
          <Text style={tab === "activity" ? styles.chipActiveLabel : styles.chipLabel}>
            Activity
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === "live" ? styles.chipActive : null]}
          onPress={() => setTab("live")}
        >
          <Text style={tab === "live" ? styles.chipActiveLabel : styles.chipLabel}>Live</Text>
        </Pressable>
      </View>
      {config === null ? (
        <Text style={styles.status}>{message}</Text>
      ) : tab === "activity" ? (
        <ActivityComposer config={config} tracks={tracks} tokens={tokens} styles={styles} />
      ) : (
        <LiveComposer patronCount={config.patronCount} styles={styles} />
      )}
      <Link href="/">
        <Text style={styles.chipLabel}>Map</Text>
      </Link>
    </ScrollView>
  );
}

function ActivityComposer({
  config,
  tracks,
  tokens,
  styles,
}: {
  config: StoryComposerConfig;
  tracks: AudioTrackView[];
  tokens: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [kind, setKind] = useState<StoryKindChoice>("IMAGE");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [captionColor, setCaptionColor] = useState<string | null>(null);
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [originalAudio, setOriginalAudio] = useState<StoryOriginalAudioMode>("KEEP");
  const [trim, setTrim] = useState<RangeValue>({ start: 0, end: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(composerBudgetHint(config));

  function switchKind(next: StoryKindChoice): void {
    setKind(next);
    setMedia(null);
    setTrim({ start: 0, end: 0 });
    setOriginalAudio("KEEP");
    setMessage(composerBudgetHint(config));
  }

  async function pickMedia(): Promise<void> {
    try {
      const ImagePicker = await import("expo-image-picker");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "IMAGE" ? ["images"] : ["videos"],
        quality: 0.8,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset === undefined) {
        return;
      }
      const durationSeconds =
        kind === "VIDEO" && typeof asset.duration === "number" && asset.duration > 0
          ? pickerDurationSeconds(asset.duration)
          : null;
      setMedia({
        uri: asset.uri,
        mimeType: asset.mimeType ?? (kind === "IMAGE" ? "image/jpeg" : "video/mp4"),
        byteSize: asset.fileSize ?? 0,
        durationSeconds,
      });
      if (durationSeconds !== null) {
        setTrim(initialVideoTrim(durationSeconds, config.maxVideoDurationSeconds));
      } else if (kind === "VIDEO") {
        setTrim(initialVideoTrim(config.maxVideoDurationSeconds, config.maxVideoDurationSeconds));
      }
      setMessage(composerBudgetHint(config));
    } catch {
      setMessage(
        kind === "IMAGE"
          ? "Photo picking is not available in this build."
          : "Video picking is not available in this build.",
      );
    }
  }

  async function publish(): Promise<void> {
    if (media === null) {
      setMessage(`Choose a ${kind === "IMAGE" ? "photo" : "video"} first.`);
      return;
    }
    if (!captionFits(caption, config.captionMaxLength)) {
      setMessage(`Keep the caption under ${config.captionMaxLength} characters`);
      return;
    }
    if (overlayNeedsTrack(kind, originalAudio, trackId)) {
      setMessage("Pick a track to layer over the original sound.");
      return;
    }
    setBusy(true);
    setMessage("Uploading your story…");
    try {
      const client = createMobileApiClient();
      const blob = await (await fetch(media.uri)).blob();
      const presign = await client.presignMedia({
        purpose: kind === "IMAGE" ? "STORY_IMAGE" : "STORY_VIDEO",
        mimeType: media.mimeType,
        byteSize: media.byteSize > 0 ? media.byteSize : blob.size,
      });
      await client.uploadPresigned(presign.uploadUrl, blob, presign.headers);
      await client.completeMedia({ mediaId: presign.mediaId });
      setMessage("Publishing…");
      const story = await client.createStory(
        kind === "IMAGE"
          ? imageStoryInput({
              imageMediaId: presign.mediaId,
              caption,
              captionColor,
              audience,
              trackId,
            })
          : videoStoryInput({
              videoMediaId: presign.mediaId,
              caption,
              captionColor,
              audience,
              trackId,
              originalAudioMode: originalAudio,
              trim,
            }),
      );
      setMedia(null);
      setCaption("");
      setCaptionColor(null);
      setTrackId(null);
      setOriginalAudio("KEEP");
      setTrim({ start: 0, end: 0 });
      setMessage(
        audience === "PATRONS"
          ? `Story published to your Patrons. Live until ${new Date(story.expiresAt).toLocaleTimeString()}.`
          : `Story published. Live until ${new Date(story.expiresAt).toLocaleTimeString()}.`,
      );
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to publish that story.");
    } finally {
      setBusy(false);
    }
  }

  const trimBounds = videoTrimBounds(
    media?.durationSeconds ?? config.maxVideoDurationSeconds,
    config.maxVideoDurationSeconds,
  );

  return (
    <View style={styles.block}>
      <Text style={styles.status}>{message}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.chip, kind === "IMAGE" ? styles.chipActive : null]}
          onPress={() => switchKind("IMAGE")}
          disabled={busy}
        >
          <Text style={kind === "IMAGE" ? styles.chipActiveLabel : styles.chipLabel}>Photo</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, kind === "VIDEO" ? styles.chipActive : null]}
          onPress={() => switchKind("VIDEO")}
          disabled={busy}
        >
          <Text style={kind === "VIDEO" ? styles.chipActiveLabel : styles.chipLabel}>Video</Text>
        </Pressable>
      </View>
      <Pressable style={styles.button} onPress={() => void pickMedia()} disabled={busy}>
        <Text style={styles.buttonLabel}>
          {media === null
            ? kind === "IMAGE"
              ? "Choose photo"
              : "Choose video"
            : kind === "IMAGE"
              ? "Replace photo"
              : "Replace video"}
        </Text>
      </Pressable>
      {media === null ? null : kind === "IMAGE" ? (
        <Image source={{ uri: media.uri }} style={styles.preview} />
      ) : (
        <Text style={styles.status}>
          Clip {formatClock(trim.start)} – {formatClock(trim.end)}
        </Text>
      )}
      {kind === "VIDEO" && media !== null ? (
        <View style={styles.block}>
          <View style={styles.row}>
            <Pressable
              style={styles.chip}
              disabled={busy}
              onPress={() =>
                setTrim((current) => moveHandle(current, "start", current.start - 1, trimBounds))
              }
            >
              <Text style={styles.chipLabel}>Start –</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              disabled={busy}
              onPress={() =>
                setTrim((current) => moveHandle(current, "start", current.start + 1, trimBounds))
              }
            >
              <Text style={styles.chipLabel}>Start +</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              disabled={busy}
              onPress={() =>
                setTrim((current) => moveHandle(current, "end", current.end - 1, trimBounds))
              }
            >
              <Text style={styles.chipLabel}>End –</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              disabled={busy}
              onPress={() =>
                setTrim((current) => moveHandle(current, "end", current.end + 1, trimBounds))
              }
            >
              <Text style={styles.chipLabel}>End +</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            {(["KEEP", "MUTE", "OVERLAY"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.chip, originalAudio === mode ? styles.chipActive : null]}
                disabled={busy}
                onPress={() => setOriginalAudio(mode)}
              >
                <Text style={originalAudio === mode ? styles.chipActiveLabel : styles.chipLabel}>
                  {mode === "KEEP"
                    ? "Keep original sound"
                    : mode === "MUTE"
                      ? "Mute original sound"
                      : "Layer over original"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <TextInput
        style={styles.input}
        value={caption}
        onChangeText={setCaption}
        placeholder="Caption"
        maxLength={config.captionMaxLength}
        editable={!busy}
      />
      <Text style={styles.status}>
        {caption.length} / {config.captionMaxLength}
      </Text>
      <View style={styles.row}>
        {config.captionColors.map((color) => {
          const selected = captionColor === color;
          return (
            <Pressable
              key={color}
              onPress={() => setCaptionColor(pickCaptionColor(color, config.captionColors))}
              disabled={busy}
              style={[
                styles.swatch,
                { backgroundColor: color },
                selected ? { borderColor: tokens.text } : null,
              ]}
            />
          );
        })}
      </View>
      <AudienceRow
        value={audience}
        patronCount={config.patronCount}
        disabled={busy}
        styles={styles}
        onChange={setAudience}
      />
      {tracks.length === 0 ? null : (
        <View style={styles.block}>
          <Text style={styles.status}>HASUT soundtrack</Text>
          <Pressable style={styles.chip} onPress={() => setTrackId(null)} disabled={busy}>
            <Text style={styles.chipLabel}>No track</Text>
          </Pressable>
          {tracks.map((track) => (
            <Pressable
              key={track.id}
              style={[styles.chip, trackId === track.id ? styles.chipActive : null]}
              onPress={() => setTrackId(track.id)}
              disabled={busy}
            >
              <Text style={trackId === track.id ? styles.chipActiveLabel : styles.chipLabel}>
                {track.title} — {track.artist}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable style={styles.button} onPress={() => void publish()} disabled={busy}>
        <Text style={styles.buttonLabel}>{busy ? "Publishing…" : "Publish"}</Text>
      </Pressable>
    </View>
  );
}

function LiveComposer({
  patronCount,
  styles,
}: {
  patronCount: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<StoryAudience>("EVERYONE");
  const [session, setSession] = useState<LiveSessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Going live puts a live preview on your map pin. The camera stays on the web composer.",
  );

  useEffect(() => {
    void createMobileApiClient()
      .getMyLive()
      .then((current) => {
        if (current !== null) {
          setSession(current);
          setTitle(current.title);
          setAudience(current.audience);
        }
      })
      .catch(() => undefined);
  }, []);

  async function goLive(): Promise<void> {
    if (!liveTitleReady(title)) {
      setMessage("Give your live a title so people know to join.");
      return;
    }
    setBusy(true);
    setMessage("Opening your live session…");
    try {
      const started = await createMobileApiClient().startLive({ title, audience });
      setSession(started);
      setMessage(
        started.audience === "PATRONS"
          ? "You are live for your Patrons. Send the camera from the web composer."
          : "You are live. Send the camera from the web composer.",
      );
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to go live.");
    } finally {
      setBusy(false);
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    setMessage("Ending your live session…");
    try {
      await createMobileApiClient().endLive();
      setSession(null);
      setTitle("");
      setMessage("Live ended. Your pin is back to your profile.");
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to end the session.");
    } finally {
      setBusy(false);
    }
  }

  if (session !== null) {
    return (
      <View style={styles.block}>
        <Text style={styles.cardTitle}>{session.title}</Text>
        <Text style={styles.status}>
          Live now · {session.audience === "PATRONS" ? "Patrons only" : "Everyone nearby"}
        </Text>
        <Text style={styles.status}>{message}</Text>
        <Pressable style={styles.button} onPress={() => void stop()} disabled={busy}>
          <Text style={styles.buttonLabel}>{busy ? "Ending…" : "End live"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.status}>{message}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Live title"
        maxLength={80}
        editable={!busy}
      />
      <AudienceRow
        value={audience}
        patronCount={patronCount}
        disabled={busy}
        styles={styles}
        onChange={setAudience}
      />
      <Pressable style={styles.button} onPress={() => void goLive()} disabled={busy}>
        <Text style={styles.buttonLabel}>{busy ? "Starting…" : "Go live"}</Text>
      </Pressable>
    </View>
  );
}

function AudienceRow({
  value,
  patronCount,
  disabled,
  styles,
  onChange,
}: {
  value: StoryAudience;
  patronCount: number;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
  onChange: (next: StoryAudience) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.status}>Audience</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.chip, value === "EVERYONE" ? styles.chipActive : null]}
          onPress={() => onChange("EVERYONE")}
          disabled={disabled}
        >
          <Text style={value === "EVERYONE" ? styles.chipActiveLabel : styles.chipLabel}>
            Everyone nearby
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, value === "PATRONS" ? styles.chipActive : null]}
          onPress={() => onChange("PATRONS")}
          disabled={disabled}
        >
          <Text style={value === "PATRONS" ? styles.chipActiveLabel : styles.chipLabel}>
            {patronCount === 0 ? "Patrons only" : `Patrons only (${patronCount})`}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.status}>
        {value === "PATRONS"
          ? patronAudienceHint(patronCount)
          : "Anyone who finds you on the discovery map."}
      </Text>
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.background },
    pad: { padding: 16, gap: 12 },
    title: { fontSize: 24, fontWeight: "700", color: tokens.text },
    status: { color: tokens.mutedText },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    block: { gap: 10 },
    chip: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    chipLabel: { color: tokens.text, fontWeight: "600" },
    chipActiveLabel: { color: tokens.textOnPrimary, fontWeight: "600" },
    input: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 12,
      padding: 12,
      color: tokens.text,
    },
    button: {
      backgroundColor: tokens.primary,
      borderRadius: 14,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonLabel: { color: tokens.textOnPrimary, fontWeight: "700" },
    preview: { width: "100%", height: 220, borderRadius: 16, backgroundColor: tokens.border },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: tokens.border,
    },
    cardTitle: { fontWeight: "700", color: tokens.text, fontSize: 16 },
  });
}
