/**
 * MedGuard AI — Dashboard Screen (Stitch Design - Strict)
 * Preserves logic: worker context, casesToday, highRiskCount, pendingSyncCount, loadData, onRefresh
 */
import { t } from '@/constants/i18n';
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import type { CaseRecord } from '@/models/types';
import { getCasesToday, getHighRiskPendingCount, getRecentCases, getWeeklyCaseCount } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

export default function DashboardScreen() {
  const { worker, isOnline, pendingSyncCount, language } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const [recentCases, setRecentCases] = useState<CaseRecord[]>([]);
  const [casesToday, setCasesToday] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const recent = getRecentCases(5);
      const today = worker ? getCasesToday(worker.id) : 0;
      const highRisk = worker ? getHighRiskPendingCount(worker.id) : 0;
      const weekly = worker ? getWeeklyCaseCount(worker.id) : 0;
      setRecentCases(recent || []);
      setCasesToday(today || 0);
      setHighRiskCount(highRisk || 0);
      setWeeklyCount(weekly || 0);
    } catch (e) {
      console.warn("Failed to load dashboard data", e);
    }
  }, [worker]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surfaceContainerLowest }]} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={StitchColors.primary} />}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.greetingSub, { color: theme.textSecondary }]}>{getGreeting()},</Text>
              <Text style={[styles.greetingMain, { color: theme.text }]} numberOfLines={1}>{worker?.name || 'User'}</Text>
            </View>
            <TouchableOpacity style={[styles.profileBtn, { backgroundColor: theme.surfaceContainer }]} onPress={() => router.push('/(tabs)/settings')}>
              <Text style={[styles.profileInitials, { color: StitchColors.primary }]}>
                {worker?.name ? worker.name.charAt(0) : 'W'}
              </Text>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? StitchColors.secondaryContainer : StitchColors.error }]} />
            </TouchableOpacity>
          </View>

          {/* Sync Status Banner */}
          {!isOnline && (
            <View style={[styles.syncBanner, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={styles.syncLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.pulseDot, { backgroundColor: StitchColors.tertiaryContainer }]} />
                  <Text style={[styles.syncTitle, { color: theme.text }]}>Offline Mode</Text>
                </View>
                <Text style={[styles.syncDesc, { color: theme.textSecondary }]}>{pendingSyncCount} cases stored safely on device</Text>
              </View>
              <TouchableOpacity style={[styles.syncBtn, { backgroundColor: theme.surfaceContainerLowest }]} onPress={() => router.push('/(tabs)/sync')}>
                <MaterialIcons name="sync" size={18} color={StitchColors.primary} />
                <Text style={[styles.syncBtnText, { color: StitchColors.primary }]}>{t(language, 'dashboard', 'pending_sync')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Start New Case CTA */}
          <TouchableOpacity 
            style={[styles.primaryCta, { backgroundColor: StitchColors.primary }]}
            onPress={() => router.push('/case/metadata')}
            activeOpacity={0.9}
          >
            <View style={styles.ctaLeft}>
              <View style={[styles.ctaIconBox, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <MaterialIcons name="medical-services" size={24} color={StitchColors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: StitchColors.onPrimary }]}>{t(language, 'dashboard', 'new_case').toUpperCase()}</Text>
                <Text style={[styles.ctaSub, { color: 'rgba(255,255,255,0.8)' }]}>Triage skin lesion, wound, or ulcer</Text>
              </View>
            </View>
            <View style={[styles.ctaArrowBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <MaterialIcons name="arrow-forward" size={22} color={StitchColors.onPrimary} />
            </View>
          </TouchableOpacity>

          {/* Urgent Alert (Dynamic based on highRiskCount) */}
          {highRiskCount > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: StitchColors.errorContainer }]}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertIconBox, { backgroundColor: StitchColors.error }]}>
                  <MaterialIcons name="priority-high" size={18} color={StitchColors.onError} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.alertTitle, { color: StitchColors.error }]}>{t(language, 'dashboard', 'high_risk_pending').toUpperCase()}</Text>
                    <Text style={[styles.alertCount, { color: StitchColors.error }]}>{highRiskCount} pending</Text>
                  </View>
                  <Text style={[styles.alertDesc, { color: StitchColors.onErrorContainer }]}>
                    You have high risk patients flagged for immediate medical officer review.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Screened Today */}
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={styles.metricHeader}>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{t(language, 'dashboard', 'cases_today')}</Text>
                <MaterialIcons name="fact-check" size={18} color={theme.textTertiary} />
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{casesToday}</Text>
              <View style={styles.metricTrend}>
                <MaterialIcons name="trending-up" size={14} color={StitchColors.primary} />
                <Text style={[styles.metricTrendText, { color: StitchColors.primary }]}>+2 from yesterday</Text>
              </View>
            </View>
            
            {/* Weekly Load */}
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={styles.metricHeader}>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Weekly Caseload</Text>
                <MaterialIcons name="bar-chart" size={18} color={theme.textTertiary} />
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{weeklyCount}</Text>
              <View style={{ height: 28, marginTop: 4 }}>
                <Svg width="100%" height="28" viewBox="0 0 100 28" preserveAspectRatio="none">
                  <Path d="M0 24 Q 15 15, 30 20 T 60 10 T 100 4" fill="none" stroke={StitchColors.tertiaryContainer} strokeWidth="3" strokeLinecap="round" />
                  <Path d="M0 24 Q 15 15, 30 20 T 60 10 T 100 4 L 100 28 L 0 28 Z" fill={StitchColors.tertiaryContainer} opacity="0.1" />
                </Svg>
              </View>
            </View>
          </View>

          {/* Recent Cases */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(language, 'dashboard', 'recent_cases')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')} style={[styles.viewAllBtn, { backgroundColor: theme.surfaceContainerLowest }]}>
              <Text style={[styles.viewAllText, { color: theme.text }]}>{t(language, 'dashboard', 'view_all')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.casesList}>
            {recentCases.map((item) => {
              const name = item.patientMetadata.patientName || `Patient #${item.id.substring(0, 4)}`;
              const condition = item.triageResult?.predictedCondition
                ? item.triageResult.predictedCondition
                : 'Pending Analysis';
              const risk = item.triageResult?.finalRiskLevel || 'low';
              const isHigh = risk === 'high';

              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.caseItem, { backgroundColor: theme.surfaceContainerLowest }]}
                  onPress={() => router.push(`/case/${item.id}` as any)}
                >
                  <View style={[styles.caseIconBox, { backgroundColor: isHigh ? StitchColors.errorContainer : theme.surfaceContainer }]}>
                    <Text style={[styles.caseInitials, { color: isHigh ? StitchColors.error : StitchColors.primary }]}>
                      {name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.caseInfo}>
                    <Text style={[styles.caseName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.caseSub, { color: theme.textSecondary }]} numberOfLines={1}>{condition}</Text>
                  </View>
                  <View style={styles.caseRight}>
                    {isHigh ? (
                      <View style={[styles.riskPill, { backgroundColor: StitchColors.error }]}>
                        <Text style={[styles.riskPillText, { color: StitchColors.onError }]}>High Risk</Text>
                      </View>
                      ) : (
                        <View style={[styles.riskPill, { backgroundColor: theme.surfaceContainerHighest }]}>
                          <Text style={[styles.riskPillText, { color: theme.textSecondary }]}>Routine</Text>
                        </View>
                      )}
                    <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {recentCases.length === 0 && (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={{ color: theme.textTertiary, ...Fonts.bodyMd }}>{t(language, 'dashboard', 'no_recent')}</Text>
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  greetingSub: { ...Fonts.labelLg, letterSpacing: 0.5 },
  greetingMain: { ...Fonts.headlineXl, letterSpacing: -0.5 },
  profileBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  profileInitials: { ...Fonts.headlineSm, fontWeight: '700' },
  onlineDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },

  // Sync Banner
  syncBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.sm, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  syncLeft: { flex: 1 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  syncTitle: { ...Fonts.labelMd, fontWeight: '700', textTransform: 'uppercase' },
  syncDesc: { ...Fonts.bodySm, marginTop: 2 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:1, elevation:1 },
  syncBtnText: { ...Fonts.labelMd },

  // Primary CTA
  primaryCta: { width: '100%', minHeight: 76, borderRadius: BorderRadius.xl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4, elevation:2, marginBottom: Spacing.lg },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  ctaIconBox: { width: 52, height: 52, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { ...Fonts.headlineMd, fontWeight: '700' },
  ctaSub: { ...Fonts.bodySm, marginTop: 2 },
  ctaArrowBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Alert Banner
  alertBanner: { borderRadius: BorderRadius.xl, padding: Spacing.md, marginBottom: Spacing.md },
  alertHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  alertIconBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { ...Fonts.labelSm, fontWeight: '700', letterSpacing: 0.5 },
  alertCount: { ...Fonts.labelSm, opacity: 0.8 },
  alertDesc: { ...Fonts.bodySm, marginTop: 4, lineHeight: 18 },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  metricCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.xl, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  metricLabel: { ...Fonts.labelMd, fontWeight: '600' },
  metricValue: { ...Fonts.metricDisplay },
  metricTrend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metricTrendText: { ...Fonts.labelSm },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { ...Fonts.headlineSm },
  viewAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:1, elevation:1 },
  viewAllText: { ...Fonts.labelMd },

  // Cases List
  casesList: { gap: Spacing.sm },
  caseItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.xl, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  caseIconBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  caseInitials: { ...Fonts.labelLg, fontWeight: '700' },
  caseInfo: { flex: 1, marginLeft: Spacing.md },
  caseName: { ...Fonts.labelLg, fontWeight: '600' },
  caseSub: { ...Fonts.bodySm, marginTop: 2 },
  caseRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  riskPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.md },
  riskPillText: { ...Fonts.labelSm, fontWeight: '600' },
});




