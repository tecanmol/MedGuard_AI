import { AgentVerdict, ClassificationResult, PatientMetadata } from '@/models/types';

/**
 * Rule-based offline check of clinical patterns.
 */
export function runProtocolAgent(classification: ClassificationResult, metadata: PatientMetadata, isOnline: boolean): AgentVerdict {
  const factors: string[] = [];
  
  if (classification.predictedCondition === 'diabetic_foot_ulcer' && metadata.diabetesStatus !== 'yes') {
    factors.push('Inconsistency: diabetic foot ulcer predicted but patient not marked as diabetic');
  }

  if (metadata.durationDays && metadata.durationDays > 14 && classification.riskLevel === 'low') {
    factors.push('Pattern: long duration (>14 days) contradicts low severity prediction');
  }

  if (classification.predictedCondition === 'normal_benign' && (metadata.hasFever || (metadata.painLevel && metadata.painLevel > 5))) {
    factors.push('Contradiction: normal_benign predicted but patient has systemic symptoms (fever/pain > 5)');
  }

  if (isOnline) {
    factors.push('RAG-refined justification pending sync');
  }

  return {
    agentType: 'protocol',
    verdict: factors.length ? 'inconsistent' : 'consistent',
    riskLevel: classification.riskLevel,
    explanation: factors.length ? factors.join('; ') : 'Patterns consistent',
    flags: factors,
    overrideApplied: false,
    timestamp: new Date().toISOString()
  };
}
