/**
 * MedGuard AI — Location Service
 *
 * Provides live GPS coordinates using expo-location for geospatial referral routing.
 * Safely probes for native module presence before importing so the app never throws
 * "Cannot find native module 'ExpoLocation'" when running in builds where expo-location
 * has not yet been compiled into the APK.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Checks whether the ExpoLocation native module is linked in the running app binary.
 * Returns false in Expo Go or custom dev builds created before expo-location was installed.
 */
export function isLocationNativeAvailable(): boolean {
  try {
    return !!requireOptionalNativeModule('ExpoLocation');
  } catch {
    return false;
  }
}

/**
 * Requests location permission and retrieves the user's current GPS position.
 * Returns null if:
 *  - ExpoLocation native module is not compiled into the current binary
 *  - Permissions are denied
 *  - Location services are disabled or timeout
 */
export async function getCurrentUserLocation(): Promise<UserCoordinates | null> {
  // Guard: Avoid calling expo-location if the native binary doesn't support it
  if (!isLocationNativeAvailable()) {
    console.log('[Location] ExpoLocation native module not present in current binary. Live GPS disabled.');
    return null;
  }

  try {
    const Location = await import('expo-location');

    if (!Location || typeof Location.requestForegroundPermissionsAsync !== 'function') {
      return null;
    }

    // Permission request with 8-second safety timeout
    const permPromise = Location.requestForegroundPermissionsAsync();
    const permTimeout = new Promise<{ status: string }>((resolve) =>
      setTimeout(() => resolve({ status: 'timeout' }), 8000)
    );
    const { status } = await Promise.race([permPromise, permTimeout]);

    if (status !== 'granted') {
      console.log('[Location] Foreground location permission not granted or timed out:', status);
      return null;
    }

    // 1. Try fast last-known position first for instantaneous UI update
    try {
      if (typeof Location.getLastKnownPositionAsync === 'function') {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown?.coords) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
        }
      }
    } catch {
      // Non-fatal — proceed to active GPS acquisition
    }

    // 2. Query live GPS with Balanced accuracy and a strict 5-second timeout
    const gpsPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const gpsTimeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000)
    );

    const position = await Promise.race([gpsPromise, gpsTimeout]);

    if (position?.coords) {
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    }

    return null;
  } catch (error: any) {
    console.warn('[Location] Failed to acquire GPS position:', error);
    return null;
  }
}
