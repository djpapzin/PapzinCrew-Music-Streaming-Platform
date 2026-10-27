const VPS_ORIGIN = 'https://papzincrew-api.djpapzin.com';
const TIMEOUT_MS = 8000;
class CatalogHttpError extends Error {
  get retryable() { return this.status >= 500; }
  constructor(readonly status: number) { super(`Catalog service unavailable (${status}).`); }
}

async function attempt(url: string, signal: AbortSignal): Promise<any[]> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = window.setTimeout(cancel, TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new CatalogHttpError(response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid catalog response.');
    return data;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}

export async function fetchCatalog(base: string, signal: AbortSignal): Promise<any[]> {
  // Same-origin production requests can recover directly from the same VPS.
  // Explicit local/development origins never fall through to production.
  const origins = base.startsWith('/') ? [base, VPS_ORIGIN] : [base];
  let failure: unknown;
  for (const origin of origins) {
    try { return await attempt(`${origin}/tracks/catalog`, signal); }
    catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof CatalogHttpError && error.status < 500) throw error;
      failure = error;
    }
  }
  throw new Error(failure instanceof CatalogHttpError ? failure.message : 'Unable to connect to the mix catalog.');
}
