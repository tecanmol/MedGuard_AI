import { CaseImage, ClassificationResult, ConditionCategory, PatientMetadata } from '@/models/types';
import { classifyImages } from '../ai-inference';
import { checkImageQuality } from '../image-quality';
import { OodSafetyAgent } from './ood-safety-agent';
import { RagProtocolAgent } from './rag-protocol-agent';

/** Lightweight connectivity probe — same technique as use-connectivity.ts */
async function checkIsOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

export class AgentOrchestrator {
  private safetyAgent: OodSafetyAgent;
  private ragAgent: RagProtocolAgent;

  constructor() {
    this.safetyAgent = new OodSafetyAgent();
    this.ragAgent = new RagProtocolAgent();
  }

  /**
   * Main workflow:
   *   Image Quality → TFLite → OOD Safety Gate → Dynamic RAG Protocol
   *
   * The RAG agent automatically switches between:
   *   - Gemini 3.5 Flash (online, personalized)
   *   - Static offline bundle (offline, instant)
   */
  async processCase(
    images: CaseImage[],
    metadata: PatientMetadata,
    conditionHint: ConditionCategory,
  ) {
    // 1. Edge AI Image Quality Check
    const qualityResult = await checkImageQuality(images[0].uri);
    if (!qualityResult.passed) {
      return { status: 'rejected_quality', reason: qualityResult.retakeGuidance };
    }

    // 2. Check network connectivity for routing and inference fallback
    const isOnline = await checkIsOnline();

    // 3. TFLite Native Inference (and optional Gemini fallback if online)
    const classification: ClassificationResult = await classifyImages(images, conditionHint, isOnline);

    // 4. OOD Safety Gate
    const safetyVerdict = this.safetyAgent.evaluateSafety(classification, metadata);
    if (safetyVerdict.action === 'refer_immediately') {
      return {
        status: 'referred',
        reason: safetyVerdict.reasoning,
        classification,
        heatmap: classification.heatmapData,
      };
    }

    // 5. Dynamic RAG Protocol Agent
    //    → Gemini 3.5 Flash when online, static bundle when offline
    const protocolResult = await this.ragAgent.generateCarePlan(
      classification,
      metadata,
      isOnline,
    );

    return {
      status: 'success',
      classification,
      heatmap: classification.heatmapData,
      carePlan: protocolResult.plan,
      citations: protocolResult.citations,
      ragSource: protocolResult.source,         // 'gemini_rag' | 'offline_bundle' | 'generic_fallback'
      clinicalNote: protocolResult.clinicalNote, // Gemini's summary note for supervising doctor
      guideline: protocolResult.guideline,
    };
  }
}
