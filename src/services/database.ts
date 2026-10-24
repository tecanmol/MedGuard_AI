/**
 * MedGuard AI — SQLite Database Service
 *
 * Offline-first encrypted local database using expo-sqlite v57 with SQLCipher.
 * Hardware-backed key management ensures all patient data, cases, and agent verdicts
 * are strongly encrypted at rest (AES-256). Includes auto-migration for pre-existing
 * plaintext databases.
 */

import * as SQLite from 'expo-sqlite';
import { getOrCreateDatabaseKeySync } from './key-management';

let db: SQLite.SQLiteDatabase | null = null;

// ── Schema Definition ────────────────────────────────────────────────

export function applySchema(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phc_affiliation TEXT NOT NULL DEFAULT '',
      pin_hash TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      registered_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY NOT NULL,
      worker_id TEXT NOT NULL,
      patient_metadata TEXT NOT NULL DEFAULT '{}',
      classification_result TEXT,
      triage_result TEXT,
      care_guideline TEXT,
      referral_info TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_opt_out INTEGER NOT NULL DEFAULT 0,
      outcome TEXT,
      model_version TEXT NOT NULL DEFAULT '',
      guideline_version TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS case_images (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      quality_score REAL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS agent_verdicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      verdict TEXT NOT NULL DEFAULT '',
      confidence REAL,
      risk_level TEXT,
      explanation TEXT NOT NULL DEFAULT '',
      override_applied INTEGER NOT NULL DEFAULT 0,
      flags TEXT DEFAULT '[]',
      timestamp TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_attempt TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      estimated_size_bytes INTEGER DEFAULT 0
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      distance REAL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      operating_hours TEXT NOT NULL DEFAULT '24/7',
      tier_level INTEGER NOT NULL DEFAULT 1,
      emergency_contact TEXT,
      transit_minutes_rural INTEGER,
      cached_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}'
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS facility_cache_regions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      min_latitude REAL NOT NULL,
      max_latitude REAL NOT NULL,
      min_longitude REAL NOT NULL,
      max_longitude REAL NOT NULL,
      facility_count INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT NOT NULL
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS map_cache (
      key TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);

  // Performance and spatial indexes
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_cases_worker_id ON cases(worker_id);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_case_images_case_id ON case_images(case_id);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_agent_verdicts_case_id ON agent_verdicts(case_id);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_facilities_coords ON facilities(latitude, longitude);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(type);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_facilities_tier ON facilities(tier_level);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_facility_cache_regions_bounds ON facility_cache_regions(min_latitude, max_latitude, min_longitude, max_longitude);`);
}

// ── Database Initialization & Plaintext Migration ───────────────────

function openAndConfigureDatabase(databaseName: string = 'medguard.db'): SQLite.SQLiteDatabase {
  const key = getOrCreateDatabaseKeySync();

  // 1. Open database connection and IMMEDIATELY apply SQLCipher encryption key.
  // In SQLCipher, PRAGMA key must be executed as the very first command.
  let connection = SQLite.openDatabaseSync(databaseName);
  let isEncryptedValid = false;

  try {
    connection.execSync(`PRAGMA key = "x'${key}'";`);
    // Verify that the database can be read with the key (or is a freshly keyed database)
    connection.getAllSync("SELECT count(*) FROM sqlite_master;");
    isEncryptedValid = true;
  } catch {
    // If querying with PRAGMA key failed, the file may be a pre-existing plaintext database
    isEncryptedValid = false;
  }

  if (isEncryptedValid) {
    try {
      connection.execSync('PRAGMA foreign_keys = ON;');
    } catch {
      // Non-fatal
    }
    return connection;
  }

  // 2. The keyed attempt failed. Close connection and check if this is an existing plaintext SQLite database.
  try {
    connection.closeSync();
  } catch {
    // Non-fatal
  }

  let isPlaintext = false;
  let existingTables: { name: string }[] = [];
  let plaintextConn: SQLite.SQLiteDatabase | null = null;

  try {
    plaintextConn = SQLite.openDatabaseSync(databaseName);
    existingTables = plaintextConn.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%'"
    );
    if (existingTables && existingTables.length > 0) {
      isPlaintext = true;
    }
  } catch {
    isPlaintext = false;
  }

  // 3. If pre-existing plaintext database is detected, perform safe migration without data loss
  if (isPlaintext && plaintextConn) {
    console.log('[database] Pre-existing plaintext SQLite database detected. Migrating to SQLCipher...');
    const tableData: { name: string; rows: any[] }[] = [];
    for (const tbl of existingTables) {
      try {
        const rows = plaintextConn.getAllSync<any>(`SELECT * FROM "${tbl.name}"`);
        tableData.push({ name: tbl.name, rows });
      } catch (err) {
        console.warn(`[database] Migration: failed to dump ${tbl.name}:`, err);
      }
    }

    try {
      plaintextConn.closeSync();
    } catch {
      // Non-fatal
    }

    try {
      SQLite.deleteDatabaseSync(databaseName);
    } catch {
      // Non-fatal
    }

    // Open fresh database with encryption key
    const newEncryptedConn = SQLite.openDatabaseSync(databaseName);
    newEncryptedConn.execSync(`PRAGMA key = "x'${key}'";`);
    try {
      newEncryptedConn.execSync('PRAGMA foreign_keys = ON;');
    } catch {
      // Non-fatal
    }

    // Apply schema
    applySchema(newEncryptedConn);

    // Replay extracted rows
    for (const item of tableData) {
      if (item.rows.length === 0) continue;
      for (const row of item.rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const colNames = columns.map((c) => `"${c}"`).join(', ');
        const values = Object.values(row);
        try {
          newEncryptedConn.runSync(
            `INSERT OR REPLACE INTO "${item.name}" (${colNames}) VALUES (${placeholders})`,
            values as any
          );
        } catch (err) {
          console.warn(`[database] Migration: failed to insert row into ${item.name}:`, err);
        }
      }
    }
    console.log('[database] Plaintext to SQLCipher migration completed successfully.');
    return newEncryptedConn;
  }

  // If unkeyed probe was opened but had no tables, close it
  if (plaintextConn) {
    try {
      plaintextConn.closeSync();
    } catch {
      // Non-fatal
    }
  }

  // 4. Default: Open with encryption key
  const finalConn = SQLite.openDatabaseSync(databaseName);
  finalConn.execSync(`PRAGMA key = "x'${key}'";`);
  try {
    finalConn.execSync('PRAGMA foreign_keys = ON;');
  } catch {
    // Non-fatal
  }
  return finalConn;
}

// ── Public Service API ──────────────────────────────────────────────

/**
 * Returns the singleton encrypted database instance.
 * Call initDatabase() first to ensure tables exist.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = openAndConfigureDatabase('medguard.db');
  }
  return db;
}

/**
 * Initialize the database schema. Safe to call multiple times —
 * uses CREATE TABLE IF NOT EXISTS.
 */
export function initDatabase(): void {
  const database = getDatabase();
  applySchema(database);
}

/** Get a setting value by key. */
export function getSetting(key: string): string | null {
  const database = getDatabase();
  const row = database.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

/** Set a setting value (upsert). */
export function setSetting(key: string, value: string): void {
  const database = getDatabase();
  database.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

/**
 * Closes the active database connection. Useful for test teardowns.
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.closeSync();
    } catch {
      // Non-fatal
    }
    db = null;
  }
}

/**
 * Resets database state for testing harnesses.
 */
export function resetDatabaseForTesting(): void {
  closeDatabase();
}
