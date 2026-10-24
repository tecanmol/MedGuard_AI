/**
 * MedGuard AI — AI Agent Reasoning Timeline (Stitch Design - Strict)
 * Preserves logic: getAgentVerdicts, caseId, AgentVerdict[]
 */
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import type { AgentVerdict } from '@/models/types';
import { getAgentVerdicts } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AgentsScreen() {
  const theme = useTheme();
  const { language, isOnline } = useApp();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const router = useRouter();

  const [verdicts, setVerdicts] = useState<AgentVerdict[]>([]);

  useEffect(() => {
    try {
      if (caseId) {
        const data = getAgentVerdicts(caseId as string);
        setVerdicts(data);
      }
    } catch (e) {
      console.warn("Failed to load verdicts", e);
    }
  }, [caseId]);

  // Determine overall case risk based on the highest risk verdict, or default to routine
  const hasHighRisk = verdicts.some(v => v.riskLevel === 'high');
  const hasModerate = verdicts.some(v => v.riskLevel === 'moderate');
  const overallRisk = hasHighRisk ? 'high' : (hasModerate ? 'moderate' : 'low');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'transparent' }]}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Agent Audit Trail</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Context Summary */}
        <View style={styles.sectionContainer}>
          <View style={[styles.contextCard, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.contextHeader}>
              <View style={styles.contextHeaderLeft}>
                <View style={[styles.contextIconBox, { backgroundColor: theme.surfaceContainerLow }]}>
                  <MaterialIcons name="folder-shared" size={24} color={StitchColors.primary} />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.contextTitle, { color: theme.text }]}>Case Context</Text>
                    <View style={[styles.idPill, { backgroundColor: theme.surfaceContainerLow }]}>
                      <Text style={[styles.idPillText, { color: theme.textSecondary }]}>#MG-{caseId?.substring(0, 4)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.contextSub, { color: theme.textSecondary }]}>Clinical Triage Validation Set</Text>
                </View>
              </View>
            </View>

            {/* Verdict Banner Inside Card */}
            <View style={[styles.verdictBanner, { backgroundColor: hasHighRisk ? StitchColors.errorContainer : StitchColors.tertiaryContainer }]}>
              <View style={[styles.verdictIconBox, { backgroundColor: hasHighRisk ? StitchColors.error : StitchColors.tertiaryFixed }]}>
                <MaterialIcons name={hasHighRisk ? "warning" : "gpp-good"} size={20} color={hasHighRisk ? StitchColors.onError : StitchColors.onTertiaryFixedVariant} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.verdictTopRow}>
                  <Text style={[styles.verdictLabel, { color: hasHighRisk ? StitchColors.error : StitchColors.tertiary }]}>OVERALL VERDICT</Text>
                  <View style={[styles.consensusBadge, { backgroundColor: 'rgba(255,255,255,0.8)' }]}>
                    <Text style={[styles.consensusText, { color: hasHighRisk ? StitchColors.error : StitchColors.tertiary }]}>100% Consensus</Text>
                  </View>
                </View>
                <Text style={[styles.verdictTitle, { color: hasHighRisk ? StitchColors.error : StitchColors.onTertiaryContainer }]}>
                  {overallRisk.toUpperCase()} RISK
                </Text>
                <Text style={[styles.verdictDesc, { color: hasHighRisk ? 'rgba(186, 26, 26, 0.9)' : 'rgba(58, 118, 106, 0.9)' }]}>
                  {hasHighRisk 
                    ? 'Transfer mandatory to Sub-District Hospital (SDH) within 24 hours.' 
                    : 'Standard community care protocols applicable.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <Text style={[styles.timelineTitle, { color: theme.text }]}>Deterministic Decision Pipeline</Text>
            <Text style={[styles.timelineStatus, { color: StitchColors.primary }]}>{verdicts.length} OF {verdicts.length} COMPLETE</Text>
          </View>

          <View style={styles.timelineRoot}>
            {/* Continuous Spine */}
            <View style={[styles.timelineSpine, { backgroundColor: theme.surfaceContainerHighest }]} />

            {verdicts.map((verdict, idx) => {
              const isVision = verdict.agentType.toLowerCase().includes('vision');
              const isRules = verdict.agentType.toLowerCase().includes('triage') || verdict.agentType.toLowerCase().includes('rules');
              const iconName = isVision ? 'visibility' : isRules ? 'rule' : 'psychology';
              const agentName = verdict.agentType.replace('_', ' ').toUpperCase() + ' AGENT';
              const isRisk = verdict.riskLevel === 'high';

              return (
                <View key={idx} style={styles.nodeContainer}>
                  {/* Node Marker */}
                  <View style={[styles.nodeMarker, { backgroundColor: isRisk ? StitchColors.error : StitchColors.primaryContainer }]}>
                    <MaterialIcons 
                      name={isRisk ? "priority-high" : "check"} 
                      size={16} 
                      color={isRisk ? StitchColors.onError : StitchColors.primary} 
                    />
                  </View>

                  <View style={[styles.nodeCard, { backgroundColor: theme.surfaceContainerLowest }]}>
                    <View style={styles.nodeCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Text style={[styles.stageLabel, { color: StitchColors.primary }]}>STAGE {idx + 1}</Text>
                        <Text style={[styles.agentTitle, { color: theme.text }]} numberOfLines={1}>{agentName}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: isRisk ? 'rgba(186, 26, 26, 0.1)' : 'rgba(0, 95, 80, 0.1)' }]}>
                        <Text style={[styles.statusPillText, { color: isRisk ? StitchColors.error : StitchColors.primary }]}>
                          {isRisk ? 'FLAGGED' : 'VERIFIED'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.verdictExplanation, { color: theme.textSecondary }]}>
                      {verdict.explanation}
                    </Text>

                    {verdict.overrideApplied && (
                      <View style={[styles.overrideBanner, { backgroundColor: StitchColors.error }]}>
                        <MaterialIcons name="security" size={14} color={StitchColors.onError} />
                        <Text style={[styles.overrideText, { color: StitchColors.onError }]}>Safety Override Applied</Text>
                      </View>
                    )}

                    {verdict.flags && verdict.flags.length > 0 && (
                      <View style={styles.flagsList}>
                        {verdict.flags.map((flag, i) => (
                          <View key={i} style={[styles.flagItem, { backgroundColor: 'rgba(186, 26, 26, 0.05)' }]}>
                            <MaterialIcons name="lens" size={6} color={StitchColors.error} />
                            <Text style={[styles.flagText, { color: StitchColors.error }]}>{flag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },

  sectionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  contextCard: { padding: Spacing.md, borderRadius: BorderRadius.xl, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  contextHeader: { marginBottom: Spacing.md },
  contextHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  contextIconBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  contextTitle: { ...Fonts.headlineSm },
  idPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  idPillText: { ...Fonts.labelSm, fontFamily: Fonts.mono },
  contextSub: { ...Fonts.bodySm, marginTop: 2 },

  verdictBanner: { borderRadius: BorderRadius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  verdictIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  verdictTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  verdictLabel: { ...Fonts.labelSm, fontWeight: '700', letterSpacing: 0.5 },
  consensusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  consensusText: { ...Fonts.labelSm, fontWeight: '700' },
  verdictTitle: { ...Fonts.headlineSm, fontWeight: '700' },
  verdictDesc: { ...Fonts.bodySm, marginTop: 2, lineHeight: 18 },

  timelineSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  timelineTitle: { ...Fonts.headlineSm },
  timelineStatus: { ...Fonts.labelSm, fontWeight: '700' },

  timelineRoot: { position: 'relative', paddingLeft: 24, flexDirection: 'column', gap: Spacing.md },
  timelineSpine: { position: 'absolute', left: 10, top: 12, bottom: 24, width: 2 },

  nodeContainer: { position: 'relative', marginBottom: Spacing.md },
  nodeMarker: { position: 'absolute', left: -24, top: 16, transform: [{ translateX: -12 }], width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.1, shadowRadius:1, elevation:1 },
  
  nodeCard: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  nodeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  stageLabel: { ...Fonts.labelSm, fontWeight: '700' },
  agentTitle: { ...Fonts.labelLg, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPillText: { ...Fonts.labelSm, fontWeight: '700' },

  verdictExplanation: { ...Fonts.bodyMd, lineHeight: 20 },

  overrideBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: Spacing.sm },
  overrideText: { ...Fonts.labelSm, fontWeight: '700' },

  flagsList: { marginTop: Spacing.sm, gap: 4 },
  flagItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: BorderRadius.md },
  flagText: { ...Fonts.bodySm, fontWeight: '500' },
});

