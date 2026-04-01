import "@testing-library/jest-native/extend-expect";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-video", () => ({
  useVideoPlayer: () => ({
    replaceAsync: jest.fn(async () => {}),
    play: jest.fn(),
    pause: jest.fn(),
    addListener: () => ({ remove: jest.fn() }),
  }),
  VideoView: () => null,
}));

jest.mock("react-native-youtube-iframe", () => "YoutubePlayer");

jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: jest.fn(async () => ({ uri: "thumb://mock" })),
}));

jest.mock("react-native-webview", () => ({
  WebView: () => null,
}));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { LOW: 2 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "notif://id"),
  dismissNotificationAsync: jest.fn(async () => {}),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
