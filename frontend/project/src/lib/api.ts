const DEFAULT_LOCAL_API_BASE = 'http://localhost:8000';
const NETLIFY_PROXY_API_BASE = '/api';

const isNetlifyHost = (hostname: string) =>
  hostname === 'papzincrew.netlify.app' || hostname.endsWith('.netlify.app');

export const getApiBase = (): string => {
  const envBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && isNetlifyHost(window.location.hostname)) {
    return NETLIFY_PROXY_API_BASE;
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
