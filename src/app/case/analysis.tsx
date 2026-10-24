import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/constants/i18n';
import { getCase, getImages, saveCase, saveAgentVerdicts } from '@/services/case-repository';
import { AgentOrchestrator } from '@/services/agents/orchestrator';
import { MODEL_VERSION } from '@/services/ai-inference';
import { BrandColors, Spacing } from '@/constants/theme';
import type { CaseRecord } from '@/models/types';

const STAGES = [
  'analysis.preprocessing',
  'analysis.classifying',
  'analysis.cross_checking',
  'analysis.finalizing',
] as const;

export default function AnalysisScreen() {
  const theme = useTheme();
  const { language, isOnline } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId: string }>();
  const caseId = params.caseId ?? '';

  const [stageIndex, setStageIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const processCase = async () => {
      try {
        // Stage animation timer
        const timer = setInterval(() => {
          if (mounted.current) {
            setStageIndex((prev) => (prev < 3 ? prev + 1 : prev));
          }
        }, 1200);

        // 1. Load case data and images
        const caseData = getCase(caseId);
        if (!caseData) throw new Error('Case not found');
        const images = getImages(caseId);

        // 2. Initialize and run the new Multi-Agent Orchestrator
        // This implicitly handles: Image Quality -> Native TFLite -> Safety Gate -> RAG Generation
        const orchestrator = new AgentOrchestrator();
        const result = await orchestrator.processCase(
          images,
          caseData.patientMetadata,
          caseData.patientMetadata.conditionCategory
        );

        if (!mounted.current) return;
        clearInterval(timer);

        if (result.status === 'rejected_quality') {
           setErrorMsg(result.reason || 'Image quality rejected');
           return;
        }

        const isReferred = result.status === 'referred';
        
        const cls = result.classification;
        const riskLevel = cls?.riskLevel || 'low';
        const condition = cls?.predictedCondition || 'unknown';
        const confidence = cls?.confidence ?? 0;
        const modelDecision = cls?.modelDecision ?? 'argmax';
        const nowIso = new Date().toISOString();

        const triageResult: import('@/models/types').TriageResult = {
          finalRiskLevel: riskLevel,
          predictedCondition: condition,
          conditionConfidence: confidence,
          riskExplanation: isReferred 
            ? result.reason || 'Referral required by Safety Gate.'
            : result.clinicalNote || 'Standard triage generated.',
          metadataFactors: [],
          isUncertain: cls?.isModelUncertain || false,
          requiresHumanReview: isReferred,
          agentVerdicts: []
        };

        const guideline = result.guideline || {
           steps: isReferred ? [result.reason || 'Please seek immediate medical attention.'] : [],
           citations: result.citations || [],
           source: result.ragSource || 'generic_fallback',
           disclaimer: 'This is an AI generated guideline.',
           guidelineVersion: '2.0-RAG',
           timestamp: nowIso,
        };

        // 5. Build agent verdicts from orchestrator output for the Audit Trail screen
        const agentVerdicts: import('@/models/types').AgentVerdict[] = [
          {
            agentType: 'triage',
            verdict: condition,
            confidence,
            riskLevel,
            explanation:
              `TFLite medv4 model classified the image as "${condition}" with ` +
              `${(confidence * 100).toFixed(1)}% confidence. ` +
              `Policy decision: ${modelDecision}.` +
              (cls?.isModelUncertain ? ' ⚠ Model confidence is below threshold — treat with caution.' : ''),
            overrideApplied: false,
            flags: cls?.isModelUncertain ? ['low_confidence'] : [],
            timestamp: nowIso,
          },
          {
            agentType: 'safety',
            verdict: isReferred ? 'refer_immediately' : 'safe_to_manage',
            confidence: isReferred ? 1.0 : confidence,
            riskLevel: isReferred ? 'high' : riskLevel,
            explanation: isReferred
              ? `OOD Safety Gate triggered mandatory referral: ${result.reason || 'High-risk safety flag.'}`
              : `OOD Safety Gate passed. No immediate danger signs detected. ` +
                (modelDecision === 'malignant'
                  ? '⚠ Malignant probability flag raised — specialist review required.'
                  : 'Condition appears manageable at community level.'),
            overrideApplied: isReferred,
            flags: isReferred ? ['mandatory_referral'] : (modelDecision === 'malignant' ? ['malignant_flag'] : []),
            timestamp: nowIso,
          },
          {
            agentType: 'protocol',
            verdict: result.ragSource === 'gemini_rag' ? 'gemini_enhanced_plan' : 'offline_bundle_plan',
            confidence: 1.0,
            riskLevel,
            explanation:
              result.ragSource === 'gemini_rag'
                ? `Gemini RAG generated a personalised ${guideline.steps.length}-step care plan tailored to this patient's profile.` +
                  (result.clinicalNote ? ` Clinical note: ${result.clinicalNote}` : '')
                : `Offline guideline bundle applied (${guideline.source}). ` +
                  `${guideline.steps.length} evidence-based care steps loaded from local cache.`,
            overrideApplied: false,
            flags: [],
            timestamp: nowIso,
          },
          {
            agentType: 'referral',
            verdict: isReferred || riskLevel === 'high'
              ? 'urgent_referral'
              : riskLevel === 'moderate'
                ? 'clinic_visit'
                : 'self_care',
            confidence: 1.0,
            riskLevel,
            explanation: isReferred || riskLevel === 'high'
              ? 'Urgent referral to secondary/tertiary care facility recommended within 24 hours.'
              : riskLevel === 'moderate'
                ? 'Clinic visit advised within 1 week for clinical review.'
                : 'Self-care with standard community health protocols is appropriate.',
            overrideApplied: false,
            flags: riskLevel === 'high' ? ['urgent_transfer'] : [],
            timestamp: nowIso,
          },
        ];

        // 6. Save everything to the case record
        const updatedCase: CaseRecord = {
          ...caseData,
          images,
          classificationResult: result.classification!,
          triageResult,
          careGuideline: guideline,
          referralInfo: {
            recommendation:
              triageResult.finalRiskLevel === 'high' || isReferred
                ? 'urgent_referral'
                : triageResult.finalRiskLevel === 'moderate'
                  ? 'clinic_visit'
                  : 'self_care',
            nearbyFacilities: [],
          },
          status: 'completed',
          modelVersion: MODEL_VERSION,
          guidelineVersion: guideline.guidelineVersion,
        };

        saveCase(updatedCase);
        saveAgentVerdicts(caseId, agentVerdicts);

        // 6. Navigate to result
        router.replace(`/case/result?caseId=${caseId}`);
      } catch (error) {
        console.error('[Analysis] Error:', error);
        if (mounted.current) {
          setErrorMsg(
            t(language, 'disclaimer', 'recommend_evaluation'),
          );
        }
      }
    };

    processCase();

    return () => {
      mounted.current = false;
    };
  }, [caseId, isOnline, language, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={[styles.errorText, { color: theme.text }]}>
            {errorMsg}
          </Text>
          <View style={styles.errorButton}>
            <Text
              style={[styles.backLink, { color: BrandColors.primary }]}
              onPress={() => router.back()}
            >
              Back
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={[styles.stageText, { color: theme.text }]}>
            {STAGES[stageIndex].split('.')[1]}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((stageIndex + 1) / 4) * 100}%`,
                  backgroundColor: BrandColors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.estimateText, { color: theme.textSecondary }]}>
            Estimating: ~{Math.max(1, 5 - stageIndex)}s
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  processingContainer: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  stageText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  estimateText: {
    fontSize: 14,
    marginTop: Spacing.two,
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorContainer: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorButton: {
    marginTop: Spacing.three,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});
