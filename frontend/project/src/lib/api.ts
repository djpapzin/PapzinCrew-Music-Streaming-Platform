const DEFAULT_LOCAL_API_BASE = 'http://localhost:8000';
const SAME_ORIGIN_API_BASE = '/api';

const isLocalDevHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1';

export const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    if (isLocalDevHost(window.location.hostname)) {
      const envBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
      if (envBase && envBase.trim()) {
        return envBase.trim().replace(/\/$/, '');
      }
      return DEFAULT_LOCAL_API_BASE;
    }

    return SAME_ORIGIN_API_BASE;
  }

  const envBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/$/, '');
  }

  return DEFAULT_LOCAL_API_BASE;
};

export const API_BASE = getApiBase();

export const toAbsoluteApiUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
};
