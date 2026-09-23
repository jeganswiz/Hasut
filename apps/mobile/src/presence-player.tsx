import { loopWithin } from "@hasut/utils";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

export function PresencePlayer({
  uri,
  muted,
  trimStartSeconds,
  trimEndSeconds,
  controls = true,
  contentFit = "contain",
}: {
  uri: string;
  muted: boolean;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  controls?: boolean;
  contentFit?: "contain" | "cover";
}) {
  const player = useVideoPlayer({ uri, contentType: "hls" }, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.currentTime = trimStartSeconds;
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      const next = loopWithin(currentTime, trimStartSeconds, trimEndSeconds);
      if (next !== currentTime) {
        player.currentTime = next;
      }
    });
    return () => {
      sub.remove();
    };
  }, [player, trimStartSeconds, trimEndSeconds]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={controls}
      contentFit={contentFit}
    />
  );
}
