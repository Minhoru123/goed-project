// Browser-side geocoder using OpenStreetMap Nominatim.
// Same source the ETL uses (scripts/etl.mjs), so coordinates produced live
// match the ones produced offline.
//
// Nominatim usage policy: max 1 req/sec, identifying Referer/UA required
// (the browser sets these automatically). Don't loop this for batch jobs —
// use the ETL for that.

export interface GeocodeResult {
  lat: number;
  lng: number;
}

const cache = new Map<string, GeocodeResult | null>();

export async function geocodeAddress(address: string | null | undefined): Promise<GeocodeResult | null> {
  const query = (address ?? '').trim();
  if (!query) return null;
  if (cache.has(query)) return cache.get(query) ?? null;

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=` +
    encodeURIComponent(query);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      cache.set(query, null);
      return null;
    }
    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(query, null);
      return null;
    }
    const lat = Number.parseFloat(data[0].lat);
    const lng = Number.parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      cache.set(query, null);
      return null;
    }
    const result = { lat, lng };
    cache.set(query, result);
    return result;
  } catch {
    cache.set(query, null);
    return null;
  }
}
