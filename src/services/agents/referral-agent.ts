import { AgentVerdict, ReferralRecommendation, RiskLevel } from '@/models/types';

/**
 * Synthesizes final recommendation.
 * CANNOT override Safety Agent's mandatory-review flag.
 */
export function runReferralAgent(
  triageVerdict: AgentVerdict, 
  protocolVerdict: AgentVerdict, 
  safetyVerdict: AgentVerdict
): { verdict: AgentVerdict; recommendation: ReferralRecommendation } {
  const getRisk = (v: AgentVerdict): RiskLevel => v.riskLevel || 'low';
  const allRisks: RiskLevel[] = [getRisk(triageVerdict), getRisk(protocolVerdict), getRisk(safetyVerdict)];
  const finalRiskLevel = allRisks.includes('high') ? 'high' : (allRisks.includes('moderate') ? 'moderate' : 'low');
  
  let recommendation: ReferralRecommendation = 'self_care';

  if (safetyVerdict.overrideApplied) {
    recommendation = finalRiskLevel === 'high' ? 'urgent_referral' : 'clinic_visit';
  } else {
    if (finalRiskLevel === 'high') recommendation = 'urgent_referral';
    else if (finalRiskLevel === 'moderate') recommendation = 'clinic_visit';
    else recommendation = 'self_care';
  }

  return {
    verdict: {
      agentType: 'referral',
      verdict: recommendation,
      riskLevel: finalRiskLevel,
      explanation: `Final recommendation: ${recommendation}`,
      flags: [],
      overrideApplied: safetyVerdict.overrideApplied,
      timestamp: new Date().toISOString()
    },
    recommendation
  };
}
