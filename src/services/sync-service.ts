/**
 * MedGuard AI — Sync Service
 *
 * Manages the offline sync queue. Actual cloud upload is stubbed —
 * the architecture is in place for future backend integration.
 */
import type { SyncItem, SyncStatus } from '@/models/types';
import { getDatabase, getSetting, setSetting } from './database';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db as firestoreDb } from './firebase-config';
import * as FileSystem from 'expo-file-system/legacy';
import { getCase, getImages } from './case-repository';
import { getWorker } from './worker-repository';
import { cacheFacilities } from './facility-repository';

// ── Row shape ───────────────────────────────────────────────────────

interface SyncRow {
  id: string;
  type: string;
  reference_id: string;
  status: string;
  last_attempt: string | null;
  retry_count: number;
  error_message: string | null;
  estimated_size_bytes: number;
}

function rowToSyncItem(row: SyncRow): SyncItem {
  return {
    id: row.id,
    type: row.type as SyncItem['type'],
    referenceId: row.reference_id,
    status: row.status as SyncStatus,
    lastAttempt: row.last_attempt ?? undefined,
    retryCount: row.retry_count,
    errorMessage: row.error_message ?? undefined,
    estimatedSizeBytes: row.estimated_size_bytes,
  };
}

// ── Queue Operations ────────────────────────────────────────────────

/** Add an item to the sync queue. */
export function addToSyncQueue(item: {
  id: string;
  type: SyncItem['type'];
  referenceId: string;
  estimatedSizeBytes?: number;
}): void {
  const db = getDatabase();
  db.runSync(
    `INSERT OR IGNORE INTO sync_queue (id, type, reference_id, status, retry_count, estimated_size_bytes)
     VALUES (?, ?, ?, 'pending', 0, ?)`,
    [item.id, item.type, item.referenceId, item.estimatedSizeBytes ?? 0],
  );
}

/** Get all items in the sync queue. */
export function getSyncQueue(): SyncItem[] {
  const db = getDatabase();
  const rows = db.getAllSync<SyncRow>(
    'SELECT * FROM sync_queue ORDER BY status, last_attempt',
  );
  return rows.map(rowToSyncItem);
}

/** Get pending and stuck uploading sync items. */
export function getPendingSyncItems(): SyncItem[] {
  const db = getDatabase();
  const rows = db.getAllSync<SyncRow>(
    "SELECT * FROM sync_queue WHERE status IN ('pending', 'uploading') ORDER BY last_attempt",
  );
  return rows.map(rowToSyncItem);
}

/** Update the status of a sync item. */
export function updateSyncItemStatus(
  id: string,
  status: SyncStatus,
  errorMessage?: string,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.runSync(
    'UPDATE sync_queue SET status = ?, last_attempt = ?, error_message = ? WHERE id = ?',
    [status, now, errorMessage ?? null, id],
  );
}

/** Calculate estimated data usage for all pending items (bytes). */
export function getEstimatedDataUsage(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ total: number }>(
    "SELECT COALESCE(SUM(estimated_size_bytes), 0) as total FROM sync_queue WHERE status IN ('pending', 'failed')",
  );
  return row?.total ?? 0;
}

/**
 * Reset all failed items to pending with incremented retry count.
 * Uses exponential backoff concept — actual delay handled by the sync scheduler.
 */
export function retryFailedItems(): void {
  const db = getDatabase();
  db.runSync(
    "UPDATE sync_queue SET status = 'pending', retry_count = retry_count + 1, error_message = NULL WHERE status = 'failed'",
  );
}

/** Remove a sync item from the queue. */
export function removeSyncItem(id: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

// ── Sync Metadata ───────────────────────────────────────────────────

/** Get the last successful sync timestamp. */
export function getLastSyncTime(): string | null {
  return getSetting('last_sync_time');
}

/** Record the current time as the last sync. */
export function setLastSyncTime(time: string): void {
  setSetting('last_sync_time', time);
}

// ── High-Risk Check ─────────────────────────────────────────────────

/** Check if there are any pending-sync cases that are high risk. */
export function hasPendingHighRiskCases(): boolean {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM cases
     WHERE sync_status = 'pending'
       AND sync_opt_out = 0
       AND status != 'draft'
       AND json_extract(triage_result, '$.finalRiskLevel') = 'high'`,
  );
  return (row?.count ?? 0) > 0;
}

// ── Stub: Sync All ──────────────────────────────────────────────────



function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 8000,
  errorMsg: string = 'Network timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

/**
 * Syncs all pending items to the cloud.
 * Connects directly to Firebase Firestore to push local SQLite cases.
 * Protected with timeouts so operations never hang indefinitely.
 */
export async function syncAll(): Promise<{ synced: number; failed: number }> {
  // 1. Reset any items stuck in 'uploading' back to 'pending'
  const db = getDatabase();
  db.runSync("UPDATE sync_queue SET status = 'pending' WHERE status = 'uploading'");

  const pending = getPendingSyncItems();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      // Mark as uploading locally
      updateSyncItemStatus(item.id, 'uploading');

      if (item.type === 'case') {
        // ── Upload case metadata to Firestore ──────────────────────
        const caseRecord = getCase(item.referenceId);
        if (caseRecord) {
          const docRef = doc(firestoreDb, 'cases', caseRecord.id);
          await withTimeout(
            setDoc(docRef, {
              ...caseRecord,
              syncedAt: new Date().toISOString(),
            }),
            8000,
            'Firestore connection timed out. (Ensure Cloud Firestore is created in Firebase Console)'
          );
        }
      } else if (item.type === 'image') {
        // ── Sync image payload directly to Firestore (No Blaze / Cloud Storage required) ──
        const images = getImages(item.referenceId);

        for (const image of images) {
          try {
            let base64Data: string | null = null;
            try {
              base64Data = await FileSystem.readAsStringAsync(image.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch (readErr) {
              console.warn(`[SyncService] Could not read image ${image.id} as base64:`, readErr);
            }

            const caseDocRef = doc(firestoreDb, 'cases', image.caseId);
            await withTimeout(
              setDoc(
                caseDocRef,
                {
                  images: {
                    [image.id]: {
                      id: image.id,
                      capturedAt: image.capturedAt,
                      base64: base64Data ? `data:image/jpeg;base64,${base64Data.slice(0, 300000)}` : null,
                    },
                  },
                  imagesSyncedAt: new Date().toISOString(),
                },
                { merge: true }
              ),
              8000
            );

            console.log(`[SyncService] Image ${image.id} synced directly to Firestore.`);
          } catch (imgErr) {
            console.warn(`[SyncService] Failed to sync image ${image.id}:`, imgErr);
          }
        }
      } else if (item.type === 'worker_registration') {
        // —— Upload worker profile to Firestore ——
        const worker = getWorker(item.referenceId);
        if (worker) {
          const docRef = doc(firestoreDb, 'workers', worker.id);
          await withTimeout(
            setDoc(docRef, {
              ...worker,
              syncedAt: new Date().toISOString(),
            }),
            8000,
            'Firestore connection timed out. (Ensure Cloud Firestore is created in Firebase Console)'
          );
          console.log(`[SyncService] Worker ${worker.id} synced to cloud.`);
        } else {
          console.warn(`[SyncService] Worker ${item.referenceId} not found for sync.`);
        }
      } else {
        console.warn(`[SyncService] Unhandled sync item type: ${item.type}. Skipping.`);
      }

      // Mark as done locally
      updateSyncItemStatus(item.id, 'done');
      synced++;
    } catch (err: any) {
      console.error(`[SyncService] Failed to sync item ${item.id}:`, err);
      let msg = err instanceof Error ? err.message : 'Unknown error';
      if (
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('disabled') ||
        msg.includes('has not been used in project')
      ) {
        msg = 'Cloud Firestore is not enabled in Firebase Console (project: medgaurd-2b15f).';
      }
      updateSyncItemStatus(item.id, 'failed', msg);
      failed++;
    }
  }

  if (synced > 0) {
    setLastSyncTime(new Date().toISOString());
  }

  // —— DOWNSTREAM SYNC: Fetch Facilities from Firestore ——
  try {
    const facilitiesSnapshot = await withTimeout(
      getDocs(collection(firestoreDb, 'facilities')),
      5000,
      'Facilities fetch timed out'
    );
    if (!facilitiesSnapshot.empty) {
      const cloudFacilities = facilitiesSnapshot.docs.map((doc) => doc.data() as any);
      cacheFacilities(cloudFacilities);
      console.log(`[SyncService] Fetched ${cloudFacilities.length} real facilities from cloud.`);
    }
  } catch (err) {
    console.warn('[SyncService] Failed to fetch facilities from cloud. Proceeding with cached seed data.');
  }

  return { synced, failed };
}

