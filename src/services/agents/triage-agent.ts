import { AgentVerdict, ClassificationResult, PatientMetadata, RiskLevel } from '@/models/types';
import { CONFIDENCE_THRESHOLD, POLICY } from '../ai-inference';

const RISK_HIERARCHY: RiskLevel[] = ['low', 'moderate', 'high'];

function getHigherRisk(current: RiskLevel | undefined, target: RiskLevel): RiskLevel {
  const cIndex = current ? RISK_HIERARCHY.indexOf(current) : 0;
  const tIndex = RISK_HIERARCHY.indexOf(target);
  return RISK_HIERARCHY[Math.max(cIndex, tIndex)];
}

function escalateRisk(current: RiskLevel | undefined): RiskLevel {
  const cIndex = current ? RISK_HIERARCHY.indexOf(current) : 0;
  return RISK_HIERARCHY[Math.min(cIndex + 1, RISK_HIERARCHY.length - 1)];
}

/**
 * Fuses image classification with patient metadata using deterministic rules.
 *
 * Respects the calibrated policy decision from medguard_policy.json:
 *   - modelDecision === 'malignant' locks risk to 'high' immediately
 *   - isModelUncertain is treated the same as low confidence
 */
export function runTriageAgent(
  classification: ClassificationResult,
  metadata: PatientMetadata
): AgentVerdict {
  let riskLevel = classification.riskLevel;
  const factors: string[] = [`Initial model risk: ${riskLevel}`];

  // Policy lock: calibrated p[malignant_suspect] >= 0.25 → always high
  if (classification.modelDecision === 'malignant') {
    riskLevel = 'high';
    factors.push(
      `Policy-flagged malignant (calibrated p[malignant_suspect] >= ${POLICY.malignantThreshold})`
    );
  }

  // Uncertain: model policy flag OR confidence below threshold
  const isUncertain =
    classification.isModelUncertain === true ||
    classification.confidence < CONFIDENCE_THRESHOLD;

  if (metadata.diabetesStatus === 'yes' && metadata.conditionCategory === 'wound') {
    riskLevel = getHigherRisk(riskLevel, 'moderate');
    factors.push('Escalated to at least moderate due to diabetic wound');
  }

  if (metadata.durationDays && metadata.durationDays > 7 && riskLevel === 'low') {
    riskLevel = escalateRisk(riskLevel);
    factors.push('Escalated due to condition duration > 7 days');
  }

  if (metadata.painLevel && metadata.painLevel >= 7) {
    riskLevel = escalateRisk(riskLevel);
    factors.push('Escalated due to high pain level');
  }

  if (isUncertain) {
    factors.push('Uncertain: model confidence below threshold — recommend in-person review');
  }

  const optionalFieldsCount = [
    metadata.durationDays,
    metadata.painLevel,
    metadata.medicalHistory,
  ].filter(f => f !== undefined).length;

  const flags: string[] = [];
  if (optionalFieldsCount < 3) {
    flags.push('low-confidence, metadata incomplete');
  }
  if (classification.predictedCondition === 'other_condition') {
    flags.push('other_condition: outside training distribution — requires clinical assessment');
  }

  return {
    agentType: 'triage',
    verdict: 'complete',
    riskLevel,
    explanation: factors.join('; '),
    flags,
    overrideApplied: false,
    timestamp: new Date().toISOString(),
  };
}
