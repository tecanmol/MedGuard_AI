/**
 * MedGuard AI — Worker Repository
 *
 * Worker registration, offline PIN authentication, and session management.
 * PIN is stored as a SHA-256 hash — the raw PIN never persists.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { SyncStatus, Worker } from '@/models/types';
import { getDatabase } from './database';

// ── Constants ───────────────────────────────────────────────────────

const SESSION_KEY = 'medguard_session_worker_id';

// ── Row shape ───────────────────────────────────────────────────────

interface WorkerRow {
  id: string;
  name: string;
  phone: string;
  phc_affiliation: string;
  pin_hash: string;
  language: string;
  registered_at: string;
  sync_status: string;
}

function rowToWorker(row: WorkerRow): Worker {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phcAffiliation: row.phc_affiliation,
    pinHash: row.pin_hash,
    language: row.language,
    registeredAt: row.registered_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}

// ── PIN Hashing ─────────────────────────────────────────────────────

/** Hash a PIN string using SHA-256. */
export async function hashPin(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin,
  );
}

// ── Worker CRUD ─────────────────────────────────────────────────────

/**
 * Register a new worker. Hashes the PIN and stores locally.
 * Queues a sync item for cloud registration.
 */
export async function registerWorker(
  worker: {
    id: string;
    name: string;
    phone: string;
    phcAffiliation: string;
    language: string;
  },
  pin: string,
): Promise<Worker> {
  const db = getDatabase();
  const pinHash = await hashPin(pin);
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO workers (id, name, phone, phc_affiliation, pin_hash, language, registered_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      worker.id,
      worker.name,
      worker.phone,
      worker.phcAffiliation,
      pinHash,
      worker.language,
      now,
    ],
  );

  // Queue sync for registration
  db.runSync(
    `INSERT OR IGNORE INTO sync_queue (id, type, reference_id, status, retry_count, estimated_size_bytes)
     VALUES (?, 'worker_registration', ?, 'pending', 0, 512)`,
    [`sync-worker-${worker.id}`, worker.id],
  );

  return {
    ...worker,
    pinHash,
    registeredAt: now,
    syncStatus: 'pending',
  };
}

/**
 * Validate a PIN against the stored hash.
 * Returns true if the PIN matches.
 */
export async function validatePin(workerId: string, pin: string): Promise<boolean> {
  const db = getDatabase();
  const row = db.getFirstSync<{ pin_hash: string }>(
    'SELECT pin_hash FROM workers WHERE id = ? OR phone = ?',
    [workerId, workerId],
  );
  if (!row) return false;

  const inputHash = await hashPin(pin);
  return inputHash === row.pin_hash;
}

/** Get a worker by ID. */
export function getWorker(id: string): Worker | null {
  const db = getDatabase();
  const row = db.getFirstSync<WorkerRow>(
    'SELECT * FROM workers WHERE id = ?',
    [id],
  );
  return row ? rowToWorker(row) : null;
}

/** Get a worker by phone number. */
export function getWorkerByPhone(phone: string): Worker | null {
  const db = getDatabase();
  const row = db.getFirstSync<WorkerRow>(
    'SELECT * FROM workers WHERE phone = ?',
    [phone],
  );
  return row ? rowToWorker(row) : null;
}

/** Find a worker by ID or phone (used in login). */
export function findWorker(idOrPhone: string): Worker | null {
  const db = getDatabase();
  const row = db.getFirstSync<WorkerRow>(
    'SELECT * FROM workers WHERE id = ? OR phone = ?',
    [idOrPhone, idOrPhone],
  );
  return row ? rowToWorker(row) : null;
}

/** Update worker profile fields. */
export function updateWorker(updates: Partial<Worker> & { id: string }): void {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }
  if (updates.phcAffiliation !== undefined) {
    fields.push('phc_affiliation = ?');
    values.push(updates.phcAffiliation);
  }
  if (updates.language !== undefined) {
    fields.push('language = ?');
    values.push(updates.language);
  }

  if (fields.length === 0) return;

  values.push(updates.id);
  db.runSync(
    `UPDATE workers SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Session Management (SecureStore) ────────────────────────────────

/** Persist the current worker session. */
export async function saveSession(workerId: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, workerId);
}

/** Retrieve the saved session worker ID (null if no session). */
export async function getSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Clear the current session (logout). */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Ignore — key may not exist
  }
}

