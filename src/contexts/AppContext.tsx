/**
 * MedGuard AI — Global Application Context
 *
 * Provides the current worker session, connectivity state,
 * pending sync count, and language preference to all screens.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from 'react';

import type { Language } from '@/constants/i18n';
import { DEFAULT_LANGUAGE } from '@/constants/i18n';
import { useConnectivity } from '@/hooks/use-connectivity';
import type { Worker } from '@/models/types';
import { getPendingSyncCount } from '@/services/case-repository';
import { getSetting, initDatabase, setSetting } from '@/services/database';
import { preloadFacilities } from '@/services/facility-repository';
import { clearSession as clearWorkerSession, getSession, getWorker } from '@/services/worker-repository';
import { initializeModel } from '@/services/ai-inference';

// ── Context Shape ───────────────────────────────────────────────────

interface AppContextValue {
  /** Current authenticated worker, or null if not logged in. */
  worker: Worker | null;
  /** Set/clear the current worker (login/logout). */
  setWorker: (worker: Worker | null) => void;
  /** Whether the device has internet access. */
  isOnline: boolean;
  /** Number of cases/items waiting to sync. */
  pendingSyncCount: number;
  /** Re-query the pending sync count from the database. */
  refreshPendingSyncCount: () => void;
  /** Current UI language. */
  language: Language;
  /** Change the UI language (persisted to DB). */
  setLanguage: (lang: Language) => void;
  /** True once the initial session/DB load has completed. */
  isReady: boolean;
  /** Re-check network connectivity. */
  checkConnectivity: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────

export function AppProvider({ children }: PropsWithChildren) {
  const [worker, setWorkerState] = useState<Worker | null>(null);
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const { isOnline, checkConnectivity } = useConnectivity();

  // ── Initialize on mount ─────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        // 1. Initialize database schema & preload facilities cache
        initDatabase();
        preloadFacilities();

        // 2. Load language preference
        const savedLang = getSetting('language');
        if (savedLang && !cancelled) {
          setLanguageState(savedLang as Language);
        }

        // 3. Restore session
        const sessionWorkerId = await getSession();
        if (sessionWorkerId && !cancelled) {
          const existingWorker = getWorker(sessionWorkerId);
          if (existingWorker) {
            setWorkerState(existingWorker);
          }
        }

        // 4. Count pending sync items
        if (!cancelled) {
          const count = getPendingSyncCount();
          setPendingSyncCount(count);
        }

        // 5. Preload on-device Edge AI TFLite model in background
        initializeModel().catch((err) =>
          console.warn('[AppContext] Background TFLite model preload failed:', err)
        );
      } catch (err) {
        console.error('[AppContext] Bootstrap error:', err);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Callbacks ───────────────────────────────────────────────────

  const setWorker = useCallback((w: Worker | null) => {
    setWorkerState(w);
    if (!w) {
      clearWorkerSession();
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setSetting('language', lang);
  }, []);

  const refreshPendingSyncCount = useCallback(() => {
    try {
      const count = getPendingSyncCount();
      setPendingSyncCount(count);
    } catch {
      // Database may not be ready yet
    }
  }, []);

  // ── Memoized value ──────────────────────────────────────────────

  const value = useMemo<AppContextValue>(
    () => ({
      worker,
      setWorker,
      isOnline,
      pendingSyncCount,
      refreshPendingSyncCount,
      language,
      setLanguage,
      isReady,
      checkConnectivity,
    }),
    [
      worker,
      setWorker,
      isOnline,
      pendingSyncCount,
      refreshPendingSyncCount,
      language,
      setLanguage,
      isReady,
      checkConnectivity,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Access the global app context.
 * Must be used within an `<AppProvider>`.
 */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

