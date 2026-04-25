const DEFAULT_LOCAL_API_BASE = 'http://localhost:8000';
const DEFAULT_PROD_API_BASE = 'https://papzincrew-backend.onrender.com';
const SAME_ORIGIN_API_BASE = '/api';

const isLocalDevHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1';

const isPrivateOrLoopbackHost = (base: string): boolean => {
  try {
    const host = new URL(base).hostname;
    if (isLocalDevHost(host)) return true;
    if (host === '::1') return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (host.startsWith('172.')) {
      const second = Number(host.split('.')[1]);
      return Number.isFinite(second) && second >= 16 && second <= 31;
    }
    if (host.startsWith('100.')) {
      const second = Number(host.split('.')[1]);
      return Number.isFinite(second) && second >= 64 && second <= 127;
    }
    return false;
  } catch {
    return false;
  }
};

const resolveEnvBase = (): string | undefined => {
  const envBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/$/, '');
  }
  return undefined;
};

export const getApiBase = (): string => {
  const envBase = resolveEnvBase();

  if (typeof window !== 'undefined') {
    if (isLocalDevHost(window.location.hostname)) {
      return envBase || DEFAULT_LOCAL_API_BASE;
    }

    if (envBase && !isPrivateOrLoopbackHost(envBase)) {
      return envBase;
    }

    return SAME_ORIGIN_API_BASE;
  }

  return envBase || DEFAULT_LOCAL_API_BASE;
};

export const API_BASE = getApiBase();

export const toAbsoluteApiUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
};
