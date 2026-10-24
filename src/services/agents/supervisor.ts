import { ClassificationResult, PatientMetadata, TriageResult } from '@/models/types';
import { CONFIDENCE_THRESHOLD } from '../ai-inference';
import { runProtocolAgent } from './protocol-agent';
import { runReferralAgent } from './referral-agent';
import { runSafetyAgent } from './safety-agent';
import { runTriageAgent } from './triage-agent';

/**
 * Orchestrates the full triage agent pipeline.
 * SINGLE ENTRY POINT for the agent system.
 */
export function runAgentPipeline(
  classification: ClassificationResult, 
  metadata: PatientMetadata, 
  isOnline: boolean
): TriageResult {
  
  const triageVerdict = runTriageAgent(classification, metadata);
  const protocolVerdict = runProtocolAgent(classification, metadata, isOnline);
  const safetyVerdict = runSafetyAgent(classification, metadata, triageVerdict);
  const { verdict: referralVerdict, recommendation } = runReferralAgent(triageVerdict, protocolVerdict, safetyVerdict);

  // Uncertain if the policy flagged it OR if raw confidence is below threshold
  const isUncertain =
    classification.isModelUncertain === true ||
    classification.confidence < CONFIDENCE_THRESHOLD;

  const combinedExplanation = [
    `Triage: ${triageVerdict.explanation}`,
    `Protocol: ${protocolVerdict.explanation}`,
    `Safety: ${safetyVerdict.explanation}`
  ].join(' | ');

  const metadataFactors = [
    ...(triageVerdict.flags || []),
    ...(protocolVerdict.flags || []),
    ...(safetyVerdict.flags || [])
  ];

  return {
    finalRiskLevel: referralVerdict.riskLevel || 'low',
    predictedCondition: classification.predictedCondition,
    conditionConfidence: classification.confidence,
    riskExplanation: combinedExplanation,
    metadataFactors,
    isUncertain,
    requiresHumanReview: !!safetyVerdict.overrideApplied,
    agentVerdicts: [triageVerdict, protocolVerdict, safetyVerdict, referralVerdict]
  };
}
