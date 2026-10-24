/**
 * MedGuard AI — Connectivity Hook
 *
 * Event-driven network-state detection using React Native's built-in
 * networking. Does NOT poll — checks on mount and on AppState changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

/**
 * Performs a lightweight connectivity check by fetching a known endpoint.
 * Returns true if the device appears to have internet access.
 */
async function probeConnectivity(): Promise<boolean> {
  try {
    // Use a lightweight endpoint; abort after 5 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.status === 204 || response.ok;
  } catch {
    return false;
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export interface ConnectivityState {
  /** Whether the device currently has internet access. */
  isOnline: boolean;
  /** Manually re-check connectivity. */
  checkConnectivity: () => Promise<boolean>;
}

/**
 * Hook providing event-driven connectivity status.
 *
 * - Checks once on mount (non-blocking).
 * - Re-checks when the app returns to foreground.
 * - Does NOT poll continuously (respects data-cost sensitivity).
 */
export function useConnectivity(): ConnectivityState {
  const [isOnline, setIsOnline] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    // On web, navigator.onLine is a quick proxy
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const online = navigator.onLine;
      setIsOnline(online);
      return online;
    }

    const online = await probeConnectivity();
    setIsOnline(online);
    return online;
  }, []);

  useEffect(() => {
    // Initial check (non-blocking)
    checkConnectivity();

    // Re-check when app comes to foreground
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          checkConnectivity();
        }
        appState.current = nextState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [checkConnectivity]);

  return { isOnline, checkConnectivity };
}

