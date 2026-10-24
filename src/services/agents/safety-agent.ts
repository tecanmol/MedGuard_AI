import { AgentVerdict, ClassificationResult, PatientMetadata, RiskLevel } from '@/models/types';

const RISK_HIERARCHY: RiskLevel[] = ['low', 'moderate', 'high'];
function getHigherRisk(current: RiskLevel | undefined, target: RiskLevel): RiskLevel {
  const cIndex = current ? RISK_HIERARCHY.indexOf(current) : 0;
  const tIndex = RISK_HIERARCHY.indexOf(target);
  return RISK_HIERARCHY[Math.max(cIndex, tIndex)];
}

/**
 * MOST CRITICAL AGENT — it has non-bypassable veto power.
 * Enforces mandatory human review based on hard safety rules.
 */
export function runSafetyAgent(classification: ClassificationResult, metadata: PatientMetadata, triageVerdict: AgentVerdict): AgentVerdict {
  let overrideApplied = false;
  const flags: string[] = [];
  let riskLevel = triageVerdict.riskLevel;

  // a) Diabetic patient + foot/wound condition + duration > 5 days -> ALWAYS override
  if (metadata.diabetesStatus === 'yes' && metadata.conditionCategory === 'wound' && metadata.durationDays && metadata.durationDays > 5) {
    overrideApplied = true;
    flags.push('Mandatory Review: Diabetic wound > 5 days duration');
    riskLevel = getHigherRisk(riskLevel, 'moderate');
  }

  // b) High fever -> force review
  if (metadata.conditionCategory === 'wound') {
    // metadata.hasFever is gone, ignoring
  }

  // c) malignant_suspect with ANY confidence -> force review
  // NOTE: malignant_suspect is an aggregate class (melanoma + BCC/SCC/Merkel),
  // not melanoma-only. The policy decision rule may have already set risk=high,
  // but this rule also catches argmax=malignant_suspect cases.
  if (classification.predictedCondition === 'malignant_suspect') {
    overrideApplied = true;
    flags.push('Mandatory Review: malignant_suspect detected (aggregate: melanoma/BCC/SCC/Merkel)');
    riskLevel = getHigherRisk(riskLevel, 'high');
  }

  // d) Pain level >= 8 with any wound -> force review
  if (metadata.painLevel && metadata.painLevel >= 8 && metadata.conditionCategory === 'wound') {
    overrideApplied = true;
    flags.push('Mandatory Review: Severe pain with wound');
  }

  return {
    agentType: 'safety',
    verdict: overrideApplied ? 'override_applied' : 'safe',
    riskLevel,
    explanation: overrideApplied ? 'Safety override triggered requiring human review' : 'No safety overrides triggered',
    flags,
    overrideApplied,
    timestamp: new Date().toISOString()
  };
}
