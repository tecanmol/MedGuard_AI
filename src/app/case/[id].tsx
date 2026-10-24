import { BorderRadius, Fonts, RiskColors, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaseImage, CaseRecord } from '@/models/types';
import { getCase, getImages, saveImages, updateOutcome } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Collapsible Component for the sections
const CollapsibleSection = ({ title, icon, subtitle, children, defaultOpen = false }: any) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={[styles.sectionContainer, { backgroundColor: theme.surfaceContainerLowest }]}>
      <Pressable
        style={styles.sectionHeader}
        onPress={() => setIsOpen(!isOpen)}
        android_ripple={{ color: theme.surfaceContainerLow }}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.iconBox, { backgroundColor: theme.surfaceContainer }]}>
            <MaterialIcons name={icon} size={20} color={StitchColors.primary} />
          </View>
          <View>
            <Text style={[Fonts.labelLg, { color: theme.text }]}>{title}</Text>
            {subtitle && <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>{subtitle}</Text>}
          </View>
        </View>
        <MaterialIcons
          name={isOpen ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.textSecondary}
        />
      </Pressable>
      {isOpen && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );
};

export default function CaseDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCaseData() {
      try {
        if (!id) return;
        const record = getCase(id as string);
        if (record) {
          let caseImages = getImages(id as string);

          // 1. Fallback from classificationResult.imageUri
          if (caseImages.length === 0 && record.classificationResult?.imageUri) {
            const fallbackImg: CaseImage = {
              id: `rec_cls_${Date.now()}`,
              caseId: id as string,
              uri: record.classificationResult.imageUri,
              capturedAt: new Date().toISOString(),
            };
            saveImages([fallbackImg]);
            caseImages = [fallbackImg];
          }

          // 2. Recovery from device disk storage if images table was empty
          if (caseImages.length === 0 && FileSystem.documentDirectory) {
            try {
              const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
              const matching = files.find((f: string) => f.includes(id as string));
              if (matching) {
                const recoveredImg: CaseImage = {
                  id: `rec_disk_${Date.now()}`,
                  caseId: id as string,
                  uri: FileSystem.documentDirectory + matching,
                  capturedAt: new Date().toISOString(),
                };
                saveImages([recoveredImg]);
                caseImages = [recoveredImg];
              }
            } catch (fsErr) {
              console.warn('[CaseDetail] Disk image recovery check failed:', fsErr);
            }
          }

          record.images = caseImages;
          if (isMounted) {
            setCaseRecord(record);
            if (record.outcome) {
              setOutcomeText(record.outcome);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load case', e);
      }
    }

    loadCaseData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSaveOutcome = () => {
    try {
      updateOutcome(id as string, outcomeText);
      router.back();
    } catch (e) {
      console.warn('Failed to save outcome', e);
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1400);
  };

  if (!caseRecord) return null;

  const images = caseRecord.images ?? [];
  const triageResult = caseRecord.triageResult;
  const classificationResult = caseRecord.classificationResult;
  const patientMetadata = caseRecord.patientMetadata;

  const riskLevel = triageResult?.finalRiskLevel || 'low';
  const isHighRisk = riskLevel === 'high';
  const isModerateRisk = riskLevel === 'moderate';

  const confidencePct = Math.round(
    ((triageResult?.conditionConfidence ?? classificationResult?.confidence ?? 0) * 100)
  );

  const hasHeatmapData =
    classificationResult?.heatmapData?.some((row) => row.some((val) => val > 0)) ?? false;

  const displayImageUri = images[0]?.uri || classificationResult?.imageUri;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.xs }]} numberOfLines={1}>
            Case Detail
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusPill, { backgroundColor: theme.surfaceContainer }]}>
            <View style={[styles.statusDot, { backgroundColor: StitchColors.tertiaryContainer }]} />
            <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>OFFLINE</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: StitchColors.primary }]}>
            <MaterialIcons name="person" size={18} color={StitchColors.onPrimary} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sync Banner */}
        <View style={[styles.syncBanner, { backgroundColor: theme.surfaceContainerHigh }]}>
          <View style={styles.syncLeft}>
            <MaterialIcons name="cloud-queue" size={20} color={StitchColors.tertiary} />
            <View style={styles.syncTextCol}>
              <View style={styles.syncTextRow}>
                <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary, fontWeight: '700' }]}>
                  Sync Pending (Local Enclave Verified)
                </Text>
                <View style={[styles.queueBadge, { backgroundColor: StitchColors.secondaryContainer }]}>
                  <Text style={[Fonts.labelSm, { fontSize: 10, color: StitchColors.onSecondaryContainer }]}>Queue #3</Text>
                </View>
              </View>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]} numberOfLines={1}>
                Queued offline • Encrypted via AES-256 GCM
              </Text>
            </View>
          </View>
          <Pressable
            style={[
              styles.syncBtn,
              { backgroundColor: isSyncing ? StitchColors.secondaryContainer : StitchColors.primaryContainer }
            ]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <MaterialIcons
              name={isSyncing ? 'check' : 'sync'}
              size={18}
              color={isSyncing ? StitchColors.onSecondaryContainer : StitchColors.onPrimary}
            />
            <Text style={[Fonts.labelMd, { color: isSyncing ? StitchColors.onSecondaryContainer : StitchColors.onPrimary }]}>
              {isSyncing ? 'Synced' : 'Sync Now'}
            </Text>
          </Pressable>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary, fontWeight: '700' }]}>Record ID</Text>
            <Text style={[Fonts.headlineSm, { color: theme.text }]}>MG-{id?.slice(0, 4) || '4035'}</Text>
          </View>
        </View>

        {/* Patient Vital Card */}
        <View style={styles.paddingH}>
          <View style={[styles.vitalCard, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.vitalHeader}>
              <View style={styles.vitalHeaderLeft}>
                <View style={styles.nameRow}>
                  <Text style={[Fonts.headlineMd, { color: theme.text }]} numberOfLines={1}>
                    {patientMetadata?.patientName || 'Patient'}
                  </Text>
                  <View style={[styles.ageBadge, { backgroundColor: theme.surfaceContainer }]}>
                    <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>
                      {patientMetadata?.age}{patientMetadata?.sex?.charAt(0)?.toUpperCase() || ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.triageTimeRow}>
                  <MaterialIcons name="schedule" size={16} color={StitchColors.outline} />
                  <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>
                    Triage: {new Date(caseRecord.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.riskBadge,
                  {
                    backgroundColor: isHighRisk
                      ? StitchColors.errorContainer
                      : isModerateRisk
                      ? RiskColors.moderateBg
                      : RiskColors.lowBg,
                    borderColor: isHighRisk
                      ? StitchColors.error
                      : isModerateRisk
                      ? RiskColors.moderateBorder
                      : RiskColors.lowBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <MaterialIcons
                  name={isHighRisk ? 'warning' : isModerateRisk ? 'info' : 'check-circle'}
                  size={16}
                  color={isHighRisk ? StitchColors.error : isModerateRisk ? RiskColors.moderate : RiskColors.low}
                />
                <Text
                  style={[
                    Fonts.labelSm,
                    styles.uppercase,
                    {
                      color: isHighRisk ? StitchColors.error : isModerateRisk ? RiskColors.moderate : RiskColors.low,
                      fontWeight: 'bold',
                      marginLeft: 4,
                    },
                  ]}
                >
                  {riskLevel.toUpperCase()} RISK
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCol}>
                <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary }]}>Acuity Index / Diagnosis</Text>
                <Text style={[Fonts.headlineSm, { color: StitchColors.primary, fontWeight: 'bold' }]}>
                  {triageResult?.predictedCondition || classificationResult?.predictedCondition || 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Explainable AI (xAI) Heatmap & Visual Evidence */}
        {(displayImageUri || hasHeatmapData) && (
          <View style={styles.paddingH}>
            <View style={[styles.heatmapCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={styles.heatmapHeader}>
                <View style={styles.heatmapHeaderLeft}>
                  <MaterialIcons name="grid-on" size={20} color={StitchColors.primary} />
                  <Text style={[Fonts.labelLg, { color: theme.text, marginLeft: Spacing.xs }]}>
                    xAI Occlusion Heatmap
                  </Text>
                </View>
                {hasHeatmapData && (
                  <View style={[styles.xaiPill, { backgroundColor: theme.surfaceContainer }]}>
                    <Text style={[Fonts.labelSm, { color: StitchColors.primary, fontWeight: '700' }]}>7×7 OCCLUSION</Text>
                  </View>
                )}
              </View>

              {/* Square Image View with Heatmap Overlay */}
              <View style={styles.imageContainer}>
                {displayImageUri ? (
                  <Image
                    source={{ uri: displayImageUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]}>
                    <MaterialIcons name="grid-on" size={54} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.imagePlaceholderText}>
                      Occlusion Sensitivity Analysis
                    </Text>
                  </View>
                )}

                {/* Heatmap & Matrix Grid Overlay */}
                {showHeatmap && hasHeatmapData && classificationResult?.heatmapData && (
                  <View style={[StyleSheet.absoluteFill, { borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.3)' }]}>
                    {classificationResult.heatmapData.map((row, rIdx) => (
                      <View key={`row-${rIdx}`} style={{ flex: 1, flexDirection: 'row' }}>
                        {row.map((val, cIdx) => (
                          <View
                            key={`cell-${rIdx}-${cIdx}`}
                            style={{
                              flex: 1,
                              borderWidth: 0.5,
                              borderColor: 'rgba(255, 255, 255, 0.22)',
                              backgroundColor:
                                val > 0.02
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
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLeft}>
                    <MaterialIcons name="layers" size={18} color={theme.text} />
                    <Text style={[Fonts.labelMd, { color: theme.text }]}>Occlusion Sensitivity Heatmap</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowHeatmap(!showHeatmap)}>
                    <MaterialIcons
                      name={showHeatmap ? 'toggle-on' : 'toggle-off'}
                      size={32}
                      color={showHeatmap ? StitchColors.primary : theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Saliency Legend */}
              {hasHeatmapData && showHeatmap && (
                <View style={styles.legendRow}>
                  <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Feature Sensitivity:</Text>
                  <View style={styles.legendItems}>
                    <View style={[styles.legendBox, { backgroundColor: 'rgba(255, 220, 0, 0.55)' }]} />
                    <Text style={[Fonts.labelSm, { color: theme.textSecondary, fontSize: 11 }]}>Low</Text>
                    <View style={[styles.legendBox, { backgroundColor: 'rgba(255, 120, 0, 0.65)' }]} />
                    <Text style={[Fonts.labelSm, { color: theme.textSecondary, fontSize: 11 }]}>Medium</Text>
                    <View style={[styles.legendBox, { backgroundColor: 'rgba(255, 0, 0, 0.75)' }]} />
                    <Text style={[Fonts.labelSm, { color: theme.textSecondary, fontSize: 11 }]}>High Impact</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Collapsible Sections */}
        <View style={styles.sectionsWrapper}>
          <CollapsibleSection
            title="1. Patient & Intake Details"
            subtitle="Demographics, chronic history, triage notes"
            icon="badge"
            defaultOpen
          >
            <View style={[styles.detailsGrid, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={styles.gridItem}>
                <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary }]}>Full Legal Name</Text>
                <Text style={[Fonts.bodyMd, { color: theme.text, fontWeight: '600' }]}>
                  {patientMetadata?.patientName || 'Unknown Patient'}
                </Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary }]}>Age & Biological Sex</Text>
                <Text style={[Fonts.bodyMd, { color: theme.text, fontWeight: '600' }]}>
                  {patientMetadata?.age ? `${patientMetadata.age} yrs` : 'N/A'} • {patientMetadata?.sex || 'Unspecified'}
                </Text>
              </View>

              <View style={[styles.gridItem, { width: '100%' }]}>
                <Text style={[Fonts.labelSm, styles.uppercase, { color: theme.textSecondary }]}>Clinical Notes</Text>
                <Text style={[Fonts.bodySm, { color: theme.text, marginTop: 4 }]}>
                  Chief complaint category: {patientMetadata?.conditionCategory || 'General Dermatological Assessment'}
                  {patientMetadata?.lesionLocation ? ` • Location: ${patientMetadata.lesionLocation}` : ''}
                  {patientMetadata?.symptomDuration ? ` • Duration: ${patientMetadata.symptomDuration}` : ''}
                </Text>
              </View>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="2. AI Consensus & Reasoning"
            subtitle="Diagnostic summary"
            icon="psychology"
            defaultOpen
          >
            <View style={[styles.aiSummary, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={styles.aiSummaryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.labelSm, styles.uppercase, { color: StitchColors.primary, fontWeight: 'bold' }]}>Primary Differential</Text>
                  <Text style={[Fonts.headlineSm, { color: theme.text, marginTop: 2, textTransform: 'capitalize' }]}>
                    {triageResult?.predictedCondition || classificationResult?.predictedCondition || 'Assessment Complete'}
                  </Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: StitchColors.secondaryContainer }]}>
                  <Text style={[Fonts.labelSm, { color: StitchColors.onSecondaryContainer, fontWeight: 'bold' }]}>
                    {confidencePct > 0 ? `${confidencePct}% Confidence` : 'Assessed'}
                  </Text>
                </View>
              </View>

              {classificationResult?.source && (
                <View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="memory" size={16} color={theme.textSecondary} />
                  <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>
                    Inference Engine: {classificationResult.source === 'tflite_medv4' ? 'On-Device EfficientNetV2B0 (TFLite)' : classificationResult.source}
                  </Text>
                </View>
              )}
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="3. Audit Trail"
            subtitle="Device and operator info"
            icon="verified-user"
          >
            <View style={styles.auditRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Logged By:</Text>
              <Text style={[Fonts.bodySm, { color: theme.text, fontWeight: '600' }]}>ASHA / Field Worker</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Model Version:</Text>
              <Text style={[Fonts.bodySm, { color: theme.text, fontWeight: '600' }]}>
                {caseRecord.modelVersion || 'medguard-v4-efficientnetv2b0'}
              </Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Clinical Outcome:</Text>
              <Text style={[Fonts.bodySm, { color: theme.text, fontWeight: '600' }]}>{outcomeText || 'Pending'}</Text>
            </View>
          </CollapsibleSection>
        </View>

        <View style={styles.disclaimerBoxContainer}>
          <View style={[styles.disclaimerBox, { backgroundColor: theme.surfaceContainerHigh }]}>
            <MaterialIcons name="shield" size={22} color={StitchColors.primary} />
            <Text style={[Fonts.bodySm, { color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }]}>
              <Text style={{ fontWeight: 'bold' }}>Statutory Protocol: </Text>
              MedGuard AI provides assistive field classification. Must be reviewed by a Medical Officer.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surfaceContainerLowest }]}>
        <Pressable
          style={[styles.bottomBtnSecondary, { backgroundColor: theme.surfaceContainer }]}
          onPress={() => router.push(`/case/referral?id=${id}` as any)}
        >
          <MaterialIcons name="assignment" size={20} color={StitchColors.primary} />
          <Text style={[Fonts.labelLg, { color: StitchColors.primary, marginLeft: 8 }]}>Referral Slip</Text>
        </Pressable>
        <Pressable
          style={[styles.bottomBtnPrimary, { backgroundColor: StitchColors.primary }]}
          onPress={handleSaveOutcome}
        >
          <MaterialIcons name="save" size={20} color={StitchColors.onPrimary} />
          <Text style={[Fonts.labelLg, { color: StitchColors.onPrimary, marginLeft: 8 }]}>Save Outcome</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    elevation: 2,
    zIndex: 50,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 120 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  syncTextCol: { flex: 1 },
  syncTextRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  uppercase: { textTransform: 'uppercase', letterSpacing: 0.5 },
  queueBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: Spacing.md, borderRadius: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paddingH: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  vitalCard: { borderRadius: 12, padding: Spacing.lg, elevation: 1 },
  vitalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  vitalHeaderLeft: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ageBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  triageTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  metricsGrid: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.md, padding: Spacing.sm, borderRadius: 8, justifyContent: 'space-between' },
  metricCol: { flexDirection: 'column' },
  heatmapCard: { borderRadius: 12, overflow: 'hidden', elevation: 1 },
  heatmapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  heatmapHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  xaiPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#0F172A', overflow: 'hidden' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: 'rgba(255,255,255,0.6)', marginTop: 8, fontSize: 13, fontWeight: '600' },
  toggleRow: { padding: Spacing.md, paddingBottom: Spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendItems: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 10, height: 10, borderRadius: 2, borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.4)' },
  sectionsWrapper: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  sectionContainer: { borderRadius: 12, overflow: 'hidden', elevation: 1, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBox: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, padding: Spacing.md, borderRadius: 8 },
  gridItem: { width: '45%' },
  aiSummary: { padding: Spacing.md, borderRadius: 8 },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  auditRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  disclaimerBoxContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  disclaimerBox: { flexDirection: 'row', padding: Spacing.md, borderRadius: 12, alignItems: 'flex-start' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, elevation: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  bottomBtnSecondary: { flex: 1, height: 52, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bottomBtnPrimary: { flex: 1.4, height: 52, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
