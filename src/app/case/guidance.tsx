import { MaterialIcons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaseRecord } from '@/models/types';
import { getCase } from '@/services/case-repository';

export default function GuidanceScreen() {
  const theme = useTheme();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [citationsExpanded, setCitationsExpanded] = useState(false);

  useEffect(() => {
    try {
      if (caseId) {
        const record = getCase(caseId);
        setCaseRecord(record);
      }
    } catch (e) {
      console.warn("Failed to load case", e);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <MaterialIcons name="hourglass-top" size={36} color="#aaa" />
        <Text style={{ fontSize: 14, color: '#888', marginTop: 12 }}>Loading care plan…</Text>
      </View>
    );
  }

  if (!caseRecord || !caseRecord.careGuideline) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <MaterialIcons name="hourglass-empty" size={48} color="#aaa" />
        <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center', color: '#444' }}>
          Care Plan Not Available
        </Text>
        <Text style={{ fontSize: 14, marginTop: 8, textAlign: 'center', color: '#888', lineHeight: 20 }}>
          The care plan for this case has not been generated yet or is unavailable. Please re-run the analysis.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#005F50' }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { careGuideline, patientMetadata } = caseRecord;

  const patientString = patientMetadata 
    ? `${patientMetadata.patientName} (${patientMetadata.age}U)` 
    : 'Unknown Patient';

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: `${theme.surface}D9` }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: 'transparent' }]} 
              onPress={() => router.back()}
              accessibilityLabel="Go Back"
            >
              <MaterialIcons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Clinical Guidance</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, { backgroundColor: theme.surfaceContainer }]}>
              <View style={[styles.statusDot, { backgroundColor: StitchColors.tertiaryContainer }]} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>OFFLINE</Text>
            </View>
            <View style={[styles.avatar, { backgroundColor: StitchColors.primary }]}>
              <MaterialIcons name="person" size={18} color={StitchColors.onPrimary} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Patient Context Banner */}
          <View style={[styles.cardLowest, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.surfaceContainer }]}>
                  <MaterialIcons name="badge" size={20} color={StitchColors.primary} />
                </View>
                <View style={styles.patientInfo}>
                  <Text style={[styles.patientName, { color: theme.text }]} numberOfLines={1}>{patientString}</Text>
                  <Text style={[styles.caseNumber, { color: theme.textSecondary }]}>CASE #{caseRecord.id?.substring(0,8).toUpperCase()}</Text>
                </View>
              </View>
              <View style={[
                styles.riskBadge,
                { backgroundColor: 
                  caseRecord.triageResult?.finalRiskLevel === 'high' ? StitchColors.errorContainer :
                  caseRecord.triageResult?.finalRiskLevel === 'moderate' ? StitchColors.tertiaryContainer :
                  StitchColors.tertiaryContainer
                }
              ]}>
                <MaterialIcons 
                  name="warning" 
                  size={14} 
                  color={
                    caseRecord.triageResult?.finalRiskLevel === 'high' ? StitchColors.onErrorContainer :
                    StitchColors.onTertiaryContainer
                  } 
                />
                <Text style={[styles.riskText, { color: 
                  caseRecord.triageResult?.finalRiskLevel === 'high' ? StitchColors.onErrorContainer :
                  StitchColors.onTertiaryContainer
                }]}>
                  {caseRecord.triageResult?.finalRiskLevel?.toUpperCase() || 'UNKNOWN'} RISK
                </Text>
              </View>
            </View>
            <View style={[styles.diagnosisContainer, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={styles.diagnosisLeft}>
                <MaterialIcons name="local-hospital" size={16} color={theme.textSecondary} />
                <Text style={[styles.diagnosisText, { color: theme.text }]} numberOfLines={1}>{caseRecord.triageResult?.predictedCondition || 'Unknown Condition'}</Text>
              </View>
            </View>
          </View>

          {/* Clinical Disclaimer Banner */}
          <View style={[styles.cardHigh, { backgroundColor: theme.surfaceContainerHigh }]}>
            <View style={[styles.iconContainerSquare, { backgroundColor: theme.surfaceContainer }]}>
              <MaterialIcons name="verified-user" size={22} color={StitchColors.primary} />
            </View>
            <View style={styles.disclaimerContent}>
              <Text style={[styles.disclaimerTitle, { color: theme.text }]}>CLINICAL DECISION SUPPORT ONLY</Text>
              <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
                {careGuideline.disclaimer || 'Non-prescriptive frontline guidance. Corroboration with Medical Officer required.'}
              </Text>
            </View>
          </View>

          {/* Guideline Source & Version Card */}
          <View style={[styles.cardLowest, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <MaterialIcons name="menu-book" size={20} color={StitchColors.secondary} />
                <Text style={[styles.guidelineTitle, { color: theme.text }]} numberOfLines={1}>Guideline Authority & Cache</Text>
              </View>
              <View style={[styles.verifiedBadge, { backgroundColor: StitchColors.secondaryContainer }]}>
                <MaterialIcons name="offline-pin" size={12} color={StitchColors.onSecondaryContainer} />
                <Text style={[styles.verifiedText, { color: StitchColors.onSecondaryContainer }]}>Verified Cache</Text>
              </View>
            </View>
            <View style={styles.guidelineDetails}>
              <Text style={[styles.guidelineSource, { color: theme.text }]}>
                {careGuideline.source.replace(/_/g, ' ').toUpperCase()} v{careGuideline.guidelineVersion}
              </Text>
              <View style={styles.tagRow}>
                <View style={[styles.tag, { backgroundColor: theme.surfaceContainer }]}>
                  <Text style={[styles.tagText, { color: theme.textSecondary }]}>OFFLINE-CACHE</Text>
                </View>
              </View>
            </View>

            {careGuideline.citations.length > 0 && (
              <>
                <TouchableOpacity 
                  style={styles.citationToggle} 
                  onPress={() => setCitationsExpanded(!citationsExpanded)}
                >
                  <Text style={[styles.citationToggleText, { color: StitchColors.primary }]}>
                    View Full Guideline Citations & References ({careGuideline.citations.length})
                  </Text>
                  <MaterialIcons name={citationsExpanded ? "expand-less" : "expand-more"} size={20} color={StitchColors.primary} />
                </TouchableOpacity>

                {citationsExpanded && (
                  <View style={[styles.citationContent, { backgroundColor: theme.surfaceContainerLow }]}>
                    {careGuideline.citations.map((cit, idx) => (
                      <View key={`cit-${idx}`} style={styles.citationItem}>
                        <Text style={[styles.citationSource, { color: theme.text }]}>{idx + 1}. {cit.source}</Text>
                        <Text style={[styles.citationSection, { color: theme.textSecondary }]}>{cit.section || cit.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Section Heading */}
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingLeft}>
              <MaterialIcons name="checklist" size={20} color={StitchColors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Actionable Care Steps</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{careGuideline.steps.length} Critical Actions</Text>
          </View>

          {/* Steps */}
          {careGuideline.steps.map((step, idx) => (
            <View key={`step-${idx}`} style={[styles.stepCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={styles.stepTop}>
                <View style={[styles.stepNumberContainer, { backgroundColor: StitchColors.primaryContainer }]}>
                  <Text style={[styles.stepNumber, { color: StitchColors.onPrimaryContainer }]}>{idx + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  <View style={styles.stepHeader}>
                    <Text style={[styles.stepTitle, { color: theme.text }]}>Care Step {idx + 1}</Text>
                    <MaterialIcons name="healing" size={18} color={StitchColors.primary} />
                  </View>
                  <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Offline State Diagnostic Badge */}
          <View style={[styles.offlineBadge, { backgroundColor: theme.surfaceContainer }]}>
            <View style={[styles.offlineIcon, { backgroundColor: StitchColors.secondaryContainer }]}>
              <MaterialIcons name="cell-wifi" size={18} color={StitchColors.onSecondaryContainer} />
            </View>
            <View style={styles.offlineContent}>
              <Text style={[styles.offlineTitle, { color: theme.text }]}>Offline Protocol Active</Text>
              <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
                Guidance rendered directly from local hardware-backed clinical knowledge base without internet uplink.
              </Text>
            </View>
          </View>

          {/* Spacer */}
          <View style={{ height: 112 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: `${theme.surface}F2` }]}>
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: StitchColors.primary }]}
          onPress={() => router.push(`/case/referral?caseId=${caseRecord.id}` as any)}
        >
          <Text style={[styles.primaryButtonText, { color: StitchColors.onPrimary }]}>Proceed to Referral Details</Text>
          <MaterialIcons name="arrow-forward" size={20} color={StitchColors.onPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.secondaryButton, { backgroundColor: theme.surfaceContainerHighest }]}
          onPress={() => router.push(`/case/agents?caseId=${caseRecord.id}` as any)}
        >
          <MaterialIcons name="psychology" size={18} color={StitchColors.primary} />
          <Text style={[styles.secondaryButtonText, { color: StitchColors.primary }]}>View AI Reasoning</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 48,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    ...{},
  },
  headerInner: {
    height: 64,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerTitle: {
    ...Fonts.headlineSm,
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 9999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Fonts.labelSm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 112,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  cardLowest: {
    borderRadius: 12,
    padding: Spacing.md,
    ...{},
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...Fonts.headlineSm,
  },
  caseNumber: {
    ...Fonts.labelSm,
    textTransform: 'uppercase',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  riskText: {
    ...Fonts.labelSm,
  },
  diagnosisContainer: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagnosisLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  diagnosisText: {
    ...Fonts.bodySm,
    fontWeight: '600',
  },
  cardHigh: {
    borderRadius: 12,
    padding: Spacing.md,
    ...{},
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconContainerSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerContent: {
    flex: 1,
    gap: 2,
  },
  disclaimerTitle: {
    ...Fonts.labelMd,
    textTransform: 'uppercase',
  },
  disclaimerText: {
    ...Fonts.bodySm,
    lineHeight: 18,
  },
  guidelineTitle: {
    ...Fonts.labelMd,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  verifiedText: {
    ...Fonts.labelSm,
  },
  guidelineDetails: {
    gap: 4,
  },
  guidelineSource: {
    ...Fonts.labelLg,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    ...Fonts.labelSm,
  },
  integrityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  integrityText: {
    ...Fonts.bodySm,
  },
  citationToggle: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  citationToggleText: {
    ...Fonts.labelMd,
  },
  citationContent: {
    marginTop: Spacing.xs,
    padding: Spacing.md,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  citationItem: {
    gap: 2,
  },
  citationSource: {
    ...Fonts.labelSm,
  },
  citationSection: {
    ...Fonts.bodySm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...Fonts.headlineSm,
  },
  sectionSubtitle: {
    ...Fonts.labelSm,
  },
  stepCard: {
    borderRadius: 12,
    padding: Spacing.md,
    ...{},
    gap: Spacing.xs,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...Fonts.labelMd,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  stepTitle: {
    ...Fonts.labelLg,
  },
  stepText: {
    ...Fonts.bodySm,
    lineHeight: 18,
  },
  offlineBadge: {
    borderRadius: 12,
    padding: Spacing.md,
    ...{},
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  offlineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineContent: {
    flex: 1,
  },
  offlineTitle: {
    ...Fonts.labelMd,
  },
  offlineText: {
    ...Fonts.bodySm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
    gap: Spacing.xs,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    ...{},
  },
  primaryButtonText: {
    ...Fonts.labelLg,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    ...Fonts.labelMd,
  },
});

