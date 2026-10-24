import { AgentVerdict, ClassificationResult, PatientMetadata } from '@/models/types';
import { POLICY } from '../ai-inference';

// ── Shared verdict shape for the class interface ──────────────────────

export interface OodSafetyVerdict {
  /**
   * pass           — no issues detected, continue normal pipeline
   * flag_review    — surface for human review, but do not halt
   * refer_immediately — malignant policy flag: halt and refer
   */
  action: 'pass' | 'flag_review' | 'refer_immediately';
  reasoning: string;
  flags: string[];
  requiresHumanReview: boolean;
}

// ── Class interface (used by AgentOrchestrator) ───────────────────────

/**
 * OOD Safety Agent — class interface consumed by AgentOrchestrator.
 *
 * Detects out-of-distribution inputs and enforces policy-mandated referrals.
 *
 * Policy note (medguard_policy.json):
 *   "other_condition means 'looks like something outside the targeted conditions',
 *    NOT 'harmless'."
 */
export class OodSafetyAgent {
  evaluateSafety(
    classification: ClassificationResult,
    _metadata: PatientMetadata
  ): OodSafetyVerdict {
    const pCal = classification.calibratedProbabilities ?? [];
    const flags: string[] = [];
    let requiresHumanReview = false;

    // ── Rule 1: Policy-flagged malignant → refer immediately ──────────
    if (classification.modelDecision === 'malignant') {
      flags.push(
        `Malignant flag: calibrated p[malignant_suspect] >= ${POLICY.malignantThreshold}`
      );
      return {
        action: 'refer_immediately',
        reasoning:
          `Model policy flagged malignant_suspect with calibrated probability ` +
          `above threshold (${POLICY.malignantThreshold}). Immediate clinical referral required.`,
        flags,
        requiresHumanReview: true,
      };
    }

    // ── Rule 2: other_condition is NOT harmless ───────────────────────
    if (classification.predictedCondition === 'other_condition') {
      flags.push(
        'other_condition: condition appears outside MedGuard training distribution'
      );
      requiresHumanReview = true;
    }

    // ── Rule 3: High-entropy distribution → likely OOD image ─────────
    if (pCal.length > 0) {
      const eps = 1e-10;
      const entropy = -pCal.reduce(
        (sum, p) => sum + Math.max(p, eps) * Math.log(Math.max(p, eps)),
        0
      );
      const maxEntropy = Math.log(POLICY.classes.length); // ln(6) ≈ 1.791
      const normalizedEntropy = entropy / maxEntropy;

      if (normalizedEntropy > 0.92) {
        flags.push(
          `High prediction entropy (${(normalizedEntropy * 100).toFixed(1)}% of max) — possible OOD input`
        );
        requiresHumanReview = true;
      }
    }

    // ── Rule 4: Policy uncertain flag ────────────────────────────────
    if (classification.isModelUncertain) {
      flags.push(
        `Model uncertain: max calibrated probability below ${POLICY.uncertainThreshold}`
      );
      requiresHumanReview = true;
    }

    const action: OodSafetyVerdict['action'] = requiresHumanReview
      ? 'flag_review'
      : 'pass';

    const reasoning =
      flags.length > 0
        ? `OOD/safety flags: ${flags.join('; ')}`
        : 'OOD safety check passed.';

    return { action, reasoning, flags, requiresHumanReview };
  }
}

// ── Functional interface (used by supervisor pipeline) ────────────────

/**
 * Functional wrapper around OodSafetyAgent for use in the supervisor
 * agent pipeline, returning a standard AgentVerdict.
 */
export function runOodSafetyAgent(
  classification: ClassificationResult
): AgentVerdict {
  const agent = new OodSafetyAgent();
  // Minimal placeholder metadata — OOD check is image-only
  const verdict = agent.evaluateSafety(classification, {
    age: 0,
    conditionCategory: 'other',
  });

  return {
    agentType: 'safety',
    verdict: verdict.action,
    explanation: verdict.reasoning,
    flags: verdict.flags,
    overrideApplied: verdict.requiresHumanReview,
    timestamp: new Date().toISOString(),
  };
}
