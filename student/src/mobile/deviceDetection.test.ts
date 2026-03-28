import { describe, expect, it } from "vitest";
import {
  detectDeviceFromUserAgent,
  isAndroidUserAgent,
  isMobileUserAgent,
} from "./deviceDetection";

describe("deviceDetection", () => {
  it("detecta Android Chrome como mobile e Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
    expect(isMobileUserAgent(ua)).toBe(true);
    expect(isAndroidUserAgent(ua)).toBe(true);
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: true,
      isAndroid: true,
    });
  });

  it("detecta Android Firefox como mobile e Android", () => {
    const ua =
      "Mozilla/5.0 (Android 14; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0";
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: true,
      isAndroid: true,
    });
  });

  it("detecta Samsung Internet como mobile e Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/113.0.0.0 Mobile Safari/537.36";
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: true,
      isAndroid: true,
    });
  });

  it("detecta Android WebView como mobile e Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 12; Pixel 5 Build/SP1A.210812.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36";
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: true,
      isAndroid: true,
    });
  });

  it("detecta iPhone como mobile e não Android", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: true,
      isAndroid: false,
    });
  });

  it("detecta desktop como não mobile e não Android", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: false,
      isAndroid: false,
    });
  });

  it("aplica cascata: quando não é mobile, isAndroid é sempre false", () => {
    const ua = "SomeDesktopUA";
    expect(isMobileUserAgent(ua)).toBe(false);
    expect(isAndroidUserAgent(ua)).toBe(false);
    expect(detectDeviceFromUserAgent(ua)).toEqual({
      isMobile: false,
      isAndroid: false,
    });
  });
});
