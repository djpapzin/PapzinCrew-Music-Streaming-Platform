const DEFAULT_LOCAL_API_BASE = 'http://localhost:8000';
const DEFAULT_PROD_API_BASE = 'http://16.171.10.189';
const SAME_ORIGIN_API_BASE = '/api';

const isLocalDevHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1';

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

    // Netlify / browser production should call the real backend directly unless
    // an explicit environment override is provided.
    return envBase || DEFAULT_PROD_API_BASE;
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
