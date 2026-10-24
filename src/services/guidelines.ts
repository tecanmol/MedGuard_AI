import {
  CareGuideline,
  GuidelineCitation,
  PatientMetadata,
  PredictedCondition,
  RiskLevel,
} from '@/models/types';

export const GUIDELINE_VERSION = 'offline-bundle-v2.0';

const DISCLAIMER =
  'This is guidance for community health workers, not a medical diagnosis. ' +
  'Clinical judgment must guide all treatment decisions. When in doubt, refer.';

// ── Citation sources ──────────────────────────────────────────────────

const WHO_WOUND = (section: string): GuidelineCitation => ({
  text: 'WHO Wound Care Guidelines',
  source: 'WHO',
  section,
});
const ICMR_CANCER = (section: string): GuidelineCitation => ({
  text: 'ICMR National Cancer Screening Guidelines',
  source: 'ICMR',
  section,
});
const WHO_SKIN = (section: string): GuidelineCitation => ({
  text: 'WHO Skin Disease Management Guidelines',
  source: 'WHO',
  section,
});
const IAD_DERM = (section: string): GuidelineCitation => ({
  text: 'Indian Association of Dermatologists (IADVL) Guidelines',
  source: 'IADVL',
  section,
});
const RSSDI = (section: string): GuidelineCitation => ({
  text: 'RSSDI (Research Society for Study of Diabetes in India) Guidelines',
  source: 'RSSDI',
  section,
});

// ── Guideline database ────────────────────────────────────────────────
// Keys follow the pattern: {condition}_{riskLevel}
// All 6 model classes × 3 risk levels = 18 possible keys.

type Bundle = { steps: string[]; citations: GuidelineCitation[] };

const GUIDELINE_DB: Record<string, Bundle> = {

  // ── carcinoma (high/moderate/low) ────────────────────────────────────────────

  carcinoma_high: {
    steps: [
      'DO NOT attempt to remove, scratch, or biopsy the lesion.',
      'Photograph the lesion clearly with a ruler for scale if available.',
      'Cover with a clean, dry, non-adherent dressing if the lesion is open or bleeding.',
      'Advise the patient to avoid sun exposure and keep the area dry.',
      'Arrange URGENT dermatology or oncology referral within 2 weeks (sooner if rapidly changing or bleeding).',
      'Document the ABCDE features: Asymmetry, Border irregularity, Colour variation, Diameter > 6mm, Evolving.',
      'Notify the supervising PHC doctor immediately.',
    ],
    citations: [
      ICMR_CANCER('Chapter 4 — Skin Cancer Early Detection'),
      WHO_SKIN('Section 6.1 — Suspected Malignant Lesions'),
    ],
  },

  carcinoma_moderate: {
    steps: [
      'Record detailed description: size, colour, borders, texture, duration, and any recent change.',
      'DO NOT apply topical treatments or attempt removal.',
      'Schedule a dermatology review within 2–4 weeks.',
      'Educate patient on warning signs requiring immediate re-visit: rapid growth, bleeding, pain, or satellite lesions.',
      'Arrange follow-up call or home visit in 1 week to monitor for change.',
    ],
    citations: [
      ICMR_CANCER('Chapter 4 — Skin Cancer Early Detection'),
    ],
  },

  carcinoma_low: {
    steps: [
      'Document the lesion with photographs.',
      'Advise clinic review within 4 weeks with a trained medical officer.',
      'Educate patient on self-monitoring: watch for growth, colour change, bleeding, or new lesions.',
    ],
    citations: [
      ICMR_CANCER('Chapter 3 — Community-Level Screening'),
    ],
  },

  // ── keratosis (high/moderate/low) ──────────────────────────────────────────

  keratosis_high: {
    steps: [
      'Assess for signs of malignant transformation (rapid growth, bleeding, ulceration) — if present, refer urgently.',
      'Document the size, number, and location of keratotic lesions.',
      'Refer to secondary hospital for definitive diagnosis (Actinic Keratosis vs Seborrheic Keratosis).',
      'Advise strict sun protection (hats, long sleeves, shade).',
    ],
    citations: [
      IAD_DERM('Section 8 — Pre-malignant Skin Lesions'),
    ],
  },

  keratosis_moderate: {
    steps: [
      'Document lesion characteristics.',
      'Advise patient to monitor for changes in size, shape, or color.',
      'Recommend sun protection and daily emollient use if itchy.',
      'Schedule review within 4 weeks.',
    ],
    citations: [
      IAD_DERM('Section 8 — Pre-malignant Skin Lesions'),
    ],
  },

  keratosis_low: {
    steps: [
      'Reassure patient — likely benign seborrheic keratosis if stable.',
      'Advise routine skin hygiene.',
      'Return visit if any changes are noticed.',
    ],
    citations: [],
  },

  // ── eczema (high/moderate/low) ───────────────────────────────────────────────────────

  eczema_high: {
    steps: [
      'Assess extent of involvement — widespread erythroderma or involvement of face/neck warrants referral.',
      'Apply a fragrance-free emollient immediately and liberally.',
      'Prescribe or recommend a mild to moderate topical corticosteroid per local formulary.',
      'Identify and eliminate triggers: soaps, detergents, specific foods.',
      'Refer to PHC doctor for consideration of oral antihistamines or antibiotics if secondary infection is suspected.',
      'Review in 1 week.',
    ],
    citations: [
      IAD_DERM('Section 3 — Atopic Dermatitis Management'),
      WHO_SKIN('Section 4.4 — Eczema and Dermatitis'),
    ],
  },

  eczema_moderate: {
    steps: [
      'Apply emollient regularly (3–4 times a day); use as soap substitute.',
      'Use prescribed mild topical corticosteroid on inflamed areas for 5–7 days.',
      'Avoid identified triggers and synthetic fabrics.',
      'Advise cool baths with non-soap cleanser.',
      'Review in 2 weeks; escalate if not improving.',
    ],
    citations: [
      IAD_DERM('Section 3 — Atopic Dermatitis Management'),
    ],
  },

  eczema_low: {
    steps: [
      'Apply regular emollient at least twice daily.',
      'Advise on trigger avoidance (soaps, fragrances, heat).',
      'Self-care education: lukewarm baths, pat dry, immediate moisturiser application.',
      'Review if condition worsens.',
    ],
    citations: [
      WHO_SKIN('Section 4.4 — Eczema and Dermatitis'),
    ],
  },

  // ── rosacea (high/moderate/low) ─────────────────────────────────────────────────────

  rosacea_high: {
    steps: [
      'Assess for ocular involvement (eye redness, grittiness) — if present, urgent ophthalmology referral.',
      'Advise strict avoidance of triggers (sun, hot drinks, spicy food, alcohol).',
      'Refer to PHC medical officer for initiation of topical metronidazole or oral antibiotics.',
      'Educate on gentle skin care routine — no harsh scrubs or astringents.',
      'Review in 2 weeks.',
    ],
    citations: [
      IAD_DERM('Section 6 — Rosacea Management Protocols'),
    ],
  },

  rosacea_moderate: {
    steps: [
      'Recommend trigger avoidance (sun, heat, spicy foods).',
      'Advise daily use of broad-spectrum sunscreen.',
      'Use mild, non-irritating cleansers and moisturizers.',
      'Refer to PHC doctor for topical therapy if persistent redness/papules.',
      'Review in 4 weeks.',
    ],
    citations: [
      IAD_DERM('Section 6 — Rosacea Management Protocols'),
    ],
  },

  rosacea_low: {
    steps: [
      'Advise gentle skin care and trigger avoidance.',
      'Recommend daily sun protection.',
      'Clinic review in 6–8 weeks or sooner if worsening.',
    ],
    citations: [],
  },

  // ── acne (high/moderate/low) ─────────────────────────────────────────────────

  acne_high: {
    steps: [
      'Assess for severe nodulocystic acne or significant scarring risk.',
      'Refer to PHC medical officer or dermatologist for oral therapy (antibiotics/isotretinoin).',
      'Educate on not picking or squeezing lesions to prevent scarring.',
      'Review mental health impact — severe acne can cause psychological distress.',
    ],
    citations: [
      IAD_DERM('Section 5 — Acne Management'),
    ],
  },

  acne_moderate: {
    steps: [
      'Recommend topical treatments (benzoyl peroxide or topical retinoids) per formulary.',
      'Advise gentle cleansing twice daily — avoid aggressive scrubbing.',
      'Educate that treatment takes 6–8 weeks to show significant improvement.',
      'Review in 4 weeks.',
    ],
    citations: [
      IAD_DERM('Section 5 — Acne Management'),
    ],
  },

  acne_low: {
    steps: [
      'Advise twice daily gentle facial cleansing.',
      'Use non-comedogenic moisturizers and sunscreens.',
      'Over-the-counter topical salicylic acid or benzoyl peroxide if available.',
    ],
    citations: [],
  },

  // ── milia (high/moderate/low) ───────────────────────────────────────────────

  milia_high: {
    steps: [
      'Milia are benign. High risk usually implies secondary infection from picking.',
      'If infected, clean area and consider topical antibiotic.',
      'Refer to PHC doctor if unsure of diagnosis.',
    ],
    citations: [],
  },

  milia_moderate: {
    steps: [
      'Reassure patient that milia are harmless keratin cysts.',
      'Advise against self-extraction to prevent scarring.',
      'Refer to dermatologist if cosmetic removal is desired.',
    ],
    citations: [],
  },

  milia_low: {
    steps: [
      'Reassure patient — completely benign.',
      'No treatment necessary. Often resolve spontaneously in infants, may persist in adults.',
      'Advise gentle skin care.',
    ],
    citations: [],
  },
};

// ── Public API ────────────────────────────────────────────────────────

/**
 * Returns the appropriate offline clinical guideline for a given condition
 * and risk level. Covers all 6 model classes × 3 risk levels.
 *
 * Falls back to a generic 3-step safety-net if the key is not found.
 * When isOnline is true, a note is appended that enhanced RAG guidance
 * may be available after sync.
 */
export function getGuideline(
  condition: PredictedCondition,
  riskLevel: RiskLevel,
  _metadata: PatientMetadata,
  isOnline: boolean,
): CareGuideline {
  const key = `${condition}_${riskLevel}`;
  let bundle = GUIDELINE_DB[key];
  let source: CareGuideline['source'] = 'cached_bundle';

  if (!bundle) {
    // Generic safety-net fallback
    bundle = {
      steps: [
        'Recommend in-person evaluation at the nearest health facility.',
        'Monitor patient condition closely.',
        'Seek emergency care immediately if condition worsens.',
      ],
      citations: [],
    };
    source = 'generic_fallback';
    console.warn(`[Guidelines] No bundle for key "${key}" — using generic fallback`);
  }

  const steps = [...bundle.steps];
  if (isOnline) {
    steps.push(
      'Note: Enhanced RAG-based guidance may be available — sync when connected.',
    );
  }

  return {
    source,
    steps,
    citations: bundle.citations,
    disclaimer: DISCLAIMER,
    guidelineVersion: GUIDELINE_VERSION,
    timestamp: new Date().toISOString(),
  };
}
