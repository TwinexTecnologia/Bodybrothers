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
  AndroidImportance: {
    LOW: 2,
    HIGH: 6,
    MAX: 7,
  },
  AndroidNotificationPriority: {
    HIGH: 1,
    MAX: 2,
  },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval", DATE: "date" },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  setNotificationCategoryAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => "notif://id"),
  dismissNotificationAsync: jest.fn(async () => {}),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  registerTaskAsync: jest.fn(async () => null),
  getPresentedNotificationsAsync: jest.fn(async () => []),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
}));
