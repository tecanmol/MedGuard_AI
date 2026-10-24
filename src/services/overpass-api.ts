/**
 * MedGuard AI — OpenStreetMap Overpass API Service
 *
 * Queries the Overpass API for nearby health facilities and maps OSM elements
 * to the internal `Facility` type.  All errors are swallowed — this is an
 * optional online enhancement and must never break offline-first operation.
 */

import type { Facility } from '@/models/types';
import { cacheFacilities } from '@/services/facility-repository';

// ── Constants ────────────────────────────────────────────────────────

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const REQUEST_TIMEOUT_MS = 15_000;

// ── OSM Element Types ────────────────────────────────────────────────

interface OsmTags {
  name?: string;
  'name:en'?: string;
  amenity?: string;
  healthcare?: string;
  phone?: string;
  'contact:phone'?: string;
  'addr:housenumber'?: string;
  'addr:street'?: string;
  'addr:city'?: string;
  [key: string]: string | undefined;
}

interface OsmCenter {
  lat: number;
  lon: number;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: OsmCenter;
  tags?: OsmTags;
}

interface OverpassResponse {
  elements: OsmElement[];
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Maps an OSM amenity or healthcare tag value to the internal facility type.
 */
function mapOsmTagToFacilityType(tags: OsmTags): Facility['type'] {
  const amenity = tags.amenity?.toLowerCase();
  const healthcare = tags.healthcare?.toLowerCase();

  if (amenity === 'hospital' || healthcare === 'hospital') return 'Hospital';
  if (
    amenity === 'clinic' ||
    amenity === 'health_centre' ||
    healthcare === 'clinic' ||
    healthcare === 'centre'
  ) {
    return 'CHC';
  }
  // doctors, pharmacy, or any other value falls back to PHC
  return 'PHC';
}

/**
 * Builds a human-readable address string from OSM address tags.
 */
function buildAddress(tags: OsmTags): string {
  const parts: string[] = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.join(', ');
}

/**
 * Builds the Overpass QL query string for health amenities within a radius.
 */
function buildOverpassQuery(lat: number, lng: number, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${lat},${lng})`;

  const amenityTypes = ['hospital', 'clinic', 'doctors', 'health_centre', 'pharmacy'];
  const healthcareTypes = ['hospital', 'clinic', 'centre', 'doctor'];

  const amenityNodeStatements = amenityTypes
    .map((a) => `node[amenity=${a}]${around};`)
    .join('\n  ');
  const amenityWayStatements = amenityTypes
    .map((a) => `way[amenity=${a}]${around};`)
    .join('\n  ');
  const healthcareNodeStatements = healthcareTypes
    .map((h) => `node[healthcare=${h}]${around};`)
    .join('\n  ');
  const healthcareWayStatements = healthcareTypes
    .map((h) => `way[healthcare=${h}]${around};`)
    .join('\n  ');

  return `
[out:json][timeout:15];
(
  ${amenityNodeStatements}
  ${amenityWayStatements}
  ${healthcareNodeStatements}
  ${healthcareWayStatements}
);
out center;
`.trim();
}

/**
 * Maps a single OSM element to a `Facility` object.
 * Returns `null` if the element has no name tag.
 */
function osmElementToFacility(element: OsmElement): Facility | null {
  const tags = element.tags ?? {};

  const name = tags.name || tags['name:en'];
  if (!name) return null;

  // Resolve coordinates — nodes carry lat/lon directly, ways carry center
  const latitude =
    element.type === 'node' ? element.lat : element.center?.lat;
  const longitude =
    element.type === 'node' ? element.lon : element.center?.lon;

  if (latitude === undefined || longitude === undefined) return null;

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    type: mapOsmTagToFacilityType(tags),
    phone: tags.phone || tags['contact:phone'] || '',
    address: buildAddress(tags),
    latitude,
    longitude,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Queries the Overpass API for health facilities near the given coordinates.
 *
 * @param lat          Latitude of the centre point.
 * @param lng          Longitude of the centre point.
 * @param radiusMeters Search radius in metres (default 50 km).
 * @returns            Array of matched `Facility` objects, or `[]` on any error.
 */
export async function searchNearbyFacilitiesOnline(
  lat: number,
  lng: number,
  radiusMeters: number = 50_000
): Promise<Facility[]> {
  try {
    const query = buildOverpassQuery(lat, lng, radiusMeters);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'MedGuardAI/1.0 (Local Testing)'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) return [];

    const json = (await response.json()) as OverpassResponse;
    const elements: OsmElement[] = json?.elements ?? [];

    const facilities: Facility[] = [];
    for (const element of elements) {
      const facility = osmElementToFacility(element);
      if (facility) facilities.push(facility);
    }

    return facilities;
  } catch {
    // Network errors, timeouts, parse failures — always return empty array
    return [];
  }
}

/**
 * Searches for nearby facilities online and persists the results to SQLite.
 *
 * The cache write is best-effort; any failure is swallowed silently so the
 * caller always receives the facilities array (or an empty array on error).
 *
 * @param lat          Latitude of the centre point.
 * @param lng          Longitude of the centre point.
 * @param radiusMeters Search radius in metres (default 50 km).
 * @returns            Array of matched `Facility` objects.
 */
export async function searchAndCacheFacilities(
  lat: number,
  lng: number,
  radiusMeters?: number
): Promise<Facility[]> {
  const facilities = await searchNearbyFacilitiesOnline(lat, lng, radiusMeters);

  if (facilities.length > 0) {
    try {
      cacheFacilities(facilities);
    } catch {
      // Cache write failure must not affect the return value
    }
  }

  return facilities;
}
