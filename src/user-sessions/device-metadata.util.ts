import type { Request } from 'express';

export interface SessionMetadata {
  deviceName?: string;
  deviceType?: string;
  browserName?: string;
  osName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function buildSessionMetadata(request: Request): SessionMetadata {
  const userAgent = normalizeHeader(request.headers['user-agent']);
  const explicitDeviceName = normalizeHeader(request.headers['x-device-name']);
  const inferred = inferDeviceMetadata(userAgent);

  return {
    ...inferred,
    deviceName: explicitDeviceName ?? inferred.deviceName,
    ipAddress: getClientIp(request),
    userAgent,
  };
}

export function inferDeviceMetadata(userAgent?: string): SessionMetadata {
  const ua = userAgent ?? '';
  const lower = ua.toLowerCase();
  const osName = inferOsName(ua, lower);
  const browserName = inferBrowserName(ua, lower);
  const deviceType = inferDeviceType(lower);
  const deviceName = inferDeviceName(ua, lower, osName, deviceType);

  return {
    deviceName,
    deviceType,
    browserName,
    osName,
  };
}

function inferDeviceType(lowerUserAgent: string) {
  if (!lowerUserAgent) return 'unknown';
  if (lowerUserAgent.includes('ipad') || lowerUserAgent.includes('tablet')) {
    return 'tablet';
  }
  if (
    lowerUserAgent.includes('mobile') ||
    lowerUserAgent.includes('iphone') ||
    lowerUserAgent.includes('android')
  ) {
    return 'mobile';
  }
  return 'desktop';
}

function inferOsName(userAgent: string, lowerUserAgent: string) {
  if (!userAgent) return 'Unknown OS';
  if (lowerUserAgent.includes('iphone')) return 'iOS';
  if (lowerUserAgent.includes('ipad')) return 'iPadOS';
  if (lowerUserAgent.includes('android')) return 'Android';
  if (lowerUserAgent.includes('mac os x')) return 'macOS';
  if (lowerUserAgent.includes('windows nt')) return 'Windows';
  if (lowerUserAgent.includes('linux')) return 'Linux';
  return 'Unknown OS';
}

function inferBrowserName(userAgent: string, lowerUserAgent: string) {
  if (!userAgent) return 'Unknown Browser';
  if (lowerUserAgent.includes('edg/')) return 'Edge';
  if (lowerUserAgent.includes('opr/') || lowerUserAgent.includes('opera')) {
    return 'Opera';
  }
  if (lowerUserAgent.includes('firefox/')) return 'Firefox';
  if (lowerUserAgent.includes('crios/')) return 'Chrome';
  if (
    lowerUserAgent.includes('chrome/') &&
    !lowerUserAgent.includes('chromium/')
  ) {
    return 'Chrome';
  }
  if (
    lowerUserAgent.includes('safari/') &&
    lowerUserAgent.includes('version/')
  ) {
    return 'Safari';
  }
  return 'Unknown Browser';
}

function inferDeviceName(
  userAgent: string,
  lowerUserAgent: string,
  osName: string,
  deviceType: string,
) {
  if (!userAgent) return 'Unknown device';
  if (lowerUserAgent.includes('iphone')) return 'iPhone';
  if (lowerUserAgent.includes('ipad')) return 'iPad';

  const androidModel = userAgent.match(/Android [^;]+;\s?([^;)]+)/i)?.[1];
  if (androidModel) return androidModel.replace(/\sBuild\/.*$/i, '').trim();

  if (deviceType === 'desktop' && osName !== 'Unknown OS')
    return `${osName} device`;
  return `${capitalize(deviceType)} device`;
}

function getClientIp(request: Request) {
  return request.ip ?? request.socket.remoteAddress ?? undefined;
}

function normalizeHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
