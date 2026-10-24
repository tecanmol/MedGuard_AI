/**
 * MedGuard AI — Core Type Definitions
 *
 * All shared data models used across services, screens, and storage.
 */

// ── Enums & Literal Unions ──────────────────────────────────────────

/** Risk tier produced by the Triage Agent's fused decision. */
export type RiskLevel = 'low' | 'moderate' | 'high';

/**
 * Condition category hint selected by the worker during intake.
 * These map DIRECTLY to the 6 EfficientNetV2B0 model output classes (medv4).
 * Alphabetical order matches Keras image_dataset_from_directory class assignment.
 */
export type ConditionCategory =
  | 'Acne / Acne Vulgaris'           // → acne          (Index 0)
  | 'Carcinoma / Skin Cancer'        // → carcinoma      (Index 1)
  | 'Eczema / Atopic Dermatitis'     // → eczema         (Index 2)
  | 'Keratosis'                      // → keratosis      (Index 3)
  | 'Milia'                          // → milia          (Index 4)
  | 'Rosacea'                        // → rosacea        (Index 5)
  | string;

/**
 * Multiclass predictions from the MedGuard v4 EfficientNetV2B0 TFLite model.
 *
 * Class order (alphabetical from Kaggle dataset folder names):
 *   0 acne       — Acne vulgaris, comedones, papules, pustules
 *   1 carcinoma  — Skin carcinoma, squamous/basal cell carcinoma
 *   2 eczema     — Atopic dermatitis, eczema, inflammatory patches
 *   3 keratosis  — Seborrheic or actinic keratosis
 *   4 milia      — Milia (keratin-filled cysts)
 *   5 rosacea    — Rosacea, facial redness, papulopustular rosacea
 *
 * Model accuracy: 95.60% on held-out test set.
 */
export type PredictedCondition =
  | 'acne'
  | 'carcinoma'
  | 'eczema'
  | 'keratosis'
  | 'milia'
  | 'rosacea'
  | string;

/**
 * Policy decision produced by the calibrated decision rule (medguard_policy.json).
 *   malignant — p_cal[malignant_suspect] >= 0.25 (regardless of argmax)
 *   uncertain — max(p_cal) < 0.50 (low confidence, see a doctor)
 *   argmax    — normal classification via argmax of calibrated probabilities
 */
export type ModelDecision = 'malignant' | 'uncertain' | 'argmax';

/** Sync status for any syncable item. */
export type SyncStatus = 'pending' | 'uploading' | 'failed' | 'done';

export type Sex = 'male' | 'female' | 'other' | string;

export type DiabetesStatus = 'yes' | 'no' | 'unknown' | string;

/** The four agents in the validation pipeline. */
export type AgentType = 'triage' | 'protocol' | 'safety' | 'referral';

/** Final referral recommendation from the Referral Agent. */
export type ReferralRecommendation =
  | 'self_care'
  | 'clinic_visit'
  | 'urgent_referral';

/** Case lifecycle status. */
export type CaseStatus = 'draft' | 'completed' | 'referred';

/** Data-sync network preference. */
export type SyncPreference = 'wifi_only' | 'any_network';

/** Source of a care guideline recommendation. */
export type GuidelineSource = 'rag' | 'cached_bundle' | 'generic_fallback';

// ── Patient Metadata ────────────────────────────────────────────────

export interface PatientMetadata {
  patientName?: string;
  patientId?: string;
  contactNumber?: string;
  /** Required — patient's age in years. */
  age: number;
  sex?: Sex;
  /** Duration of illness/wound in days. */
  durationDays?: number;
  diabetesStatus?: DiabetesStatus | string;
  bloodGlucose?: number;
  hasFever?: boolean;
  /** Temperature in °C, if known. */
  temperature?: number;
  /** Pain level on a 0–10 scale. */
  painLevel?: number;
  allergies?: string;
  medicalHistory?: string;
  comorbidityNotes?: string;
  /** Required — broad condition category hint. */
  conditionCategory: ConditionCategory;
}

// ── AI Classification ───────────────────────────────────────────────

export interface PredictionEntry {
  condition: PredictedCondition;
  probability: number;
}

export interface ClassificationResult {
  predictedCondition: PredictedCondition;
  /** 0–1 confidence score for the winning class under the policy rule. */
  confidence: number;
  /** Raw risk tier derived from the policy decision (before agent fusion). */
  riskLevel: RiskLevel;
  /** Grad-CAM style heatmap stored as a 2-D numeric array. */
  heatmapData?: number[][];
  /** All class probabilities (calibrated), sorted descending. */
  allPredictions: PredictionEntry[];
  /**
   * Calibrated probabilities after temperature scaling (T = 0.6693).
   * p_cal = softmax(log(p_model) / T)
   */
  calibratedProbabilities?: number[];
  /**
   * Policy decision from the medguard_policy.json decision rule.
   * Use this (not confidence alone) for safety-critical branching.
   */
  modelDecision?: ModelDecision;
  /**
   * True when max(p_cal) < 0.50 and the model is not flagging malignant.
   * Indicates the model is not confident — surface for clinical review.
   */
  isModelUncertain?: boolean;
  /**
   * The source of the inference result (e.g. 'tflite_medv4', 'tflite_gemini_ensemble', 'gemini_vision', 'clinical_hint').
   */
  source?: string;
  /** Direct URI of the primary analyzed image for visualization resilience. */
  imageUri?: string;
}

// ── Image Quality ───────────────────────────────────────────────────

export interface ImageQualityResult {
  passed: boolean;
  issues: string[];
  retakeGuidance?: string;
}

// ── Agent Verdicts ──────────────────────────────────────────────────

export interface AgentVerdict {
  agentType: AgentType;
  verdict: string;
  confidence?: number;
  riskLevel?: RiskLevel;
  explanation: string;
  /** True when the Safety Agent overrode a lower-risk verdict. */
  overrideApplied?: boolean;
  flags?: string[];
  timestamp: string;
}

// ── Triage Result (Fused Decision) ──────────────────────────────────

export interface TriageResult {
  /** Risk level after agent fusion — may differ from raw model output. */
  finalRiskLevel: RiskLevel;
  predictedCondition: PredictedCondition;
  conditionConfidence: number;
  riskExplanation: string;
  /** Human-readable factors that influenced the score. */
  metadataFactors: string[];
  /** True when confidence is below threshold OR model policy flagged uncertain. */
  isUncertain: boolean;
  /**
   * True when the Safety Agent forces mandatory human review.
   * This flag can NEVER be suppressed by another agent's verdict.
   */
  requiresHumanReview: boolean;
  agentVerdicts: AgentVerdict[];
}

// ── Care Guidelines ─────────────────────────────────────────────────

export interface GuidelineCitation {
  text: string;
  source: string;
  section?: string;
}

export interface CareGuideline {
  steps: string[];
  citations: GuidelineCitation[];
  source: GuidelineSource;
  disclaimer: string;
  guidelineVersion: string;
  timestamp: string;
}

// ── Referral & Facilities ───────────────────────────────────────────

export interface Facility {
  id: string;
  name: string;
  type: 'PHC' | 'CHC' | 'Hospital';
  /** Distance in km from the worker's registered location. */
  distance?: number;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
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

export interface ReferralInfo {
  recommendation: ReferralRecommendation;
  referralNote?: string;
  nearbyFacilities: Facility[];
}

// ── Case Images ─────────────────────────────────────────────────────

export interface CaseImage {
  id: string;
  caseId: string;
  /** Local file URI on device. */
  uri: string;
  capturedAt: string;
  qualityScore?: number;
}

// ── Full Case Record ────────────────────────────────────────────────

export interface CaseRecord {
  /** UUID generated locally on submit. */
  id: string;
  workerId: string;
  patientMetadata: PatientMetadata;
  images: CaseImage[];
  classificationResult?: ClassificationResult;
  triageResult?: TriageResult;
  careGuideline?: CareGuideline;
  referralInfo?: ReferralInfo;
  status: CaseStatus;
  syncStatus: SyncStatus;
  /** Worker opted out of syncing this case (privacy control). */
  syncOptOut: boolean;
  /** Post-hoc outcome logged by the worker. */
  outcome?: string;
  /** Version of the TFLite model used for this case. */
  modelVersion: string;
  /** Version of the guideline bundle used. */
  guidelineVersion: string;
  createdAt: string;
  updatedAt: string;
}

// ── Worker ──────────────────────────────────────────────────────────

export interface Worker {
  id: string;
  name: string;
  phone: string;
  phcAffiliation: string;
  /** Stored hash — never the raw PIN. */
  pinHash: string;
  language: string;
  registeredAt: string;
  syncStatus: SyncStatus;
}

// ── Sync Queue ──────────────────────────────────────────────────────

export interface SyncItem {
  id: string;
  type: 'case' | 'worker_registration' | 'facility_update' | 'image' | string;
  referenceId: string;
  status: SyncStatus;
  lastAttempt?: string;
  retryCount: number;
  errorMessage?: string;
  estimatedSizeBytes?: number;
}

// ── App Settings ────────────────────────────────────────────────────

export interface AppSettings {
  syncPreference: SyncPreference;
  language: string;
  modelVersion: string;
  guidelineVersion: string;
  storageUsedBytes: number;
}
