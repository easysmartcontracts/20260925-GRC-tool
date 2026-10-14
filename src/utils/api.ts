/**
 * Safe API client utilities with retry and non-JSON response guards
 */

export async function fetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  retries = 2,
  backoffMs = 500
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';

      // If response is HTML or not JSON (e.g. proxy warmup page or 502/503 HTML)
      if (!contentType.includes('application/json')) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs * (attempt + 1)));
          continue;
        }
        throw new Error(`Server returned non-JSON response (${contentType || 'empty'}) with status ${res.status}`);
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs * (attempt + 1)));
          continue;
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      if (
        attempt < retries && 
        (err.name === 'TypeError' || 
         err.message?.includes('non-JSON') || 
         err.message?.includes('Failed to fetch') ||
         err.message?.includes('Unexpected token'))
      ) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to fetch from ${url} after ${retries + 1} attempts`);
}

let productsCache: { data: any[]; timestamp: number } | null = null;
let productsInFlight: Promise<any[]> | null = null;
const CACHE_TTL_MS = 15000; // 15 seconds cache

export async function fetchPublicProducts(country?: string, forceRefresh = false): Promise<any[]> {
  if (!forceRefresh && productsCache && (Date.now() - productsCache.timestamp < CACHE_TTL_MS)) {
    if (!country || country === 'all') {
      return productsCache.data;
    }
    return productsCache.data.filter(p => !p.countries || p.countries.length === 0 || p.countries.includes(country));
  }

  if (productsInFlight) {
    const data = await productsInFlight;
    if (!country || country === 'all') return data;
    return data.filter(p => !p.countries || p.countries.length === 0 || p.countries.includes(country));
  }

  productsInFlight = (async () => {
    try {
      const data = await fetchJson<any[]>('/api/public/products', { cache: 'no-store' });
      if (Array.isArray(data)) {
        productsCache = { data, timestamp: Date.now() };
        return data;
      }
      return [];
    } catch (err) {
      console.warn('Could not fetch products from server, falling back safely:', err);
      if (productsCache?.data) {
        return productsCache.data;
      }
      return [];
    } finally {
      productsInFlight = null;
    }
  })();

  const data = await productsInFlight;
  if (!country || country === 'all') return data;
  return data.filter(p => !p.countries || p.countries.length === 0 || p.countries.includes(country));
}

export function clearProductsCache() {
  productsCache = null;
  productsInFlight = null;
}
