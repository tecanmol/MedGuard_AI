/**
 * MedGuard AI — RAG Protocol Agent
 *
 * Two-tier care plan generation:
 *   1. PRIMARY  → Live Gemini 3.5 Flash API call with patient context (always attempted)
 *   2. FALLBACK → Static offline guideline bundle (returned only if Gemini fails)
 *
 * Gemini is ALWAYS attempted first when an API key is present.
 * The offline bundle is the silent fallback if the call fails for any reason.
 */

import { CareGuideline, ClassificationResult, GuidelineCitation, PatientMetadata } from '@/models/types';
import { GoogleGenAI } from '@google/genai';
import { getGuideline, GUIDELINE_VERSION } from '../guidelines';

// ── Gemini client ─────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-3.5-flash'; // gemini-3.5-flash as required

function getGeminiClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('[RAG] EXPO_PUBLIC_GEMINI_API_KEY not set — falling back to offline bundle');
    return null;
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// ── Prompt builder ────────────────────────────────────────────────────

function buildClinicalPrompt(
  classification: ClassificationResult,
  metadata: PatientMetadata,
  offlineSteps: string[],
): string {
  const condition = classification.predictedCondition;
  const risk = classification.riskLevel;
  const confidence = (classification.confidence * 100).toFixed(1);
  const decision = classification.modelDecision ?? 'argmax';

  const patientContext = [
    `Age: ${metadata.age}`,
    metadata.sex ? `Sex: ${metadata.sex}` : null,
    metadata.diabetesStatus ? `Diabetes: ${metadata.diabetesStatus}` : null,
    metadata.durationDays ? `Duration: ${metadata.durationDays} days` : null,
    metadata.bloodGlucose ? `Blood glucose: ${metadata.bloodGlucose} mg/dL` : null,
    metadata.medicalHistory ? `History: ${metadata.medicalHistory}` : null,
    metadata.comorbidityNotes ? `Comorbidities: ${metadata.comorbidityNotes}` : null,
    metadata.allergies ? `Allergies: ${metadata.allergies}` : null,
    `Condition category: ${metadata.conditionCategory}`,
  ].filter(Boolean).join('\n');

  return `You are a clinical decision support assistant helping a community health worker in a rural Indian healthcare setting.

## AI Diagnosis
- **Predicted condition:** ${condition}
- **Risk level:** ${risk}
- **Model confidence:** ${confidence}% (policy decision: ${decision})
${decision === 'malignant' ? '- ⚠️ MALIGNANT FLAG: calibrated probability exceeded the 0.25 threshold' : ''}
${decision === 'uncertain' ? '- ⚠️ UNCERTAIN: model confidence is low — treat with clinical caution' : ''}

## Patient Context
${patientContext}

## Existing Offline Care Plan (WHO/ICMR guidelines)
${offlineSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Your Task
Generate an **enhanced, personalized care plan** for this specific patient that:
1. Addresses the diagnosed condition (${condition}) at ${risk} risk
2. Accounts for the patient's specific comorbidities, age, and context above
3. Adapts or adds to the offline steps where clinically relevant
4. Uses plain, simple language appropriate for a community health worker (not a doctor)
5. Flags any dangerous interactions or contraindications (e.g., corticosteroids in diabetics)
6. Recommends referral urgency clearly if needed

## Output Format (strict JSON)
Respond ONLY with valid JSON in this exact structure:
{
  "steps": ["step 1", "step 2", "step 3", ...],
  "citations": [
    { "text": "Guideline name or study", "source": "WHO/ICMR/IADVL/etc", "section": "optional section" }
  ],
  "clinicalNote": "One sentence of critical clinical context for the supervising doctor (if any)"
}

Do NOT include markdown, explanations, or any text outside the JSON object.`;
}

// ── Gemini RAG call ───────────────────────────────────────────────────

async function fetchGeminiCarePlan(
  classification: ClassificationResult,
  metadata: PatientMetadata,
  offlineGuideline: CareGuideline,
): Promise<{ steps: string[]; citations: GuidelineCitation[]; clinicalNote?: string } | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const prompt = buildClinicalPrompt(classification, metadata, offlineGuideline.steps);

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ?? '';

    // Strip any accidental markdown fences
    const jsonText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Gemini response missing steps array');
    }

    return {
      steps: parsed.steps as string[],
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      clinicalNote: typeof parsed.clinicalNote === 'string' ? parsed.clinicalNote : undefined,
    };
  } catch (err) {
    console.warn('[RAG] Gemini 3.5 Flash call failed:', err);
    return null;
  }
}

// ── Agent class ───────────────────────────────────────────────────────

export interface CarePlanResult {
  plan: string[];
  citations: GuidelineCitation[];
  guideline: CareGuideline;
  source: 'gemini_rag' | 'offline_bundle' | 'generic_fallback';
  clinicalNote?: string;
}

/**
 * RAG Protocol Agent
 *
 * Always attempts Gemini 3.5 Flash first.
 * Falls back to the offline guideline bundle ONLY if the Gemini call fails.
 * The isOnline flag no longer gates the Gemini call — the actual API call is the gate.
 */
export class RagProtocolAgent {
  async generateCarePlan(
    classification: ClassificationResult,
    metadata: PatientMetadata,
    _isOnline: boolean = false, // kept for API compatibility, no longer gates Gemini
  ): Promise<CarePlanResult> {
    // Step 1 — always get the offline bundle as guaranteed fallback
    const offlineGuideline = getGuideline(
      classification.predictedCondition,
      classification.riskLevel,
      metadata,
      true,
    );

    const offlineResult: CarePlanResult = {
      plan: offlineGuideline.steps,
      citations: offlineGuideline.citations,
      guideline: offlineGuideline,
      source: offlineGuideline.source === 'generic_fallback' ? 'generic_fallback' : 'offline_bundle',
    };

    // Step 2 — always attempt Gemini 3.5 Flash (no isOnline gate)
    console.log(`[RAG] Calling Gemini (${GEMINI_MODEL}) for personalized care plan…`);
    const geminiResult = await fetchGeminiCarePlan(classification, metadata, offlineGuideline);

    if (!geminiResult) {
      console.warn('[RAG] Gemini call failed — using offline bundle as fallback');
      return offlineResult;
    }

    // Step 3 — merge: Gemini steps + offline citations if Gemini returned none
    const mergedCitations: GuidelineCitation[] =
      geminiResult.citations.length > 0
        ? geminiResult.citations
        : offlineGuideline.citations;

    const enhancedGuideline: CareGuideline = {
      ...offlineGuideline,
      steps: geminiResult.steps,
      citations: mergedCitations,
      source: 'rag',
      guidelineVersion: `${GUIDELINE_VERSION}+${GEMINI_MODEL}`,
    };

    console.log(`[RAG] Gemini 3.5 Flash success — ${geminiResult.steps.length} personalised steps`);

    return {
      plan: geminiResult.steps,
      citations: mergedCitations,
      guideline: enhancedGuideline,
      source: 'gemini_rag',
      clinicalNote: geminiResult.clinicalNote,
    };
  }
}
