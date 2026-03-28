export type DeviceDetectionResult = {
  isMobile: boolean
  isAndroid: boolean
}

export function isMobileUserAgent(userAgent: string): boolean {
  if (!userAgent) return false
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|BB10/i.test(userAgent)
}

export function isAndroidUserAgent(userAgent: string): boolean {
  if (!userAgent) return false
  return /Android/i.test(userAgent)
}

export function detectDeviceFromUserAgent(userAgent: string): DeviceDetectionResult {
  const isMobile = isMobileUserAgent(userAgent)
  if (!isMobile) return { isMobile: false, isAndroid: false }
  const isAndroid = isAndroidUserAgent(userAgent)
  return { isMobile: true, isAndroid }
}

export function getRuntimeUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent ?? ''
}

