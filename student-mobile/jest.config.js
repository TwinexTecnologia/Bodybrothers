module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  maxWorkers: 1,
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|expo|@expo|expo-router|expo-video|expo-notifications|expo-modules-core|expo-linear-gradient|react-native-webview|react-native-youtube-iframe)/)",
  ],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};
