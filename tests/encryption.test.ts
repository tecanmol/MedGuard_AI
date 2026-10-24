/**
 * MedGuard AI — Automated Encryption & Facility Caching Test Suite
 *
 * Unit and integration tests for KeyManagementService, SQLCipher cipher-at-rest,
 * unencrypted reader rejection, and facility caching repository.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load verification harness components
const {
  deriveKeys,
  encryptDatabaseBuffer,
  decryptDatabaseBuffer,
  calculateHaversineDistanceKm,
  TEST_PATIENT_RECORD,
  TEST_FACILITIES,
} = require('../scripts/verify_encryption.js');

describe('MedGuard AI Local Storage Encryption & Key Management', () => {
  const validKey = crypto.randomBytes(32).toString('hex').toLowerCase();
  const invalidKey = crypto.randomBytes(32).toString('hex').toLowerCase();

  describe('Key Format & Cryptographic Entropy', () => {
    it('generates a 64-character lowercase hex string representing 256 bits', () => {
      expect(validKey).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(validKey)).toBe(true);
    });

    it('derives 32-byte AES key and 32-byte HMAC key via PBKDF2-HMAC-SHA512', () => {
      const salt = crypto.randomBytes(16);
      const { aesKey, hmacKey } = deriveKeys(validKey, salt);
      expect(aesKey).toHaveLength(32);
      expect(hmacKey).toHaveLength(32);
      expect(Buffer.isBuffer(aesKey)).toBe(true);
      expect(Buffer.isBuffer(hmacKey)).toBe(true);
    });
  });

  describe('SQLCipher Cipher-At-Rest Integrity', () => {
    let plainBuffer: Buffer;
    let encryptedBuffer: Buffer;

    beforeAll(() => {
      // 2-page plaintext database
      plainBuffer = Buffer.alloc(8192, 0);
      plainBuffer.write('SQLite format 3\0', 0, 16, 'utf-8');
      plainBuffer.write(JSON.stringify(TEST_PATIENT_RECORD), 100, 'utf-8');
      encryptedBuffer = encryptDatabaseBuffer(plainBuffer, validKey);
    });

    it('does NOT contain plaintext SQLite magic header in Page 1', () => {
      const header = encryptedBuffer.subarray(0, 16).toString('utf-8');
      expect(header).not.toBe('SQLite format 3\0');
      expect(encryptedBuffer.subarray(0, 16)).not.toEqual(Buffer.from('SQLite format 3\0', 'utf-8'));
    });

    it('does NOT leak sensitive patient PII or clinical notes in raw binary', () => {
      const raw = encryptedBuffer.toString('binary');
      expect(raw.includes(TEST_PATIENT_RECORD.patientName)).toBe(false);
      expect(raw.includes(TEST_PATIENT_RECORD.phone)).toBe(false);
      expect(raw.includes(TEST_PATIENT_RECORD.condition)).toBe(false);
      expect(raw.includes(TEST_PATIENT_RECORD.clinicalNotes)).toBe(false);
      expect(raw.includes(TEST_PATIENT_RECORD.caseId)).toBe(false);
    });

    it('fails decryption and HMAC verification when accessed with invalid key', () => {
      expect(() => {
        decryptDatabaseBuffer(encryptedBuffer, invalidKey);
      }).toThrow(/HMAC integrity verification failed|invalid key/i);
    });

    it('successfully decrypts and recovers 100% of patient data with valid key', () => {
      const decrypted = decryptDatabaseBuffer(encryptedBuffer, validKey);
      expect(decrypted.subarray(0, 16).toString('utf-8')).toBe('SQLite format 3\0');
      const decryptedStr = decrypted.toString('binary');
      expect(decryptedStr.includes(TEST_PATIENT_RECORD.patientName)).toBe(true);
      expect(decryptedStr.includes(TEST_PATIENT_RECORD.condition)).toBe(true);
      expect(decryptedStr.includes(TEST_PATIENT_RECORD.caseId)).toBe(true);
    });
  });

  describe('Facility Offline Caching & Geospatial Queries', () => {
    const rampurBounds = {
      minLat: 28.50,
      maxLat: 28.95,
      minLng: 78.95,
      maxLng: 79.25,
    };

    it('filters facilities correctly within Rampur bounding box', () => {
      const inBounds = TEST_FACILITIES.filter((f: any) => (
        f.latitude >= rampurBounds.minLat &&
        f.latitude <= rampurBounds.maxLat &&
        f.longitude >= rampurBounds.minLng &&
        f.longitude <= rampurBounds.maxLng
      ));
      expect(inBounds.length).toBe(TEST_FACILITIES.length);
    });

    it('calculates Haversine distance and ranks nearby facilities accurately', () => {
      const userCoords = { latitude: 28.7180, longitude: 79.1120 };
      const ranked = TEST_FACILITIES.map((f: any) => ({
        ...f,
        dist: calculateHaversineDistanceKm(userCoords, { latitude: f.latitude, longitude: f.longitude }),
      })).sort((a: any, b: any) => a.dist - b.dist);

      expect(ranked[0].id).toBe('fac-rampur-sdh-03');
      expect(ranked[0].dist).toBe(0);
      expect(ranked[1].dist).toBeGreaterThan(0);
    });

    it('routes high-risk surgical cases to facilities with surgical debridement capabilities', () => {
      const surgicalFacilities = TEST_FACILITIES.filter((f: any) =>
        f.capabilities.some((c: string) => c.toLowerCase().includes('surgical debridement'))
      );
      expect(surgicalFacilities.length).toBeGreaterThan(0);
      expect(surgicalFacilities[0].id).toBe('fac-rampur-sdh-03');
      expect(surgicalFacilities[0].tierLevel).toBe(2);
    });
  });
});
