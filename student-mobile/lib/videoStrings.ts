import { useMemo } from "react";

export type VideoStringsKey =
  | "play"
  | "pause"
  | "mute"
  | "unmute"
  | "progress"
  | "fullscreen"
  | "exit_fullscreen"
  | "close"
  | "quality"
  | "speed"
  | "video"
  | "tap_to_toggle"
  | "double_tap_fullscreen"
  | "quality_unavailable_title"
  | "quality_unavailable_message";

type Strings = Record<VideoStringsKey, string>;

const STRINGS: Record<string, Strings> = {
  pt: {
    play: "Reproduzir",
    pause: "Pausar",
    mute: "Silenciar",
    unmute: "Ativar som",
    progress: "Progresso",
    fullscreen: "Tela cheia",
    exit_fullscreen: "Sair da tela cheia",
    close: "Fechar",
    quality: "Qualidade",
    speed: "Velocidade",
    video: "Vídeo",
    tap_to_toggle: "Toque para pausar/retomar e mostrar controles",
    double_tap_fullscreen: "Toque duas vezes para abrir em tela cheia",
    quality_unavailable_title: "Qualidade",
    quality_unavailable_message:
      "A qualidade é gerenciada automaticamente para este vídeo.",
  },
  en: {
    play: "Play",
    pause: "Pause",
    mute: "Mute",
    unmute: "Unmute",
    progress: "Progress",
    fullscreen: "Fullscreen",
    exit_fullscreen: "Exit fullscreen",
    close: "Close",
    quality: "Quality",
    speed: "Speed",
    video: "Video",
    tap_to_toggle: "Tap to play/pause and show controls",
    double_tap_fullscreen: "Double tap to open fullscreen",
    quality_unavailable_title: "Quality",
    quality_unavailable_message:
      "Quality is managed automatically for this video.",
  },
  es: {
    play: "Reproducir",
    pause: "Pausar",
    mute: "Silenciar",
    unmute: "Activar sonido",
    progress: "Progreso",
    fullscreen: "Pantalla completa",
    exit_fullscreen: "Salir de pantalla completa",
    close: "Cerrar",
    quality: "Calidad",
    speed: "Velocidad",
    video: "Vídeo",
    tap_to_toggle: "Toque para pausar/reanudar y mostrar controles",
    double_tap_fullscreen: "Doble toque para pantalla completa",
    quality_unavailable_title: "Calidad",
    quality_unavailable_message:
      "La calidad se gestiona automáticamente para este vídeo.",
  },
};

function getLocaleTag() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof locale === "string" ? locale : "pt";
  } catch {
    return "pt";
  }
}

function pickLanguage(localeTag: string) {
  const lower = localeTag.toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("es")) return "es";
  return "pt";
}

export function useVideoStrings() {
  return useMemo(() => {
    const lang = pickLanguage(getLocaleTag());
    const strings = STRINGS[lang] ?? STRINGS.pt;
    return {
      lang,
      t: (key: VideoStringsKey) => strings[key] ?? STRINGS.pt[key],
    };
  }, []);
}
