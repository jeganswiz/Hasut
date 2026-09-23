import { loopWithin } from "@hasut/utils";
import { useAudioPlayer } from "expo-audio";
import { useEffect } from "react";

export function PresenceSoundtrack({
  uri,
  startSeconds,
  endSeconds,
}: {
  uri: string;
  startSeconds: number;
  endSeconds: number | null;
}) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });

  useEffect(() => {
    player.loop = endSeconds === null;
    void player.seekTo(startSeconds).then(() => {
      player.play();
    });
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      const next = loopWithin(status.currentTime, startSeconds, endSeconds);
      if (next !== status.currentTime) {
        void player.seekTo(next);
      }
    });
    return () => {
      player.pause();
      sub.remove();
    };
  }, [endSeconds, player, startSeconds]);

  return null;
}
