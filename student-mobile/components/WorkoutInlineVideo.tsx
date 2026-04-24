import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  X,
} from "lucide-react-native";
import { VideoView } from "expo-video";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";
import { useVideoStrings } from "../lib/videoStrings";

type ExpoVideoLikePlayer = {
  play: () => void;
  pause: () => void;
  muted: boolean;
  volume: number;
  currentTime: number;
  readonly duration: number;
  readonly playing: boolean;
  timeUpdateEventInterval: number;
  playbackRate: number;
  addListener: (
    event: string,
    listener: (payload: any) => void,
  ) => { remove: () => void };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * 16:9 "cover" dentro de um contêiner retrato (ou qualquer tamanho), para
 * o iframe do YouTube preencher e ser recortado como a thumbnail.
 */
function getYoutube16by9CoverLayout(
  containerW: number,
  containerH: number,
): { width: number; height: number; left: number; top: number } {
  if (containerW <= 0 || containerH <= 0) {
    return { width: 1, height: 1, left: 0, top: 0 };
  }
  const wByHeight = (containerH * 16) / 9;
  if (wByHeight >= containerW) {
    return {
      width: wByHeight,
      height: containerH,
      left: (containerW - wByHeight) / 2,
      top: 0,
    };
  }
  const hByWidth = (containerW * 9) / 16;
  return {
    width: containerW,
    height: hByWidth,
    left: 0,
    top: (containerH - hByWidth) / 2,
  };
}

function ControlButton({
  icon,
  label,
  onPress,
  disabled,
  testID,
  tone,
  variant,
  size,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  tone: {
    fg: string;
    bg: string;
    bgPressed: string;
    bgHover: string;
    border: string;
  };
  variant?: "regular" | "primary";
  size: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={(state) => {
        const hovered = !!(state as any).hovered;
        return [
          styles.controlButton,
          {
            backgroundColor: state.pressed
              ? tone.bgPressed
              : hovered
                ? tone.bgHover
                : tone.bg,
            borderColor: tone.border,
            opacity: disabled ? 0.55 : 1,
            width: size,
            height: size,
            minWidth: size,
            minHeight: size,
          },
          variant === "primary" ? styles.controlButtonPrimary : null,
        ];
      }}
      hitSlop={6}
    >
      {icon}
    </Pressable>
  );
}

function ProgressBar({
  currentTime,
  duration,
  onSeek,
  testID,
  tone,
  label,
  containerWidth,
  verticalPadding,
}: {
  currentTime: number;
  duration: number;
  onSeek: (targetSeconds: number) => void;
  testID?: string;
  tone: { track: string; fill: string; knob: string };
  label: string;
  containerWidth: number;
  verticalPadding: number;
}) {
  const ratio = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;
  const widthRef = useRef(Math.max(1, containerWidth));
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      testID={testID}
      onPress={(e) => {
        const w = widthRef.current || 1;
        const x = (e as any).nativeEvent?.locationX ?? 0;
        const nextRatio = clamp(x / w, 0, 1);
        onSeek(nextRatio * duration);
      }}
      style={[styles.progressHitArea, { paddingVertical: verticalPadding }]}
    >
      <View
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width || 1;
        }}
        style={[styles.progressTrack, { backgroundColor: tone.track }]}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${ratio * 100}%`, backgroundColor: tone.fill },
          ]}
        />
        <View
          style={[
            styles.progressKnob,
            { left: `${ratio * 100}%`, backgroundColor: tone.knob },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default memo(function WorkoutInlineVideo({
  width,
  height,
  isMp4,
  mp4Player,
  mp4Url,
  youtubeId,
  onRequestFullscreen,
  onRequestClose,
  testIDPrefix,
  alwaysShowControls = false,
  compactControls,
  showFullscreenButton = true,
  flatRoot = false,
  contentVariant = "inline",
  safeAreaInsets,
}: {
  width: number;
  height: number;
  isMp4: boolean;
  mp4Player: ExpoVideoLikePlayer;
  mp4Url?: string | null;
  youtubeId?: string | null;
  onRequestFullscreen: () => void;
  onRequestClose: () => void;
  testIDPrefix: string;
  /** Desativa auto-hide e mantém a barra de controle visível (ex.: modal tela cheia do app). */
  alwaysShowControls?: boolean;
  compactControls?: boolean;
  showFullscreenButton?: boolean;
  flatRoot?: boolean;
  /** `fullscreen`: fundo preto, sem relógio no topo, superfície de vídeo otimizada para tela cheia. */
  contentVariant?: "inline" | "fullscreen";
  safeAreaInsets?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}) {
  const scheme = useColorScheme();
  const { t } = useVideoStrings();
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [youtubePlay, setYoutubePlay] = useState(false);
  const [youtubeMute, setYoutubeMute] = useState(false);
  const [youtubeVolume, setYoutubeVolume] = useState(100);
  const [youtubeDuration, setYoutubeDuration] = useState(0);
  const [youtubeTime, setYoutubeTime] = useState(0);
  const [youtubeError, setYoutubeError] = useState(false);
  const youtubeRef = useRef<YoutubeIframeRef | null>(null);
  const mp4LoopGuardRef = useRef(false);
  const lastTapMsRef = useRef(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tone = useMemo(() => {
    const light = scheme !== "dark";
    return {
      fg: light ? "#0b1220" : "#fff",
      rootBg: light ? "#e2e8f0" : "#0b1220",
      overlay: light ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.6)",
      button: {
        fg: "#fff",
        bg: light ? "rgba(17,24,39,0.45)" : "rgba(15,23,42,0.55)",
        bgPressed: "rgba(59,130,246,0.55)",
        bgHover: "rgba(59,130,246,0.35)",
        border: "rgba(255,255,255,0.18)",
      },
      progress: {
        track: "rgba(255,255,255,0.22)",
        fill: "#3b82f6",
        knob: "#fff",
      },
    };
  }, [scheme]);

  const youtubeCover = useMemo(
    () => getYoutube16by9CoverLayout(width, height),
    [width, height],
  );
  const isCompactControls = compactControls ?? width <= 140;
  const isFullscreenContent = contentVariant === "fullscreen";
  const rootBackgroundColor = isFullscreenContent ? "#000" : tone.rootBg;
  const mediaBackgroundColor = isFullscreenContent ? "#000" : undefined;
  const overlayInsets = safeAreaInsets ?? {};
  const metrics = useMemo(
    () => {
      if (!isCompactControls) {
        if (isFullscreenContent) {
          if (height < 620) {
            return {
              closeIcon: 18,
              sideIcon: 18,
              playIcon: 20,
              button: 38,
              primaryButton: 46,
              overlayPadding: 8,
              gap: 8,
              clockFont: 11,
              progressPadding: 6,
            };
          }
          if (height < 760) {
            return {
              closeIcon: 20,
              sideIcon: 20,
              playIcon: 22,
              button: 42,
              primaryButton: 50,
              overlayPadding: 9,
              gap: 8,
              clockFont: 12,
              progressPadding: 7,
            };
          }
        }
        return {
            closeIcon: 20,
            sideIcon: 20,
            playIcon: 24,
            button: 44,
            primaryButton: 56,
            overlayPadding: 10,
            gap: 10,
            clockFont: 12,
            progressPadding: 8,
          };
      }

      const gap = 4;
      const overlayPadding = 5;
      const availableWidth = Math.max(72, width - overlayPadding * 2);
      const button = clamp(
        Math.floor((availableWidth - gap * 2 - 6) / 3),
        22,
        28,
      );
      const primaryButton = clamp(button + 6, 28, 34);

      return {
        closeIcon: button >= 26 ? 16 : 14,
        sideIcon: button >= 26 ? 14 : 12,
        playIcon: primaryButton >= 32 ? 18 : 16,
        button,
        primaryButton,
        overlayPadding,
        gap,
        clockFont: 10,
        progressPadding: 4,
      };
    },
    [height, isCompactControls, isFullscreenContent, width],
  );

  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [overlayOpacity]);

  const hideControls = useCallback(() => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setControlsVisible(false);
    });
  }, [overlayOpacity]);

  useEffect(() => {
    if (alwaysShowControls) return;
    if (!controlsVisible) return;
    const id = setTimeout(() => {
      hideControls();
    }, 2500);
    return () => clearTimeout(id);
  }, [alwaysShowControls, controlsVisible, hideControls]);

  useEffect(() => {
    if (!isMp4) return;
    mp4Player.timeUpdateEventInterval = 0.25;
    setIsPlaying(!!mp4Player.playing);
    setMuted(!!mp4Player.muted);
    setVolume(Number.isFinite(mp4Player.volume) ? mp4Player.volume : 1);
    setCurrentTime(
      Number.isFinite(mp4Player.currentTime) ? mp4Player.currentTime : 0,
    );
    setDuration(Number.isFinite(mp4Player.duration) ? mp4Player.duration : 0);
    mp4LoopGuardRef.current = false;

    const subPlay = mp4Player.addListener("playingChange", (p: any) => {
      setIsPlaying(!!p?.isPlaying);
    });
    const subTime = mp4Player.addListener("timeUpdate", (p: any) => {
      if (typeof p?.currentTime === "number") {
        const tNow = p.currentTime;
        setCurrentTime(tNow);
        const d = Number.isFinite(mp4Player.duration) ? mp4Player.duration : 0;
        if (
          !mp4LoopGuardRef.current &&
          d > 0.5 &&
          mp4Player.playing &&
          tNow >= d - 0.15
        ) {
          mp4LoopGuardRef.current = true;
          try {
            mp4Player.currentTime = 0;
            mp4Player.play();
          } catch {}
        }
        if (mp4LoopGuardRef.current && tNow < Math.max(0, d - 1.5)) {
          mp4LoopGuardRef.current = false;
        }
      }
      if (typeof p?.bufferedPosition === "number") return;
    });
    const subMuted = mp4Player.addListener("mutedChange", (p: any) => {
      if (typeof p?.muted === "boolean") setMuted(p.muted);
    });
    const subVol = mp4Player.addListener("volumeChange", (p: any) => {
      if (typeof p?.volume === "number") setVolume(p.volume);
    });
    const subLoad = mp4Player.addListener("sourceLoad", () => {
      setDuration(Number.isFinite(mp4Player.duration) ? mp4Player.duration : 0);
    });

    return () => {
      mp4Player.timeUpdateEventInterval = 0;
      subPlay.remove();
      subTime.remove();
      subMuted.remove();
      subVol.remove();
      subLoad.remove();
    };
  }, [isMp4, mp4Player, mp4Url]);

  useEffect(() => {
    if (isMp4) return;
    let mounted = true;
    setYoutubeError(false);
    const tick = async () => {
      try {
        const ref = youtubeRef.current;
        if (!ref) return;
        const [d, tNow] = await Promise.all([
          ref.getDuration(),
          ref.getCurrentTime(),
        ]);
        if (!mounted) return;
        if (Number.isFinite(d)) setYoutubeDuration(d);
        if (Number.isFinite(tNow)) setYoutubeTime(tNow);
      } catch {}
    };
    if (!youtubePlay) {
      void tick();
      return () => {
        mounted = false;
      };
    }
    const id = setInterval(() => {
      void tick();
    }, 1000);
    return () => {
      mounted = false;
      if (id) clearInterval(id);
    };
  }, [isMp4, youtubeId, youtubePlay]);

  const onTogglePlay = useCallback(() => {
    showControls();
    if (isMp4) {
      if (mp4Player.playing) mp4Player.pause();
      else mp4Player.play();
      return;
    }
    setYoutubeError(false);
    setYoutubePlay((v) => !v);
  }, [isMp4, mp4Player, showControls]);

  const onToggleMute = useCallback(() => {
    showControls();
    if (isMp4) {
      mp4Player.muted = !mp4Player.muted;
      return;
    }
    setYoutubeMute((v) => !v);
  }, [isMp4, mp4Player, showControls]);

  const onSeek = useCallback(
    (targetSeconds: number) => {
      showControls();
      if (isMp4) {
        mp4Player.currentTime = targetSeconds;
        return;
      }
      youtubeRef.current?.seekTo(targetSeconds, true);
    },
    [isMp4, mp4Player, showControls],
  );

  const onYouTubeStateChange = useCallback(
    (state: string) => {
      if (state === "ended") {
        try {
          youtubeRef.current?.seekTo(0, true);
        } catch {}
        setYoutubePlay(true);
      }
    },
    [setYoutubePlay],
  );

  const requestFullscreen = useCallback(() => {
    showControls();
    onRequestFullscreen();
  }, [onRequestFullscreen, showControls]);

  const onTapSurface = useCallback(() => {
    showControls();
    const now = Date.now();
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
      singleTapTimeoutRef.current = null;
    }

    if (now - lastTapMsRef.current <= 260) {
      lastTapMsRef.current = 0;
      requestFullscreen();
      return;
    }

    lastTapMsRef.current = now;
    singleTapTimeoutRef.current = setTimeout(() => {
      lastTapMsRef.current = 0;
      singleTapTimeoutRef.current = null;
      onTogglePlay();
    }, 260);
  }, [onTogglePlay, requestFullscreen, showControls]);

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current)
        clearTimeout(singleTapTimeoutRef.current);
    };
  }, []);

  const clock = useMemo(() => {
    const tNow = isMp4 ? currentTime : youtubeTime;
    const d = isMp4 ? duration : youtubeDuration;
    return `${formatClock(tNow)} / ${formatClock(d)}`;
  }, [currentTime, duration, isMp4, youtubeDuration, youtubeTime]);

  const progressCurrent = isMp4 ? currentTime : youtubeTime;
  const progressDuration = isMp4 ? duration : youtubeDuration;

  return (
    <View
      style={[
        styles.root,
        flatRoot ? styles.rootFlat : null,
        { width, height, backgroundColor: rootBackgroundColor },
      ]}
      testID={`${testIDPrefix}-root`}
    >
      <View
        style={[
          styles.media,
          mediaBackgroundColor
            ? { backgroundColor: mediaBackgroundColor }
            : null,
        ]}
      >
        {isMp4 ? (
          <VideoView
            player={mp4Player as any}
            style={styles.video}
            nativeControls={false}
            contentFit="cover"
            fullscreenOptions={{ enable: false }}
            {...(Platform.OS === "android"
              ? {
                  surfaceType: "textureView" as const,
                }
              : {})}
          />
        ) : (
          <View style={styles.youtubeCoverContainer}>
            <View
              style={[
                styles.youtubeCoverInner,
                {
                  left: youtubeCover.left,
                  top: youtubeCover.top,
                  width: youtubeCover.width,
                  height: youtubeCover.height,
                },
              ]}
            >
              <YoutubePlayer
                key={youtubeId || "youtube"}
                ref={youtubeRef}
                height={youtubeCover.height}
                width={youtubeCover.width}
                play={youtubePlay}
                mute={youtubeMute}
                volume={youtubeVolume}
                videoId={youtubeId || undefined}
                initialPlayerParams={{ controls: false, preventFullScreen: true }}
                onChangeState={onYouTubeStateChange as any}
                onReady={() => setYoutubeError(false)}
                onError={() => {
                  setYoutubeError(true);
                  setYoutubePlay(false);
                  showControls();
                }}
              />
            </View>
          </View>
        )}
      </View>

      <Pressable
        style={StyleSheet.absoluteFill}
        testID={`${testIDPrefix}-surface`}
        accessibilityRole="button"
        accessibilityLabel={t("video")}
        accessibilityHint={`${t("tap_to_toggle")}. ${t("double_tap_fullscreen")}.`}
        onPress={onTapSurface}
      />

      {controlsVisible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              backgroundColor: tone.overlay,
              opacity: overlayOpacity,
              paddingTop: metrics.overlayPadding + (overlayInsets.top ?? 0),
              paddingRight: metrics.overlayPadding + (overlayInsets.right ?? 0),
              paddingBottom:
                metrics.overlayPadding + (overlayInsets.bottom ?? 0),
              paddingLeft: metrics.overlayPadding + (overlayInsets.left ?? 0),
            },
          ]}
        >
          <View style={[styles.topRow, { gap: metrics.gap }]}>
            {!isCompactControls && !isFullscreenContent ? (
              <Text
                style={[
                  styles.clock,
                  { color: "#fff", fontSize: metrics.clockFont },
                ]}
                numberOfLines={1}
              >
                {clock}
              </Text>
            ) : (
              <View style={styles.clockSpacer} />
            )}
            <ControlButton
              icon={<X color={tone.button.fg} size={metrics.closeIcon} />}
              label={t("close")}
              onPress={onRequestClose}
              tone={tone.button}
              testID={`${testIDPrefix}-close`}
              size={metrics.button}
            />
          </View>

          <View style={[styles.bottomArea, { gap: metrics.gap }]}>
            <ProgressBar
              currentTime={progressCurrent}
              duration={progressDuration}
              onSeek={onSeek}
              tone={tone.progress}
              testID={`${testIDPrefix}-progress`}
              label={t("progress")}
              containerWidth={width}
              verticalPadding={metrics.progressPadding}
            />

            <View style={[styles.bottomRow, { gap: metrics.gap }]}>
              <ControlButton
                icon={
                  (isMp4 ? muted : youtubeMute) ? (
                    <VolumeX color={tone.button.fg} size={metrics.sideIcon} />
                  ) : (
                    <Volume2 color={tone.button.fg} size={metrics.sideIcon} />
                  )
                }
                label={(isMp4 ? muted : youtubeMute) ? t("unmute") : t("mute")}
                onPress={onToggleMute}
                tone={tone.button}
                testID={`${testIDPrefix}-mute`}
                size={metrics.button}
              />

              <ControlButton
                icon={
                  (isMp4 ? isPlaying : youtubePlay) ? (
                    <Pause color={tone.button.fg} size={metrics.playIcon} />
                  ) : (
                    <Play color={tone.button.fg} size={metrics.playIcon} />
                  )
                }
                label={
                  (isMp4 ? isPlaying : youtubePlay) ? t("pause") : t("play")
                }
                onPress={onTogglePlay}
                tone={tone.button}
                testID={`${testIDPrefix}-play`}
                variant="primary"
                disabled={!isMp4 && youtubeError}
                size={metrics.primaryButton}
              />

              {showFullscreenButton ? (
                <ControlButton
                  icon={<Maximize2 color={tone.button.fg} size={metrics.sideIcon} />}
                  label={t("fullscreen")}
                  onPress={requestFullscreen}
                  tone={tone.button}
                  testID={`${testIDPrefix}-fullscreen`}
                  size={metrics.button}
                />
              ) : null}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    borderRadius: 14,
    overflow: "hidden",
  },
  rootFlat: {
    borderRadius: 0,
  },
  media: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  video: { ...StyleSheet.absoluteFillObject },
  youtubeCoverContainer: { flex: 1, overflow: "hidden" },
  youtubeCoverInner: { position: "absolute" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  clockSpacer: {
    flex: 1,
  },
  clock: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
    flex: 1,
  },
  bottomArea: { gap: 10 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  controlButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonPrimary: {
    // Size is injected inline so the same component can scale on thumbnails.
  },
  progressHitArea: { paddingVertical: 8 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
  },
  progressFill: { height: 6, borderRadius: 999 },
  progressKnob: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    marginLeft: -6,
    top: -3,
  },
});
