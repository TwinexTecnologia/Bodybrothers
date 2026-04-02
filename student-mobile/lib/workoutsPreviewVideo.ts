import { useCallback, useEffect, useRef } from "react";

export type Mp4PreviewPlayer = {
  replaceAsync: (source: { uri: string } | null) => Promise<void>;
  play: () => void;
  pause: () => void;
};

export function isMp4Url(url?: string) {
  return !!url && (url.includes(".mp4") || url.includes("video"));
}

export function getYoutubeId(url: string) {
  const match = url.match(/^.*(youtu.be\/|watch\?v=|embed\/|shorts\/)([^#&?]*).*/);
  return match?.[2];
}

export function useMp4PreviewVideo({
  player,
  mp4Url,
  setLoading,
  debug,
}: {
  player: Mp4PreviewPlayer;
  mp4Url: string | null;
  setLoading: (loading: boolean) => void;
  debug?: (message: string, data?: Record<string, unknown>) => void;
}) {
  const lastLoadedUriRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    lastLoadedUriRef.current = null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!mp4Url) {
        if (lastLoadedUriRef.current !== null) {
          debug?.("previewVideo:clear");
        }
        lastLoadedUriRef.current = null;
        player.pause();
        try {
          await player.replaceAsync(null);
        } catch {
          setLoading(false);
        }
        return;
      }

      if (lastLoadedUriRef.current === mp4Url) {
        debug?.("previewVideo:skip_reload", { uri: mp4Url });
        return;
      }

      lastLoadedUriRef.current = mp4Url;
      debug?.("previewVideo:load", { uri: mp4Url });
      try {
        setLoading(true);
        await player.replaceAsync({ uri: mp4Url });
        player.play();
      } catch {
        setLoading(false);
      }
    };

    void load();
  }, [debug, mp4Url, player, setLoading]);

  return { reset };
}
