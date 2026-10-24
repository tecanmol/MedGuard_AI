/**
 * MedGuard AI — Case Repository
 *
 * CRUD operations for cases with full offline support.
 * All reads/writes go to the local SQLite database.
 */

import * as Crypto from 'expo-crypto';

import type {
    AgentVerdict,
    CaseImage,
    CaseRecord,
    PatientMetadata,
    RiskLevel,
    SyncStatus,
} from '@/models/types';
import { getDatabase } from './database';

// ── Row shape from SQLite ───────────────────────────────────────────

interface CaseRow {
  id: string;
  worker_id: string;
  patient_metadata: string;
  classification_result: string | null;
  triage_result: string | null;
  care_guideline: string | null;
  referral_info: string | null;
  status: string;
  sync_status: string;
  sync_opt_out: number;
  outcome: string | null;
  model_version: string;
  guideline_version: string;
  created_at: string;
  updated_at: string;
}

interface ImageRow {
  id: string;
  case_id: string;
  uri: string;
  captured_at: string;
  quality_score: number | null;
}

interface VerdictRow {
  id: number;
  case_id: string;
  agent_type: string;
  verdict: string;
  confidence: number | null;
  risk_level: string | null;
  explanation: string;
  override_applied: number;
  flags: string;
  timestamp: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToCase(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    workerId: row.worker_id,
    patientMetadata: jsonParse<PatientMetadata>(row.patient_metadata, {
      age: 0,
      conditionCategory: 'other',
    }),
    images: [], // loaded separately
    classificationResult: jsonParse(row.classification_result, undefined),
    triageResult: jsonParse(row.triage_result, undefined),
    careGuideline: jsonParse(row.care_guideline, undefined),
    referralInfo: jsonParse(row.referral_info, undefined),
    status: row.status as CaseRecord['status'],
    syncStatus: row.sync_status as SyncStatus,
    syncOptOut: row.sync_opt_out === 1,
    outcome: row.outcome ?? undefined,
    modelVersion: row.model_version,
    guidelineVersion: row.guideline_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToImage(row: ImageRow): CaseImage {
  return {
    id: row.id,
    caseId: row.case_id,
    uri: row.uri,
    capturedAt: row.captured_at,
    qualityScore: row.quality_score ?? undefined,
  };
}

function rowToVerdict(row: VerdictRow): AgentVerdict {
  return {
    agentType: row.agent_type as AgentVerdict['agentType'],
    verdict: row.verdict,
    confidence: row.confidence ?? undefined,
    riskLevel: (row.risk_level as RiskLevel) ?? undefined,
    explanation: row.explanation,
    overrideApplied: row.override_applied === 1,
    flags: jsonParse<string[]>(row.flags, []),
    timestamp: row.timestamp,
  };
}

// ── Generate UUID ───────────────────────────────────────────────────

/** Generate a new UUID for a case record. */
export function generateCaseId(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Fallback if native module not linked
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── CRUD Operations ─────────────────────────────────────────────────

/**
 * Upsert a draft case. Called on every field change for auto-save.
 * Creates a new row if the case doesn't exist, else updates it.
 */
export function saveDraft(caseData: Partial<CaseRecord> & { id: string; workerId: string }): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO cases (id, worker_id, patient_metadata, classification_result,
       triage_result, care_guideline, referral_info, status, sync_status,
       sync_opt_out, outcome, model_version, guideline_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', 0, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       patient_metadata = excluded.patient_metadata,
       classification_result = COALESCE(excluded.classification_result, classification_result),
       triage_result = COALESCE(excluded.triage_result, triage_result),
       care_guideline = COALESCE(excluded.care_guideline, care_guideline),
       referral_info = COALESCE(excluded.referral_info, referral_info),
       model_version = excluded.model_version,
       guideline_version = excluded.guideline_version,
       updated_at = excluded.updated_at`,
    [
      caseData.id,
      caseData.workerId,
      JSON.stringify(caseData.patientMetadata ?? {}),
      caseData.classificationResult ? JSON.stringify(caseData.classificationResult) : null,
      caseData.triageResult ? JSON.stringify(caseData.triageResult) : null,
      caseData.careGuideline ? JSON.stringify(caseData.careGuideline) : null,
      caseData.referralInfo ? JSON.stringify(caseData.referralInfo) : null,
      caseData.modelVersion ?? '',
      caseData.guidelineVersion ?? '',
      caseData.createdAt ?? now,
      now,
    ],
  );
}

/** Save a finalized case record. */
export function saveCase(caseRecord: CaseRecord): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO cases
       (id, worker_id, patient_metadata, classification_result, triage_result,
        care_guideline, referral_info, status, sync_status, sync_opt_out,
        outcome, model_version, guideline_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       worker_id = excluded.worker_id,
       patient_metadata = excluded.patient_metadata,
       classification_result = excluded.classification_result,
       triage_result = excluded.triage_result,
       care_guideline = excluded.care_guideline,
       referral_info = excluded.referral_info,
       status = excluded.status,
       sync_status = excluded.sync_status,
       sync_opt_out = excluded.sync_opt_out,
       outcome = excluded.outcome,
       model_version = excluded.model_version,
       guideline_version = excluded.guideline_version,
       updated_at = excluded.updated_at`,
    [
      caseRecord.id,
      caseRecord.workerId,
      JSON.stringify(caseRecord.patientMetadata),
      caseRecord.classificationResult ? JSON.stringify(caseRecord.classificationResult) : null,
      caseRecord.triageResult ? JSON.stringify(caseRecord.triageResult) : null,
      caseRecord.careGuideline ? JSON.stringify(caseRecord.careGuideline) : null,
      caseRecord.referralInfo ? JSON.stringify(caseRecord.referralInfo) : null,
      caseRecord.status,
      caseRecord.syncStatus,
      caseRecord.syncOptOut ? 1 : 0,
      caseRecord.outcome ?? null,
      caseRecord.modelVersion,
      caseRecord.guidelineVersion,
      caseRecord.createdAt,
      now,
    ],
  );

  // Preserve and persist images if provided on the caseRecord
  if (caseRecord.images && caseRecord.images.length > 0) {
    saveImages(caseRecord.images);
  }
}

/** Get a single case by ID (without images — call getImages separately). */
export function getCase(id: string): CaseRecord | null {
  const db = getDatabase();
  const row = db.getFirstSync<CaseRow>('SELECT * FROM cases WHERE id = ?', [id]);
  if (!row) return null;
  const record = rowToCase(row);
  record.images = getImages(id);
  return record;
}

/** Get the N most recent cases, sorted by createdAt descending. */
export function getRecentCases(limit: number = 5): CaseRecord[] {
  const db = getDatabase();
  const rows = db.getAllSync<CaseRow>(
    'SELECT * FROM cases ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(rowToCase);
}

/** Count cases created today for a specific worker. */
export function getCasesToday(workerId: string): number {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cases WHERE worker_id = ? AND created_at >= ? AND status != 'draft'",
    [workerId, today],
  );
  return row?.count ?? 0;
}

/** Count cases created in the last 7 days for a specific worker. */
export function getWeeklyCaseCount(workerId: string): number {
  const db = getDatabase();
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const weekAgoStr = d.toISOString();
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cases WHERE worker_id = ? AND created_at >= ? AND status != 'draft'",
    [workerId, weekAgoStr]
  );
  return row?.count ?? 0;
}

/** Count high-risk cases that are pending referral for a worker. */
export function getHighRiskPendingCount(workerId: string): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM cases
     WHERE worker_id = ?
       AND json_extract(triage_result, '$.finalRiskLevel') = 'high'
       AND status = 'completed'`,
    [workerId],
  );
  return row?.count ?? 0;
}

/** Count cases with sync_status = 'pending'. */
export function getPendingSyncCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cases WHERE sync_status = 'pending' AND sync_opt_out = 0 AND status != 'draft'",
  );
  return row?.count ?? 0;
}

/** Search and filter cases. */
export function searchCases(filters: {
  riskLevel?: RiskLevel;
  condition?: string;
  syncStatus?: SyncStatus;
  startDate?: string;
  endDate?: string;
  query?: string;
}): CaseRecord[] {
  const db = getDatabase();
  const conditions: string[] = ["status != 'draft'"];
  const params: (string | number)[] = [];

  if (filters.riskLevel) {
    conditions.push("json_extract(triage_result, '$.finalRiskLevel') = ?");
    params.push(filters.riskLevel);
  }
  if (filters.condition) {
    conditions.push("json_extract(patient_metadata, '$.conditionCategory') = ?");
    params.push(filters.condition);
  }
  if (filters.syncStatus) {
    conditions.push('sync_status = ?');
    params.push(filters.syncStatus);
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate);
  }
  if (filters.query) {
    conditions.push("(patient_metadata LIKE ? OR id LIKE ?)");
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.getAllSync<CaseRow>(
    `SELECT * FROM cases ${whereClause} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(rowToCase);
}

/** Update the outcome field for a case. */
export function updateOutcome(caseId: string, outcome: string): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE cases SET outcome = ?, updated_at = ? WHERE id = ?',
    [outcome, new Date().toISOString(), caseId],
  );
}

/** Update the sync status for a case. */
export function updateSyncStatus(caseId: string, status: SyncStatus): void {
  const db = getDatabase();
  db.runSync('UPDATE cases SET sync_status = ? WHERE id = ?', [status, caseId]);
}

// ── Images ──────────────────────────────────────────────────────────

/** Save images for a case. */
export function saveImages(images: CaseImage[]): void {
  const db = getDatabase();
  for (const img of images) {
    db.runSync(
      `INSERT OR REPLACE INTO case_images (id, case_id, uri, captured_at, quality_score)
       VALUES (?, ?, ?, ?, ?)`,
      [img.id, img.caseId, img.uri, img.capturedAt, img.qualityScore ?? null],
    );
  }
}

/** Get all images for a case. */
export function getImages(caseId: string): CaseImage[] {
  const db = getDatabase();
  const rows = db.getAllSync<ImageRow>(
    'SELECT * FROM case_images WHERE case_id = ? ORDER BY captured_at',
    [caseId],
  );
  return rows.map(rowToImage);
}

// ── Agent Verdicts ──────────────────────────────────────────────────

/** Save agent verdicts for a case. */
export function saveAgentVerdicts(caseId: string, verdicts: AgentVerdict[]): void {
  const db = getDatabase();
  // Clear existing verdicts for this case first
  db.runSync('DELETE FROM agent_verdicts WHERE case_id = ?', [caseId]);

  for (const v of verdicts) {
    db.runSync(
      `INSERT INTO agent_verdicts
         (case_id, agent_type, verdict, confidence, risk_level, explanation,
          override_applied, flags, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        v.agentType,
        v.verdict,
        v.confidence ?? null,
        v.riskLevel ?? null,
        v.explanation,
        v.overrideApplied ? 1 : 0,
        JSON.stringify(v.flags ?? []),
        v.timestamp,
      ],
    );
  }
}

/** Get all agent verdicts for a case. */
export function getAgentVerdicts(caseId: string): AgentVerdict[] {
  const db = getDatabase();
  const rows = db.getAllSync<VerdictRow>(
    'SELECT * FROM agent_verdicts WHERE case_id = ? ORDER BY id',
    [caseId],
  );
  return rows.map(rowToVerdict);
}

// ── Drafts ──────────────────────────────────────────────────────────

/** Get the most recent draft case for a worker. */
export function getDraft(workerId: string): CaseRecord | null {
  const db = getDatabase();
  const row = db.getFirstSync<CaseRow>(
    "SELECT * FROM cases WHERE worker_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 1",
    [workerId],
  );
  if (!row) return null;
  return rowToCase(row);
}

/** Delete a draft case and its associated images/verdicts. */
export function deleteDraft(caseId: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM agent_verdicts WHERE case_id = ?', [caseId]);
  db.runSync('DELETE FROM case_images WHERE case_id = ?', [caseId]);
  db.runSync('DELETE FROM cases WHERE id = ?', [caseId]);
}

