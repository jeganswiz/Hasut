import { HasutApiError } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type { LiveSessionView, StoryView, ThemeTokens } from "@hasut/types";
import { mutesOriginalAudio, storyAudioSrc, storyVisualState } from "@hasut/utils";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { createMobileApiClient, mobileApiBaseUrl } from "./api";
import { PresencePlayer } from "./presence-player";
import { PresenceSoundtrack } from "./presence-soundtrack";
import {
  initialPresenceTab,
  isHlsDocument,
  LIVE_PLAYLIST_POLL_MS,
  livePlaybackUri,
  liveStageCopy,
  presenceEmpty,
  storyAudioUri,
  storyPlaybackUri,
  storyStageCopy,
  type PresenceTab,
} from "./presence-state";

export function PresenceScreen() {
  const params = useLocalSearchParams<{ memberId: string }>();
  const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [stories, setStories] = useState<StoryView[]>([]);
  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [tab, setTab] = useState<PresenceTab>("activity");
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("Loading presence…");
  const styles = makeStyles(tokens);
  const current = stories[index] ?? null;

  useEffect(() => {
    if (memberId === undefined) {
      setMessage("Missing member.");
      return;
    }
    const client = createMobileApiClient();
    void Promise.all([
      client.listMemberStories(memberId),
      client.getMemberLive(memberId).catch(() => null),
    ])
      .then(([nextStories, nextLive]) => {
        setStories(nextStories);
        setLive(nextLive);
        setTab(initialPresenceTab(nextStories, nextLive));
        setIndex(0);
        setMessage(
          presenceEmpty(nextStories, nextLive)
            ? "No active story. The map pin still shows their profile."
            : "",
        );
      })
      .catch((error: unknown) => {
        setMessage(error instanceof HasutApiError ? error.message : "Unable to open this story.");
      });
  }, [memberId]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Presence</Text>
      {live !== null ? (
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
      ) : null}
      {message.length > 0 ? <Text style={styles.status}>{message}</Text> : null}
      {tab === "live" && live !== null ? (
        <LiveStage live={live} styles={styles} />
      ) : current !== null ? (
        <StoryStage
          story={current}
          index={index}
          total={stories.length}
          onBack={() => setIndex((value) => Math.max(0, value - 1))}
          onNext={() => setIndex((value) => Math.min(stories.length - 1, value + 1))}
          styles={styles}
        />
      ) : null}
      <Link href="/">
        <Text style={styles.chipLabel}>Map</Text>
      </Link>
    </View>
  );
}

function StoryStage({
  story,
  index,
  total,
  onBack,
  onNext,
  styles,
}: {
  story: StoryView;
  index: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const visual = storyVisualState(story);
  const origin = mobileApiBaseUrl();
  const hint = storyStageCopy(story, origin);
  const playbackUri = storyPlaybackUri(story, origin);
  const audioUri = storyAudioUri(story, origin);
  const audioTitle = storyAudioSrc(story) === null ? null : story.audio.title;

  return (
    <View style={styles.stage}>
      <View style={styles.frame}>
        {visual === "image" && story.imageUrl !== null ? (
          <Image source={{ uri: story.imageUrl }} style={styles.media} />
        ) : null}
        {playbackUri !== null ? (
          <PresencePlayer
            key={playbackUri}
            uri={playbackUri}
            muted={mutesOriginalAudio(story.kind, story.originalAudioMode)}
            trimStartSeconds={story.trimStartSeconds}
            trimEndSeconds={story.trimEndSeconds}
          />
        ) : null}
        {hint.length > 0 ? <Text style={styles.frameNote}>{hint}</Text> : null}
        {story.caption.trim().length === 0 ? null : (
          <Text
            style={[
              styles.caption,
              story.captionColor !== null ? { color: story.captionColor } : null,
            ]}
          >
            {story.caption}
          </Text>
        )}
      </View>
      {audioUri !== null ? (
        <PresenceSoundtrack
          key={`${audioUri}:${story.audio.startSeconds}:${story.audio.endSeconds ?? "end"}`}
          uri={audioUri}
          startSeconds={story.audio.startSeconds}
          endSeconds={story.audio.endSeconds}
        />
      ) : null}
      {audioTitle === null ? null : <Text style={styles.status}>{audioTitle}</Text>}
      <View style={styles.row}>
        <Pressable style={styles.chip} onPress={onBack} disabled={index === 0}>
          <Text style={styles.chipLabel}>Back</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={onNext} disabled={index >= total - 1}>
          <Text style={styles.chipLabel}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LiveStage({
  live,
  styles,
}: {
  live: LiveSessionView;
  styles: ReturnType<typeof makeStyles>;
}) {
  const uri = livePlaybackUri(live, mobileApiBaseUrl());
  const ready = useReadyPlaylist(uri);

  return (
    <View style={styles.stage}>
      <View style={styles.frame}>
        {ready && uri !== null ? (
          <PresencePlayer
            key={uri}
            uri={uri}
            muted={false}
            trimStartSeconds={0}
            trimEndSeconds={null}
          />
        ) : null}
        <Text style={styles.liveTitle}>{live.title.length === 0 ? "Live" : live.title}</Text>
        <Text style={styles.frameNote}>
          {ready ? liveStageCopy(live, mobileApiBaseUrl()) : "Waiting for the live preview"}
        </Text>
      </View>
    </View>
  );
}

function useReadyPlaylist(uri: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (uri === null) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const probe = (): void => {
      void fetch(uri)
        .then(async (response) => {
          const body = response.ok ? await response.text() : "";
          return isHlsDocument(response.status, body);
        })
        .then((ok) => {
          if (cancelled) {
            return;
          }
          if (ok) {
            setReady(true);
            return;
          }
          timer = setTimeout(probe, LIVE_PLAYLIST_POLL_MS);
        })
        .catch(() => {
          if (!cancelled) {
            timer = setTimeout(probe, LIVE_PLAYLIST_POLL_MS);
          }
        });
    };
    probe();
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [uri]);
  return ready;
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, padding: 16, gap: 12, backgroundColor: tokens.background },
    title: { fontSize: 24, fontWeight: "700", color: tokens.text },
    status: { color: tokens.mutedText },
    row: { flexDirection: "row", gap: 8 },
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
    stage: { gap: 12 },
    frame: {
      minHeight: 280,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: tokens.text,
      justifyContent: "flex-end",
      padding: 16,
    },
    media: { ...StyleSheet.absoluteFill },
    frameNote: { color: tokens.textOnPrimary, textAlign: "center" },
    liveTitle: { color: tokens.textOnPrimary, fontWeight: "700", fontSize: 18 },
    caption: {
      color: tokens.textOnPrimary,
      fontWeight: "700",
      textAlign: "center",
    },
  });
}
