import React from "react";
import { Platform, StyleSheet } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import WorkoutInlineVideo from "../components/WorkoutInlineVideo";

jest.mock("react-native-youtube-iframe", () => {
  const React = require("react");
  const { View } = require("react-native");
  const refApi = {
    seekTo: jest.fn(),
    getDuration: jest.fn(async () => 120),
    getCurrentTime: jest.fn(async () => 0),
  };
  const state: any = { lastProps: null };
  const Comp = React.forwardRef((props: any, ref: any) => {
    state.lastProps = props;
    React.useImperativeHandle(ref, () => refApi);
    return React.createElement(View, { testID: "youtube-player" });
  });
  (Comp as any).__getLastProps = () => state.lastProps;
  (Comp as any).__refApi = refApi;
  return { __esModule: true, default: Comp };
});

function createMp4PlayerMock() {
  let _currentTime = 0;
  let _muted = false;
  let _playbackRate = 1;
  const listeners = new Map<string, Array<(p: any) => void>>();

  const addListener = (event: string, listener: (payload: any) => void) => {
    const arr = listeners.get(event) ?? [];
    arr.push(listener);
    listeners.set(event, arr);
    return {
      remove: () => {
        const next = (listeners.get(event) ?? []).filter((l) => l !== listener);
        listeners.set(event, next);
      },
    };
  };

  const player: any = {
    play: jest.fn(() => {
      player.playing = true;
      (listeners.get("playingChange") ?? []).forEach((l) => l({ isPlaying: true }));
    }),
    pause: jest.fn(() => {
      player.playing = false;
      (listeners.get("playingChange") ?? []).forEach((l) => l({ isPlaying: false }));
    }),
    get muted() {
      return _muted;
    },
    set muted(v: boolean) {
      _muted = v;
      (listeners.get("mutedChange") ?? []).forEach((l) => l({ muted: v }));
    },
    volume: 1,
    get currentTime() {
      return _currentTime;
    },
    set currentTime(v: number) {
      _currentTime = v;
      (listeners.get("timeUpdate") ?? []).forEach((l) => l({ currentTime: v }));
    },
    duration: 120,
    playing: false,
    timeUpdateEventInterval: 0,
    get playbackRate() {
      return _playbackRate;
    },
    set playbackRate(v: number) {
      _playbackRate = v;
    },
    addListener,
  };

  return player;
}

describe("WorkoutInlineVideo UI", () => {
  it("exibe controles com hit area mínima e aciona callbacks", () => {
    const player = createMp4PlayerMock();
    const onRequestFullscreen = jest.fn();
    const onRequestClose = jest.fn();

    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={onRequestFullscreen}
        onRequestClose={onRequestClose}
        testIDPrefix="t"
      />,
    );

    const btn = screen.getByTestId("t-play");
    const styleProp = btn.props.style;
    const resolved =
      typeof styleProp === "function"
        ? styleProp({ pressed: false, hovered: false })
        : styleProp;
    const flat = StyleSheet.flatten(resolved);
    expect(flat.minWidth).toBeGreaterThanOrEqual(44);
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);

    fireEvent.press(screen.getByTestId("t-fullscreen"));
    expect(onRequestFullscreen).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("t-close"));
    expect(onRequestClose).toHaveBeenCalled();
  });

  it("controla play/pause e mute no MP4", () => {
    const player = createMp4PlayerMock();
    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    fireEvent.press(screen.getByTestId("t-play"));
    expect(player.play).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("t-play"));
    expect(player.pause).toHaveBeenCalled();

    expect(player.muted).toBe(false);
    fireEvent.press(screen.getByTestId("t-mute"));
    expect(player.muted).toBe(true);
  });

  it("1 toque no vídeo alterna play/pause; 2 toques entra em fullscreen (MP4)", () => {
    jest.useFakeTimers();
    const player = createMp4PlayerMock();
    const onRequestFullscreen = jest.fn();
    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={onRequestFullscreen}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    act(() => {
      fireEvent.press(screen.getByTestId("t-surface"));
      jest.advanceTimersByTime(270);
    });
    expect(player.play).toHaveBeenCalled();

    act(() => {
      fireEvent.press(screen.getByTestId("t-surface"));
      jest.advanceTimersByTime(270);
    });
    expect(player.pause).toHaveBeenCalled();

    act(() => {
      fireEvent.press(screen.getByTestId("t-surface"));
      fireEvent.press(screen.getByTestId("t-surface"));
      jest.advanceTimersByTime(270);
    });
    expect(onRequestFullscreen).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("faz seek quando clica no progresso (MP4)", () => {
    const player = createMp4PlayerMock();
    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    fireEvent.press(screen.getByTestId("t-progress"), {
      nativeEvent: { locationX: 160, layoutMeasurement: { width: 320 } },
    });

    expect(player.currentTime).toBeCloseTo(60, 0);
  });

  it("faz loop automático no fim (MP4)", () => {
    const player = createMp4PlayerMock();
    player.playing = true;
    render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    act(() => {
      player.currentTime = 119.9;
    });

    expect(player.currentTime).toBe(0);
    expect(player.play).toHaveBeenCalled();
  });

  it("renderiza em tamanhos/orientações diferentes sem quebrar", () => {
    const player = createMp4PlayerMock();
    const screen = render(
      <WorkoutInlineVideo
        width={360}
        height={202}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    screen.rerender(
      <WorkoutInlineVideo
        width={202}
        height={360}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    expect(screen.getByTestId("t-fullscreen")).toBeTruthy();
  });

  it("no web, fullscreen do MP4 delega para callback externo", () => {
    const originalOs = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web" });
    const player = createMp4PlayerMock();
    const onRequestFullscreen = jest.fn();
    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4
        mp4Player={player}
        mp4Url="https://cdn.example.com/a.mp4"
        youtubeId={null}
        onRequestFullscreen={onRequestFullscreen}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );
    fireEvent.press(screen.getByTestId("t-fullscreen"));
    expect(onRequestFullscreen).toHaveBeenCalled();
    Object.defineProperty(Platform, "OS", { value: originalOs });
  });

  it("botão play funciona no YouTube (inicia a reprodução)", () => {
    const player = createMp4PlayerMock();
    const YoutubePlayer = require("react-native-youtube-iframe").default;

    const screen = render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4={false}
        mp4Player={player}
        mp4Url={null}
        youtubeId="abc123"
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    expect(YoutubePlayer.__getLastProps().play).toBe(false);
    act(() => {
      fireEvent.press(screen.getByTestId("t-play"));
    });
    expect(YoutubePlayer.__getLastProps().play).toBe(true);
  });

  it("faz loop automático no fim (YouTube)", () => {
    const player = createMp4PlayerMock();
    const YoutubePlayer = require("react-native-youtube-iframe").default;
    render(
      <WorkoutInlineVideo
        width={320}
        height={180}
        isMp4={false}
        mp4Player={player}
        mp4Url={null}
        youtubeId="abc123"
        onRequestFullscreen={() => {}}
        onRequestClose={() => {}}
        testIDPrefix="t"
      />,
    );

    act(() => {
      YoutubePlayer.__getLastProps().onChangeState?.("ended");
    });
    expect(YoutubePlayer.__refApi.seekTo).toHaveBeenCalledWith(0, true);
    expect(YoutubePlayer.__getLastProps().play).toBe(true);
  });
});
