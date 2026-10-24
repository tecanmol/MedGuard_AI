/**
 * MedGuard AI — Triage Result Screen (Stitch Design - Strict)
 * Preserves logic: getCase, getImages, triageResult extraction, isHighRisk mapping, Haptics.
 */
import { BorderRadius, Fonts, RiskColors, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { CaseImage, CaseRecord } from '@/models/types';
import { getCase, getImages, saveImages } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResultScreen() {
  const theme = useTheme();
  const { language } = useApp();
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();

  // Render-time diagnostic — will appear in console on every render
  console.log('[Result] RENDER — caseId=', caseId);

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCase() {
      try {
        if (!caseId) return;
        const record = getCase(caseId as string);
        if (record) {
          let caseImages = getImages(caseId as string);

          // 1. Fallback from classificationResult.imageUri
          if (caseImages.length === 0 && record.classificationResult?.imageUri) {
            const fallbackImg: CaseImage = {
              id: `rec_cls_${Date.now()}`,
              caseId: caseId as string,
              uri: record.classificationResult.imageUri,
              capturedAt: new Date().toISOString(),
            };
            saveImages([fallbackImg]);
            caseImages = [fallbackImg];
          }

          // 2. Recovery from device disk storage if cascade delete happened
          if (caseImages.length === 0 && FileSystem.documentDirectory) {
            try {
              const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
              const matching = files.find((f: string) => f.includes(caseId as string));
              if (matching) {
                const recoveredImg: CaseImage = {
                  id: `rec_disk_${Date.now()}`,
                  caseId: caseId as string,
                  uri: FileSystem.documentDirectory + matching,
                  capturedAt: new Date().toISOString(),
                };
                saveImages([recoveredImg]);
                caseImages = [recoveredImg];
              }
            } catch (fsErr) {
              console.warn('[Result] Disk image recovery check failed:', fsErr);
            }
          }

          record.images = caseImages;
          if (isMounted) {
            setCaseRecord(record);
          }

          console.log(`[Result] Case loaded: images=${record?.images?.length ?? 0}, heatmap=${JSON.stringify(record?.classificationResult?.heatmapData?.flat().filter(v => v > 0).length)} non-zero cells`);

          if (record.triageResult) {
            const isHighRisk = record.triageResult.finalRiskLevel === 'high';
            if (isHighRisk) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load case', e);
      }
    }

    loadCase();
    return () => {
      isMounted = false;
    };
  }, [caseId]);

  const images = caseRecord?.images ?? [];
  const triageResult = caseRecord?.triageResult;
  const patientMetadata = caseRecord?.patientMetadata;
  const isHighRisk = triageResult?.finalRiskLevel === 'high';
  const confidencePct = Math.round((triageResult?.conditionConfidence ?? 0) * 100);
  const hasHeatmapData = caseRecord?.classificationResult?.heatmapData?.some(row => row.some(val => val > 0)) ?? false;

  if (!caseRecord || !triageResult || !patientMetadata) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={[styles.backBtn, { backgroundColor: 'transparent' }]}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Diagnostic Report</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badgePill, { backgroundColor: StitchColors.primary }]}>
            <Text style={[styles.badgeText, { color: StitchColors.onPrimary }]}>ID: MG-{caseId?.substring(0,4)}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Severity Banner */}
        <View style={styles.sectionContainer}>
          <View style={[styles.severityBanner, { backgroundColor: isHighRisk ? StitchColors.errorContainer : RiskColors.lowBg, borderWidth: isHighRisk ? 0 : 1, borderColor: RiskColors.lowBorder }]}>
            <View style={styles.severityTop}>
              <View style={[styles.severityIconBox, { backgroundColor: isHighRisk ? 'rgba(186, 26, 26, 0.15)' : RiskColors.lowBorder }]}>
                <MaterialIcons name={isHighRisk ? "gpp-maybe" : "gpp-good"} size={32} color={isHighRisk ? StitchColors.error : RiskColors.low} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.severityTitle, { color: isHighRisk ? StitchColors.error : RiskColors.low }]}>
                  {isHighRisk ? 'HIGH RISK' : 'ROUTINE CARE'}
                </Text>
                <Text style={[styles.severitySub, { color: isHighRisk ? 'rgba(186, 26, 26, 0.95)' : RiskColors.low }]}>
                  {isHighRisk ? 'SPECIALIST ATTENTION REQUIRED' : 'STANDARD PROTOCOL'}
                </Text>
              </View>
            </View>
            <View style={[styles.severityDescBox, { backgroundColor: isHighRisk ? 'rgba(0,0,0,0.1)' : RiskColors.lowBorder }]}>
              <Text style={[styles.severityDesc, { color: isHighRisk ? 'rgba(186, 26, 26, 0.9)' : RiskColors.low }]}>
                {isHighRisk 
                  ? 'Urgent assessment warranted. Pathological progression marks potential systemic involvement if unmanaged within 24-48h.'
                  : 'Condition appears stable. Proceed with standard field cleaning protocols.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Image & AI Heatmap Overlay */}
        {(images.length > 0 || hasHeatmapData || !!caseRecord?.classificationResult?.imageUri) && (
          <View style={styles.sectionContainer}>
            <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest, padding: 0, overflow: 'hidden' }]}>
              <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#0F172A' }}>
                {(images[0]?.uri || caseRecord.classificationResult?.imageUri) ? (
                  <Image
                    source={{ uri: images[0]?.uri || caseRecord.classificationResult?.imageUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <MaterialIcons name="grid-on" size={54} color="rgba(255,255,255,0.2)" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontSize: 13, fontWeight: '600' }}>
                      Occlusion Sensitivity Analysis
                    </Text>
                  </View>
                )}

                {/* Heatmap & Matrix Grid Overlay — renders on top of Image */}
                {showHeatmap && hasHeatmapData && caseRecord.classificationResult?.heatmapData && (
                  <View style={[StyleSheet.absoluteFill, { borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.3)' }]}>
                    {caseRecord.classificationResult.heatmapData.map((row, rIdx) => (
                      <View key={`row-${rIdx}`} style={{ flex: 1, flexDirection: 'row' }}>
                        {row.map((val, cIdx) => (
                          <View
                            key={`cell-${rIdx}-${cIdx}`}
                            style={{
                              flex: 1,
                              borderWidth: 0.5,
                              borderColor: 'rgba(255, 255, 255, 0.22)',
                              backgroundColor: val > 0.02
                                ? `rgba(255, ${Math.round(255 * (1 - val))}, 0, ${0.22 + val * 0.45})`
                                : 'transparent',
                            }}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Heatmap Toggle */}
              {hasHeatmapData && (
                <View style={{ padding: Spacing.md, paddingBottom: showHeatmap ? Spacing.xs : Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="grid-on" size={18} color={theme.text} />
                    <Text style={{ ...Fonts.labelMd, color: theme.text }}>Occlusion Sensitivity Heatmap</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowHeatmap(!showHeatmap)}>
                    <MaterialIcons name={showHeatmap ? "toggle-on" : "toggle-off"} size={32} color={showHeatmap ? StitchColors.primary : theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Heatmap Saliency Legend */}
              {hasHeatmapData && showHeatmap && (
                <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ ...Fonts.labelSm, color: theme.textSecondary }}>Feature Sensitivity:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(255, 220, 0, 0.55)', borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.4)' }} />
                    <Text style={{ ...Fonts.labelSm, color: theme.textSecondary, fontSize: 11 }}>Low</Text>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(255, 120, 0, 0.65)', borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.4)' }} />
                    <Text style={{ ...Fonts.labelSm, color: theme.textSecondary, fontSize: 11 }}>Medium</Text>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(255, 0, 0, 0.75)', borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.4)' }} />
                    <Text style={{ ...Fonts.labelSm, color: theme.textSecondary, fontSize: 11 }}>High Impact</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Primary Diagnosis & Meter */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardHeaderLabel, { color: theme.textSecondary }]}>Primary Predicted Condition</Text>
              <View style={[styles.offlinePill, { 
                backgroundColor: caseRecord.classificationResult?.source === 'tflite_gemini_ensemble' ? StitchColors.primaryContainer :
                                 caseRecord.classificationResult?.source === 'gemini_vision' ? StitchColors.tertiaryContainer :
                                 StitchColors.secondaryContainer 
              }]}>
                <Text style={[styles.offlinePillText, { 
                  color: caseRecord.classificationResult?.source === 'tflite_gemini_ensemble' ? StitchColors.onPrimaryContainer :
                         caseRecord.classificationResult?.source === 'gemini_vision' ? StitchColors.onTertiaryContainer :
                         StitchColors.onSecondaryContainer 
                }]}>
                  {caseRecord.classificationResult?.source === 'tflite_medv4' ? 'Edge AI (medv4)' : 
                   caseRecord.classificationResult?.source === 'tflite_gemini_ensemble' ? '⚡ Ensemble AI' :
                   caseRecord.classificationResult?.source === 'gemini_vision' ? '✦ Gemini Vision' : 'Clinical Protocol'}
                </Text>
              </View>
            </View>

            {/* Gemini second-opinion notice */}
            {(caseRecord.classificationResult?.source === 'tflite_gemini_ensemble' ||
              caseRecord.classificationResult?.source === 'gemini_vision') && (
              <View style={[styles.geminiNotice, { backgroundColor: StitchColors.primaryContainer }]}>
                <MaterialIcons name="auto-awesome" size={14} color={StitchColors.onPrimaryContainer} />
                <Text style={[styles.geminiNoticeText, { color: StitchColors.onPrimaryContainer }]}>
                  {caseRecord.classificationResult?.source === 'tflite_gemini_ensemble'
                    ? 'Gemini Vision was consulted as a second opinion. Result is an Edge + Cloud AI ensemble.'
                    : 'On-device model was unavailable. Result is from Gemini Vision analysis only.'}
                </Text>
              </View>
            )}

            {/* Uncertainty warning */}
            {caseRecord.classificationResult?.isModelUncertain && (
              <View style={[styles.geminiNotice, { backgroundColor: StitchColors.errorContainer }]}>
                <MaterialIcons name="warning-amber" size={14} color={StitchColors.onErrorContainer} />
                <Text style={[styles.geminiNoticeText, { color: StitchColors.onErrorContainer }]}>
                  Model confidence is below threshold. Clinical review by a Medical Officer is strongly advised before acting on this result.
                </Text>
              </View>
            )}
            
            <Text style={[styles.conditionTitle, { color: theme.text }]}>{triageResult.predictedCondition}</Text>
            {patientMetadata.conditionCategory && (
              <Text style={[styles.conditionSub, { color: theme.textSecondary }]}>Category: {patientMetadata.conditionCategory}</Text>
            )}

            <View style={[styles.meterBox, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={styles.meterHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons 
                    name={triageResult.isUncertain ? "warning" : "verified"} 
                    size={18} 
                    color={triageResult.isUncertain ? StitchColors.error : StitchColors.primary} 
                  />
                  <Text style={[styles.meterTitle, { color: theme.text }]}>Diagnostic Certainty</Text>
                </View>
                <Text style={[styles.meterValue, { 
                  color: triageResult.isUncertain ? StitchColors.error : StitchColors.primary 
                }]}>{confidencePct}% Confidence</Text>
              </View>

              <View style={[styles.meterTrack, { backgroundColor: theme.surfaceContainer }]}>
                <View style={[styles.meterFill, { 
                  backgroundColor: confidencePct < 50 ? StitchColors.error : 
                                   confidencePct < 70 ? '#E6A817' : StitchColors.primary, 
                  width: `${confidencePct}%` 
                }]} />
              </View>

              <View style={styles.meterFooter}>
                <Text style={[styles.meterTier, { color: theme.textSecondary }]}>
                  {triageResult.isUncertain ? '⚠ Low Confidence — Review Required' : 'AI Confidence Score'}
                </Text>
                <Text style={[styles.meterAligned, { color: StitchColors.tertiaryContainer }]}>
                  {caseRecord.classificationResult?.modelDecision === 'malignant' ? 'Malignant flag triggered' : 'AI + Clinical assessment'}
                </Text>
              </View>

              <View style={styles.consensusRow}>
                <MaterialIcons name="fact-check" size={14} color={theme.textSecondary} />
                <Text style={[styles.consensusText, { color: theme.textSecondary }]}>
                  {caseRecord.classificationResult?.source === 'tflite_medv4' ? 'On-Device AI + Clinical Protocol' : 
                   caseRecord.classificationResult?.source === 'tflite_gemini_ensemble' ? 'Edge AI + Gemini Vision Ensemble' :
                   caseRecord.classificationResult?.source === 'gemini_vision' ? 'Gemini Vision + Clinical Protocol' : 'Clinical Protocol Fallback'}
                </Text>
              </View>
            </View>
          </View>
        </View>


        {/* Evidence & Clinical Flags */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Evidence & Clinical Flags</Text>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.factorList}>
              {triageResult.metadataFactors?.map((factor, idx) => (
                <View key={idx} style={[styles.factorItem, { backgroundColor: theme.surfaceContainerLow }]}>
                  <MaterialIcons name="insights" size={16} color={StitchColors.primary} />
                  <Text style={[styles.factorText, { color: theme.text }]}>{factor}</Text>
                </View>
              ))}
              {(!triageResult.metadataFactors || triageResult.metadataFactors.length === 0) && (
                <View style={[styles.factorItem, { backgroundColor: theme.surfaceContainerLow }]}>
                  <Text style={[styles.factorText, { color: theme.textSecondary }]}>No explicit factors recorded.</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Clinical Care Plan */}
        {caseRecord && (
          <View style={styles.sectionContainer}>
            {/* Section heading with icon */}
            <View style={styles.careSectionHeader}>
              <MaterialIcons name="medical-services" size={20} color={theme.text} />
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0, marginLeft: 0 }]}>Clinical Care Plan</Text>
            </View>

            {/* Source pill */}
            {caseRecord.careGuideline && (
              <View style={[
                styles.careSourcePill,
                {
                  backgroundColor:
                    caseRecord.careGuideline.source === 'rag' ? StitchColors.primaryContainer :
                    caseRecord.careGuideline.source === 'cached_bundle' ? StitchColors.secondaryContainer :
                    StitchColors.errorContainer,
                },
              ]}>
                <Text style={[
                  styles.careSourcePillText,
                  {
                    color:
                      caseRecord.careGuideline.source === 'rag' ? StitchColors.onPrimaryContainer :
                      caseRecord.careGuideline.source === 'cached_bundle' ? StitchColors.onSecondaryContainer :
                      StitchColors.onErrorContainer,
                  },
                ]}>
                  {caseRecord.careGuideline.source === 'rag' ? '⚡ Gemini RAG' :
                   caseRecord.careGuideline.source === 'cached_bundle' ? '📋 Offline Bundle' :
                   '⚠ Generic Fallback'}
                </Text>
              </View>
            )}

            {/* Steps list or empty state */}
            {(!caseRecord.careGuideline || !caseRecord.careGuideline.steps || caseRecord.careGuideline.steps.length === 0) ? (
              <Text style={[styles.careEmptyNote, { color: theme.textSecondary }]}>
                Care plan not available for this case.
              </Text>
            ) : (
              <View style={styles.careStepList}>
                {caseRecord.careGuideline.steps.map((step, idx) => (
                  <View key={idx} style={[styles.careStepCard, { backgroundColor: theme.surfaceContainerLowest }]}>
                    <View style={[styles.careStepBadge, { backgroundColor: StitchColors.primaryContainer }]}>
                      <Text style={[styles.careStepBadgeText, { color: StitchColors.onPrimaryContainer }]}>{idx + 1}</Text>
                    </View>
                    <Text style={[styles.careStepText, { color: theme.text }]}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Disclaimer banner */}
            {caseRecord.careGuideline?.disclaimer && (
              <View style={[styles.careDisclaimerRow, { backgroundColor: theme.surfaceContainerLow }]}>
                <MaterialIcons name="info-outline" size={14} color={theme.textSecondary} style={{ marginTop: 1 }} />
                <Text style={[styles.careDisclaimerText, { color: theme.textSecondary }]}>
                  {caseRecord.careGuideline.disclaimer}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surfaceContainerLowest }]}>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.outlineAction, { borderColor: StitchColors.primary }]}
            onPress={() => router.push(`/case/agents?caseId=${caseId}` as any)}
          >
            <MaterialIcons name="timeline" size={20} color={StitchColors.primary} />
            <Text style={[styles.outlineActionText, { color: StitchColors.primary }]}>Trace AI Logic</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryAction, { backgroundColor: StitchColors.primary }]}
            onPress={() => router.push(`/case/guidance?caseId=${caseId}` as any)}
          >
            <MaterialIcons name="medical-services" size={20} color={StitchColors.onPrimary} />
            <Text style={[styles.primaryActionText, { color: StitchColors.onPrimary }]}>Action Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl + 100 },
  sectionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },
  headerRight: { paddingRight: Spacing.xs },
  badgePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  badgeText: { ...Fonts.labelSm, fontWeight: '700' },

  // Severity Banner
  severityBanner: { padding: Spacing.md, borderRadius: BorderRadius.xl, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  severityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  severityIconBox: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  severityTitle: { ...Fonts.headlineXl, fontWeight: '700', letterSpacing: -1, lineHeight: 34 },
  severitySub: { ...Fonts.labelLg, fontWeight: '600' },
  severityDescBox: { padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: 4 },
  severityDesc: { ...Fonts.bodySm, lineHeight: 18 },

  // Card
  card: { borderRadius: BorderRadius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardHeaderLabel: { ...Fonts.labelSm, textTransform: 'uppercase', letterSpacing: 0.5 },
  offlinePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  offlinePillText: { ...Fonts.labelSm, fontWeight: '600' },
  
  conditionTitle: { ...Fonts.headlineMd, fontWeight: '700', marginBottom: 4 },
  conditionSub: { ...Fonts.bodySm, marginBottom: Spacing.md },

  // Meter Box
  meterBox: { padding: Spacing.md, borderRadius: BorderRadius.md },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  meterTitle: { ...Fonts.labelMd, fontWeight: '600' },
  meterValue: { ...Fonts.headlineSm, fontWeight: '700' },
  
  meterTrack: { height: 12, borderRadius: 6, width: '100%', padding: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  
  meterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  meterTier: { ...Fonts.labelSm },
  meterAligned: { ...Fonts.labelSm, fontWeight: '600' },

  consensusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  consensusText: { ...Fonts.bodySm },

  geminiNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  geminiNoticeText: { ...Fonts.bodySm, flex: 1, lineHeight: 18 },

  sectionTitle: { ...Fonts.headlineSm, marginBottom: Spacing.sm, marginLeft: 4 },
  factorList: { gap: Spacing.sm },
  factorItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.sm, borderRadius: BorderRadius.md },
  factorText: { ...Fonts.bodyMd, flex: 1, lineHeight: 20 },

  // Step Styles
  stepCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, flexDirection: 'row', gap: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  stepTop: { alignItems: 'center' },
  stepNumberContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { ...Fonts.headlineSm, fontWeight: '700' },
  stepContent: { flex: 1, justifyContent: 'center' },
  stepText: { ...Fonts.bodyMd, lineHeight: 22 },

  // Bottom Actions
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', zIndex: 100 },
  actionsGrid: { flexDirection: 'row', gap: Spacing.md },
  outlineAction: { flex: 1, height: 52, borderRadius: BorderRadius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlineActionText: { ...Fonts.labelLg, fontWeight: '600' },
  primaryAction: { flex: 1, height: 52, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4, elevation:2 },
  primaryActionText: { ...Fonts.labelLg, fontWeight: '700' },

  // Clinical Care Plan
  careSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  careSourcePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full, marginBottom: Spacing.md },
  careSourcePillText: { ...Fonts.labelSm, fontWeight: '700' },
  careStepList: { gap: Spacing.sm },
  careStepCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  careStepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  careStepBadgeText: { ...Fonts.labelMd, fontWeight: '700' },
  careStepText: { ...Fonts.bodyMd, flex: 1, lineHeight: 22 },
  careEmptyNote: { ...Fonts.bodySm, fontStyle: 'italic', marginTop: Spacing.xs, marginBottom: Spacing.sm },
  careDisclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  careDisclaimerText: { ...Fonts.bodySm, flex: 1, lineHeight: 18 },
});

