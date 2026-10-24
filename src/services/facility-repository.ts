/**
 * MedGuard AI — Facility Repository & Offline Caching Service
 *
 * Provides offline caching, geospatial bounding-box queries, and proximity
 * calculations for clinics, health centers, and referral hospitals.
 */

import {
  MH_CLUSTER_REGION,
  MH_FACILITIES_SEED,
  type SeedFacility,
} from '@/constants/facilities-seed';
import type { Facility } from '@/models/types';
import { getDatabase } from './database';

// ── Interfaces ───────────────────────────────────────────────────────

export interface FacilityFilter {
  type?: 'PHC' | 'CHC' | 'Hospital';
  maxDistanceKm?: number;
  userCoords?: { latitude: number; longitude: number };
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ExtendedFacility extends Facility {
  capabilities?: string[];
  operatingHours?: string;
  tierLevel?: number;
  emergencyContact?: string;
  transitMinutesRural?: number;
  cachedAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

interface FacilityRow {
  id: string;
  name: string;
  type: string;
  distance: number | null;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  capabilities: string;
  operating_hours: string;
  tier_level: number;
  emergency_contact: string | null;
  transit_minutes_rural: number | null;
  cached_at: string;
  updated_at: string;
  is_active: number;
  metadata: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToFacility(row: FacilityRow): ExtendedFacility {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Facility['type'],
    distance: row.distance ?? undefined,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    capabilities: jsonParse<string[]>(row.capabilities, []),
    operatingHours: row.operating_hours,
    tierLevel: row.tier_level,
    emergencyContact: row.emergency_contact ?? undefined,
    transitMinutesRural: row.transit_minutes_rural ?? undefined,
    cachedAt: row.cached_at,
    updatedAt: row.updated_at,
    isActive: row.is_active === 1,
    metadata: jsonParse<Record<string, any>>(row.metadata, {}),
  };
}

// ── Geospatial Utilities ────────────────────────────────────────────

/**
 * Calculates geodesic distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateDistance(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

// ── Core Facility Operations ────────────────────────────────────────

/**
 * Preloads the seed dataset for Rampur district if no facilities currently exist in cache.
 */
export function preloadFacilities(): void {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM facilities');
  
  // If empty OR if it only contains the old Rampur dummy data (5 rows), force reload
  if (!row || row.count < 10) {
    if (row && row.count > 0) {
      clearFacilityCache();
    }
    cacheFacilities(MH_FACILITIES_SEED);
    registerCachedRegion(
      MH_CLUSTER_REGION.id,
      MH_CLUSTER_REGION.name,
      MH_CLUSTER_REGION.bounds
    );
  }
}

/**
 * Bulk upserts facilities into the encrypted SQLite database.
 */
export function cacheFacilities(facilities: (Facility | SeedFacility)[]): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  for (const fac of facilities) {
    const ext = fac as SeedFacility;
    const capabilities = JSON.stringify(ext.capabilities ?? []);
    const metadata = JSON.stringify(ext.metadata ?? {});

    db.runSync(
      `INSERT OR REPLACE INTO facilities
        (id, name, type, distance, phone, address, latitude, longitude,
         capabilities, operating_hours, tier_level, emergency_contact,
         transit_minutes_rural, cached_at, updated_at, is_active, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        fac.id,
        fac.name,
        fac.type,
        fac.distance ?? null,
        fac.phone ?? '',
        fac.address ?? '',
        fac.latitude ?? 0,
        fac.longitude ?? 0,
        capabilities,
        ext.operatingHours ?? '24/7',
        ext.tierLevel ?? 1,
        ext.emergencyContact ?? '108',
        ext.transitMinutesRural ?? null,
        ext.cachedAt ?? now,
        now,
        metadata,
      ]
    );
  }
}

/**
 * Retrieves a facility by its unique ID.
 */
export function getFacilityById(id: string): ExtendedFacility | null {
  const db = getDatabase();
  const row = db.getFirstSync<FacilityRow>('SELECT * FROM facilities WHERE id = ?', [id]);
  if (!row) return null;
  return rowToFacility(row);
}

/**
 * Retrieves all facilities within a specified geospatial bounding box.
 * Leverages composite coordinates index idx_facilities_coords for high speed.
 */
export function getFacilitiesInBounds(bounds: BoundingBox): ExtendedFacility[] {
  const db = getDatabase();
  const minLat = Math.min(bounds.minLat, bounds.maxLat);
  const maxLat = Math.max(bounds.minLat, bounds.maxLat);
  const minLng = Math.min(bounds.minLng, bounds.maxLng);
  const maxLng = Math.max(bounds.minLng, bounds.maxLng);

  const rows = db.getAllSync<FacilityRow>(
    `SELECT * FROM facilities
     WHERE is_active = 1
       AND latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?
     ORDER BY name ASC`,
    [minLat, maxLat, minLng, maxLng]
  );
  return rows.map(rowToFacility);
}

/**
 * Retrieves facilities in proximity to user coordinates, pruned by bounding box
 * and sorted ascending by exact Haversine distance.
 */
export function getNearbyFacilities(
  userCoords: { latitude: number; longitude: number },
  maxDistanceKm: number = 50
): ExtendedFacility[] {
  const deltaLat = maxDistanceKm / 111.32;
  const cosLat = Math.cos((userCoords.latitude * Math.PI) / 180);
  const deltaLng = maxDistanceKm / (111.32 * Math.max(0.1, Math.abs(cosLat)));

  const bounds: BoundingBox = {
    minLat: userCoords.latitude - deltaLat,
    maxLat: userCoords.latitude + deltaLat,
    minLng: userCoords.longitude - deltaLng,
    maxLng: userCoords.longitude + deltaLng,
  };

  const candidates = getFacilitiesInBounds(bounds);
  const withDistance: ExtendedFacility[] = [];

  for (const fac of candidates) {
    if (typeof fac.latitude === 'number' && typeof fac.longitude === 'number') {
      const dist = calculateDistance(userCoords, {
        latitude: fac.latitude,
        longitude: fac.longitude,
      });
      if (dist <= maxDistanceKm) {
        withDistance.push({
          ...fac,
          distance: dist,
        });
      }
    }
  }

  withDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return withDistance;
}

/**
 * Returns the recommended referral destination facility matching capability requirements.
 * Used for automated referral routing of high-risk cases.
 */
export function getRecommendedFacility(
  requiredCapability?: string,
  userCoords?: { latitude: number; longitude: number }
): ExtendedFacility | null {
  const db = getDatabase();
  const rows = db.getAllSync<FacilityRow>('SELECT * FROM facilities WHERE is_active = 1');
  if (!rows || rows.length === 0) return null;

  const facilities = rows.map(rowToFacility);

  if (userCoords) {
    for (const f of facilities) {
      if (typeof f.latitude === 'number' && typeof f.longitude === 'number') {
        f.distance = calculateDistance(userCoords, {
          latitude: f.latitude,
          longitude: f.longitude,
        });
      }
    }
  }

  if (requiredCapability && requiredCapability.trim() !== '') {
    const term = requiredCapability.toLowerCase().trim();
    const matching = facilities.filter((f) =>
      f.capabilities?.some((cap) => cap.toLowerCase().includes(term))
    );

    if (matching.length > 0) {
      matching.sort((a, b) => {
        const distA = a.distance ?? 999;
        const distB = b.distance ?? 999;
        if (distA !== distB) return distA - distB;
        return (b.tierLevel ?? 1) - (a.tierLevel ?? 1);
      });
      return matching[0];
    }
  }

  // Pick the most suitable facility:
  // 1. Highest tier hospital (Tertiary > Secondary > Primary)
  // 2. Closest distance to user
  facilities.sort((a, b) => {
    const tierDiff = (b.tierLevel ?? 1) - (a.tierLevel ?? 1);
    if (tierDiff !== 0) return tierDiff;
    return (a.distance ?? 999) - (b.distance ?? 999);
  });

  return facilities[0] ?? null;
}

/**
 * Registers a geographic region as cached.
 */
export function registerCachedRegion(regionId: string, name: string, bounds: BoundingBox): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const minLat = Math.min(bounds.minLat, bounds.maxLat);
  const maxLat = Math.max(bounds.minLat, bounds.maxLat);
  const minLng = Math.min(bounds.minLng, bounds.maxLng);
  const maxLng = Math.max(bounds.minLng, bounds.maxLng);

  const countRow = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM facilities
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
    [minLat, maxLat, minLng, maxLng]
  );
  const facilityCount = countRow?.count ?? 0;

  db.runSync(
    `INSERT OR REPLACE INTO facility_cache_regions
      (id, name, min_latitude, max_latitude, min_longitude, max_longitude, facility_count, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [regionId, name, minLat, maxLat, minLng, maxLng, facilityCount, now]
  );
}

/**
 * Checks whether a given region ID has been registered in the offline cache.
 */
export function isRegionCached(regionId: string): boolean {
  const db = getDatabase();
  const row = db.getFirstSync<{ id: string }>(
    'SELECT id FROM facility_cache_regions WHERE id = ?',
    [regionId]
  );
  return !!row;
}

/**
 * Retrieves all facilities currently cached in local storage.
 */
export function getAllFacilities(): ExtendedFacility[] {
  const db = getDatabase();
  const rows = db.getAllSync<FacilityRow>('SELECT * FROM facilities WHERE is_active = 1 ORDER BY name ASC');
  return rows.map(rowToFacility);
}

/**
 * Clears the facility cache. Useful for test teardowns or refresh syncs.
 */
export function clearFacilityCache(): void {
  const db = getDatabase();
  db.runSync('DELETE FROM facilities');
  db.runSync('DELETE FROM facility_cache_regions');
}

/**
 * Returns total count of cached facilities.
 */
export function getFacilityCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM facilities');
  return row?.count ?? 0;
}
