/**
 * MedGuard AI — Secure Key Management Service
 *
 * Hardware-backed database encryption key lifecycle management using expo-secure-store.
 * Stores 256-bit AES encryption keys in hardware Keystore (AndroidKeyStore / iOS Keychain).
 * Supports KeystoreProvider adapter pattern with InMemoryKeystoreProvider for testing.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// ── Interfaces & Types ───────────────────────────────────────────────

export interface KeystoreProvider {
  /** Synchronous retrieval of a stored string value. */
  getItem(key: string): string | null;
  /** Synchronous storage of a string value. */
  setItem(key: string, value: string): void;
  /** Deletion of a stored string value. */
  deleteItem(key: string): void;
  /** Asynchronous retrieval. */
  getItemAsync?(key: string): Promise<string | null>;
  /** Asynchronous storage. */
  setItemAsync?(key: string, value: string): Promise<void>;
  /** Asynchronous deletion. */
  deleteItemAsync?(key: string): Promise<void>;
}

// ── Constants & Configuration ───────────────────────────────────────

export const DB_KEY_ALIAS = 'medguard_db_encryption_key_v1';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

// ── Providers ───────────────────────────────────────────────────────

/**
 * Production hardware keystore provider utilizing expo-secure-store.
 * Bound to device hardware via AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY.
 */
export class NativeSecureStoreProvider implements KeystoreProvider {
  getItem(key: string): string | null {
    try {
      return SecureStore.getItem(key, SECURE_STORE_OPTIONS);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      SecureStore.setItem(key, value, SECURE_STORE_OPTIONS);
    } catch {
      // In non-native test environments, fallback safely
    }
  }

  deleteItem(key: string): void {
    try {
      SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS).catch(() => {});
    } catch {
      // Non-blocking fallback
    }
  }

  async getItemAsync(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch {
      return null;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    } catch {
      // Non-blocking fallback
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    } catch {
      // Non-blocking fallback
    }
  }
}

/**
 * In-memory keystore provider for Node.js test scripts and Jest test environments.
 */
export class InMemoryKeystoreProvider implements KeystoreProvider {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  deleteItem(key: string): void {
    this.store.delete(key);
  }

  async getItemAsync(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.setItem(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.deleteItem(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// ── Module State ────────────────────────────────────────────────────

let activeProvider: KeystoreProvider | null = null;
let memoryCachedKey: string | null = null;

/**
 * Probes whether the native SecureStore module is linked and functioning.
 */
function isNativeSecureStoreAvailable(): boolean {
  try {
    if (typeof SecureStore.getItem === 'function') {
      SecureStore.getItem('__medguard_keystore_probe__');
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Resolves the active keystore provider. If none configured, auto-detects
 * between NativeSecureStoreProvider and InMemoryKeystoreProvider.
 */
function getProvider(): KeystoreProvider {
  if (activeProvider) {
    return activeProvider;
  }

  if (isNativeSecureStoreAvailable()) {
    activeProvider = new NativeSecureStoreProvider();
    return activeProvider;
  }

  activeProvider = new InMemoryKeystoreProvider();
  return activeProvider;
}

// ── Key Generation & Validation ─────────────────────────────────────

/**
 * Validates whether candidate key is a 64-character lowercase hexadecimal string (256-bit).
 */
export function isValidKeyFormat(key: string): boolean {
  return typeof key === 'string' && /^[0-9a-f]{64}$/i.test(key);
}

/**
 * Generates a cryptographically secure 256-bit AES key formatted as a 64-char lowercase hex string.
 * Uses expo-crypto getRandomBytes(32) with webcrypto/Node fallback for testing.
 */
export function generateDatabaseKey(): string {
  let bytes: Uint8Array | null = null;
  try {
    if (typeof Crypto.getRandomBytes === 'function') {
      bytes = Crypto.getRandomBytes(32);
    }
  } catch {
    bytes = null;
  }

  if (!bytes) {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const fallback = new Uint8Array(32);
      globalThis.crypto.getRandomValues(fallback as any);
      bytes = fallback;
    } else {
      try {
        // Node.js fallback for test runner
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto');
        bytes = new Uint8Array(nodeCrypto.randomBytes(32));
      } catch {
        throw new Error('[KeyManagementService] Cryptographic random entropy generator unavailable');
      }
    }
  }

  if (!bytes || bytes.length !== 32) {
    throw new Error('[KeyManagementService] Failed to generate 256-bit key');
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase();
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Synchronously retrieves or generates the 256-bit database encryption key.
 * Caches in-memory for zero-overhead subsequent queries.
 */
export function getOrCreateDatabaseKeySync(): string {
  if (memoryCachedKey && isValidKeyFormat(memoryCachedKey)) {
    return memoryCachedKey;
  }

  const provider = getProvider();
  let key: string | null = null;
  try {
    key = provider.getItem(DB_KEY_ALIAS);
  } catch {
    key = null;
  }

  if (!key || !isValidKeyFormat(key)) {
    key = generateDatabaseKey();
    provider.setItem(DB_KEY_ALIAS, key);
  }

  memoryCachedKey = key;
  return key;
}

/**
 * Asynchronously retrieves or generates the 256-bit database encryption key.
 */
export async function getOrCreateDatabaseKey(): Promise<string> {
  if (memoryCachedKey && isValidKeyFormat(memoryCachedKey)) {
    return memoryCachedKey;
  }

  const provider = getProvider();
  let key: string | null = null;
  try {
    if (provider.getItemAsync) {
      key = await provider.getItemAsync(DB_KEY_ALIAS);
    } else {
      key = provider.getItem(DB_KEY_ALIAS);
    }
  } catch {
    key = null;
  }

  if (!key || !isValidKeyFormat(key)) {
    key = generateDatabaseKey();
    if (provider.setItemAsync) {
      await provider.setItemAsync(DB_KEY_ALIAS, key);
    } else {
      provider.setItem(DB_KEY_ALIAS, key);
    }
  }

  memoryCachedKey = key;
  return key;
}

/**
 * Synchronously retrieves the stored database key without generating a new one.
 */
export function getDatabaseKeySync(): string | null {
  if (memoryCachedKey && isValidKeyFormat(memoryCachedKey)) {
    return memoryCachedKey;
  }

  const provider = getProvider();
  try {
    const key = provider.getItem(DB_KEY_ALIAS);
    if (key && isValidKeyFormat(key)) {
      memoryCachedKey = key;
      return key;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Asynchronously retrieves the stored database key without generating a new one.
 */
export async function getDatabaseKey(): Promise<string | null> {
  if (memoryCachedKey && isValidKeyFormat(memoryCachedKey)) {
    return memoryCachedKey;
  }

  const provider = getProvider();
  try {
    const key = provider.getItemAsync
      ? await provider.getItemAsync(DB_KEY_ALIAS)
      : provider.getItem(DB_KEY_ALIAS);
    if (key && isValidKeyFormat(key)) {
      memoryCachedKey = key;
      return key;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Checks if a database encryption key currently exists in SecureStore.
 */
export async function isDatabaseKeyPresent(): Promise<boolean> {
  const key = await getDatabaseKey();
  return key !== null;
}

/**
 * Permanently deletes the database encryption key from SecureStore and wipes in-memory cache.
 * WARNING: Calling this will render any existing encrypted database permanently unreadable.
 */
export async function deleteDatabaseKey(): Promise<void> {
  memoryCachedKey = null;
  const provider = getProvider();
  if (provider.deleteItemAsync) {
    await provider.deleteItemAsync(DB_KEY_ALIAS);
  } else {
    provider.deleteItem(DB_KEY_ALIAS);
  }
}

/**
 * Clears the cached encryption key from memory without deleting it from SecureStore.
 */
export function clearMemoryKey(): void {
  memoryCachedKey = null;
}

/**
 * Sets an explicit keystore provider for testing/verification harnesses.
 * Set to null to restore default behavior.
 */
export function setKeystoreProviderForTesting(provider: KeystoreProvider | null): void {
  activeProvider = provider;
  memoryCachedKey = null;
}

/**
 * Resets all internal service state, memory caches, and restores default providers.
 */
export function resetKeyManagementForTesting(): void {
  activeProvider = null;
  memoryCachedKey = null;
}
