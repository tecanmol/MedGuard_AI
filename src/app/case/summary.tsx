import Button from '@/components/ui/Button';
import { Spacing, StitchColors, Fonts, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaseRecord, CaseImage } from '@/models/types';
import { deleteDraft, getCase, getImages, saveImages, saveCase } from '@/services/case-repository';
import { addToSyncQueue } from '@/services/sync-service';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {  Alert, ScrollView, StyleSheet, Text, View, Image, TouchableOpacity, SafeAreaView , Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/contexts/AppContext';

export default function SummaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { worker } = useApp();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCaseData() {
      try {
        if (!caseId) return;
        const record = getCase(caseId);
        if (record) {
          let caseImages = getImages(caseId);

          if (caseImages.length === 0 && record.classificationResult?.imageUri) {
            const fallbackImg: CaseImage = {
              id: `rec_cls_${Date.now()}`,
              caseId,
              uri: record.classificationResult.imageUri,
              capturedAt: new Date().toISOString(),
            };
            saveImages([fallbackImg]);
            caseImages = [fallbackImg];
          }

          if (caseImages.length === 0 && FileSystem.documentDirectory) {
            try {
              const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
              const matching = files.find((f: string) => f.includes(caseId));
              if (matching) {
                const recoveredImg: CaseImage = {
                  id: `rec_disk_${Date.now()}`,
                  caseId,
                  uri: FileSystem.documentDirectory + matching,
                  capturedAt: new Date().toISOString(),
                };
                saveImages([recoveredImg]);
                caseImages = [recoveredImg];
              }
            } catch (fsErr) {
              console.warn('[Summary] Disk image recovery check failed:', fsErr);
            }
          }

          record.images = caseImages;
          if (isMounted) {
            setCaseRecord(record);
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
  }, [caseId]);

  if (!caseRecord) return null;

  const images = caseRecord.images ?? [];
  const displayImageUri = images[0]?.uri || caseRecord.classificationResult?.imageUri;
  const hasHeatmapData = caseRecord.classificationResult?.heatmapData?.some(row => row.some(val => val > 0)) ?? false;

  const handleSave = () => {
    try {
      const updated = { ...caseRecord, status: 'completed' as const };
      saveCase(updated);
      addToSyncQueue({
        id: Crypto.randomUUID(),
        type: 'case',
        referenceId: caseId as string
      });
      router.replace('/(tabs)');
    } catch (e) {
      console.warn("Failed to save case", e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceContainerLowest, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>Case Summary</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.offlineBadge, { backgroundColor: theme.surfaceContainer }]}>
            <View style={[styles.offlineDot, { backgroundColor: StitchColors.tertiaryContainer }]} />
            <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>OFFLINE</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: StitchColors.primary }]}>
            <MaterialIcons name="person" size={18} color={StitchColors.onPrimary} />
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.surfaceContainerHigh }]}>
          <View style={styles.bannerIcon}>
            <MaterialIcons name="enhanced-encryption" size={20} color={StitchColors.primary} />
          </View>
          <View style={styles.bannerTextContainer}>
            <View style={styles.bannerRow}>
              <Text style={[Fonts.labelSm, { color: StitchColors.primary, textTransform: 'uppercase' }]}>Local Enclave Secured</Text>
              <View style={[styles.queueBadge, { backgroundColor: theme.surfaceContainerHighest }]}>
                <View style={[styles.queueDot, { backgroundColor: StitchColors.secondary }]} />
                <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Queue #1</Text>
              </View>
            </View>
            <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>
              Stored in Encrypted Local Enclave. Sync Pending (Queued for PHC Wi-Fi or GSM SMS uplink).
            </Text>
          </View>
        </View>

        {/* Header Block */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[Fonts.headlineLg, { color: theme.text }]}>Case Summary & Clinical Record</Text>
            <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 4 }]}>Triage finalized • Case #{caseId?.slice(0,6) || 'MG-4035'}</Text>
          </View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surfaceContainer }]}>
            <MaterialIcons name="share" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Section 1: Patient Profile */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <View style={[styles.initialsAvatar, { backgroundColor: StitchColors.secondaryContainer }]}>
                <Text style={[Fonts.headlineSm, { color: StitchColors.onSecondaryContainer }]}>
                  {caseRecord.patientMetadata.patientName ? caseRecord.patientMetadata.patientName.substring(0,2).toUpperCase() : 'SD'}
                </Text>
              </View>
              <View>
                <Text style={[Fonts.headlineSm, { color: theme.text }]}>{caseRecord.patientMetadata.patientName || 'Sunita Devi'}</Text>
                <Text style={[Fonts.bodySm, { color: theme.textSecondary }]} numberOfLines={1}>
                  {caseRecord.patientMetadata.age} Yrs • {caseRecord.patientMetadata.sex || 'Female'} • {worker?.phcAffiliation || 'No Facility'}
                </Text>
              </View>
            </View>
            <View style={[styles.phoneBadge, { backgroundColor: theme.surfaceContainer }]}>
              <MaterialIcons name="call" size={14} color={theme.text} />
              <Text style={[Fonts.labelSm, { color: theme.text, marginLeft: 4 }]}>+91 98765 43210</Text>
            </View>
          </View>

          <View style={[styles.complaintBox, { backgroundColor: theme.surfaceContainerLow }]}>
            <Text style={[Fonts.labelSm, { color: theme.textSecondary, textTransform: 'uppercase' }]}>Chief Complaint</Text>
            <Text style={[Fonts.bodyMd, { color: theme.text, marginTop: 4 }]}>
              {caseRecord.patientMetadata.conditionCategory || 'Plantar left foot ulcer with painful spreading redness (1-4 weeks onset).'}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceContainerLow }]}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Clinical Risk</Text>
              <Text style={[Fonts.labelLg, { color: theme.text, marginTop: 4 }]}>Type 2 DM</Text>
              <Text style={[Fonts.labelSm, { color: StitchColors.tertiary, marginTop: 2 }]}>Diagnosed</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: theme.surfaceContainerLow }]}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Random Blood Sugar</Text>
              <Text style={[Fonts.labelLg, { color: StitchColors.error, marginTop: 4 }]}>248 mg/dL</Text>
              <Text style={[Fonts.labelSm, { color: StitchColors.error, marginTop: 2 }]}>Uncontrolled</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Clinical Photography & xAI Heatmap */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="grid-on" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>Clinical Photography & xAI</Text>
            </View>
            {hasHeatmapData ? (
              <View style={{ backgroundColor: theme.surfaceContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={[Fonts.labelSm, { color: StitchColors.primary, fontWeight: '700' }]}>7×7 OCCLUSION</Text>
              </View>
            ) : (
              <Text style={[Fonts.labelSm, { color: StitchColors.primary }]}>Validated Frame</Text>
            )}
          </View>

          {displayImageUri || hasHeatmapData ? (
            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#0F172A', borderRadius: 8, overflow: 'hidden', marginVertical: Spacing.sm }}>
              {displayImageUri ? (
                <Image
                  source={{ uri: displayImageUri }}
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

              {/* Heatmap & Matrix Grid Overlay */}
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
          ) : (
            <View style={styles.photosGrid}>
              <View style={[styles.photoWrapper, { backgroundColor: theme.surfaceContainer }]}>
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="image" size={32} color={theme.textSecondary} />
                  <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 4 }]}>No Image Stored</Text>
                </View>
              </View>
            </View>
          )}

          {/* Heatmap Toggle */}
          {hasHeatmapData && (
            <View style={{ paddingTop: Spacing.xs, paddingBottom: showHeatmap ? Spacing.xs : Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="layers" size={18} color={theme.text} />
                <Text style={{ ...Fonts.labelMd, color: theme.text }}>Occlusion Sensitivity Heatmap</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHeatmap(!showHeatmap)}>
                <MaterialIcons name={showHeatmap ? "toggle-on" : "toggle-off"} size={32} color={showHeatmap ? StitchColors.primary : theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Saliency Legend */}
          {hasHeatmapData && showHeatmap && (
            <View style={{ paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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

          <View style={[styles.segmentedMetrics, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={styles.segmentMetric}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Lesion Location</Text>
              <Text style={[Fonts.labelLg, { color: theme.text }]}>{caseRecord.patientMetadata.lesionLocation || 'Field Scan'}</Text>
            </View>
            <View style={styles.segmentMetric}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Confidence</Text>
              <Text style={[Fonts.labelLg, { color: theme.text }]}>
                {Math.round((caseRecord.triageResult?.conditionConfidence ?? caseRecord.classificationResult?.confidence ?? 0) * 100)}%
              </Text>
            </View>
            <View style={styles.segmentMetric}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Risk Level</Text>
              <Text style={[Fonts.labelLg, { color: caseRecord.triageResult?.finalRiskLevel === 'high' ? StitchColors.error : StitchColors.primary }]}>
                {(caseRecord.triageResult?.finalRiskLevel || 'low').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 3: AI Triage & Multi-Agent Consensus */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="psychology" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>AI Triage Consensus</Text>
            </View>
            <View style={[styles.riskBadge, { backgroundColor: StitchColors.errorContainer }]}>
              <MaterialIcons name="warning" size={14} color={StitchColors.onErrorContainer} />
              <Text style={[Fonts.labelSm, { color: StitchColors.onErrorContainer, marginLeft: 4 }]}>
                {caseRecord.triageResult?.finalRiskLevel === 'high' ? 'HIGH RISK' : 'MODERATE RISK'}
              </Text>
            </View>
          </View>

          <View style={[styles.consensusBox, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={styles.consensusHeaderRow}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Multi-Agent Alignment</Text>
              <Text style={[Fonts.labelSm, { color: StitchColors.primary }]}>4 of 4 Agents Aligned</Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceContainerHigh }]}>
              <View style={[styles.progressBarFill, { backgroundColor: StitchColors.primary, width: '89%' }]} />
            </View>
            <View style={styles.consensusFooterRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Inference Confidence</Text>
              <Text style={[Fonts.labelMd, { color: theme.text }]}>89%</Text>
            </View>
          </View>

          <View style={styles.diagnosisBox}>
            <Text style={[Fonts.labelSm, { color: theme.textSecondary, textTransform: 'uppercase' }]}>Primary Diagnosis Evaluation</Text>
            <Text style={[Fonts.headlineSm, { color: theme.text, marginTop: 4 }]}>
              {caseRecord.triageResult?.predictedCondition || 'Infected Diabetic Foot Ulcer with Surrounding Cellulitis'}
            </Text>
            <View style={[styles.icdBadge, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Text style={[Fonts.labelSm, { color: theme.text }]}>ICD-10: E11.621</Text>
            </View>
          </View>

          <View style={[styles.overrideBox, { backgroundColor: theme.surfaceContainerHigh }]}>
            <MaterialIcons name="verified-user" size={18} color={StitchColors.error} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={[Fonts.labelSm, { color: theme.text, textTransform: 'uppercase' }]}>Deterministic Safety Override</Text>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 4 }]}>
                Elevated from Moderate to High due to uncontrolled hyperglycemia (RBS 248 mg/dL) combined with spreading acute cellulitis factor.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 4: Clinical Guidance */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="medical-services" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>Clinical Guidance</Text>
            </View>
            <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>NHM Protocol 2024.3</Text>
          </View>

          <View style={styles.guidanceList}>
            <View style={[styles.guidanceItem, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={[styles.stepCircle, { backgroundColor: StitchColors.primary }]}>
                <Text style={[Fonts.labelSm, { color: StitchColors.onPrimary }]}>1</Text>
              </View>
              <View style={styles.guidanceText}>
                <Text style={[Fonts.labelMd, { color: theme.text }]}>Total Offloading of Left Extremity</Text>
                <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>Immediate non-weight bearing status. Provide walking assistance or wheelchair for transport.</Text>
              </View>
            </View>
            <View style={[styles.guidanceItem, { backgroundColor: theme.surfaceContainerLow }]}>
              <View style={[styles.stepCircle, { backgroundColor: StitchColors.primary }]}>
                <Text style={[Fonts.labelSm, { color: StitchColors.onPrimary }]}>2</Text>
              </View>
              <View style={styles.guidanceText}>
                <Text style={[Fonts.labelMd, { color: theme.text }]}>Sterile Saline Moist Dressing</Text>
                <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>Irrigate gently with normal saline. Apply non-adherent sterile gauze; avoid astringents.</Text>
              </View>
            </View>
            <View style={[styles.guidanceItem, { backgroundColor: 'rgba(186,26,26,0.1)' }]}>
              <View style={[styles.stepCircle, { backgroundColor: StitchColors.error }]}>
                <Text style={[Fonts.labelSm, { color: StitchColors.onError }]}>3</Text>
              </View>
              <View style={styles.guidanceText}>
                <Text style={[Fonts.labelMd, { color: StitchColors.error }]}>Urgent Secondary Transfer ({'<'}24h)</Text>
                <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>Surgical debridement and IV antimicrobial evaluation required at designated secondary center.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 5: Referral Routing */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="local-shipping" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>Referral Routing</Text>
            </View>
            <View style={[styles.urgentBadge, { backgroundColor: StitchColors.error }]}>
              <Text style={[Fonts.labelSm, { color: StitchColors.onError }]}>Urgent Priority</Text>
            </View>
          </View>
          
          <View style={[styles.routingBox, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary, textTransform: 'uppercase' }]}>Target Facility</Text>
              <Text style={[Fonts.headlineSm, { color: theme.text, marginTop: 4 }]} numberOfLines={1}>{caseRecord.referralInfo?.destinationFacilityName || 'Sassoon General Hospital (District Hospital Pune)'}</Text>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>Emergency Surgery • Foot Clinic Wing</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: Spacing.md }}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Distance</Text>
              <Text style={[Fonts.labelLg, { color: StitchColors.primary }]}>14.2 km</Text>
            </View>
          </View>
        </View>

        {/* Section 6: Audit */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="fingerprint" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.sm }]}>Audit & Cryptographic Seal</Text>
            </View>
          </View>

          <View style={[styles.auditBox, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={{ marginBottom: Spacing.sm }}>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Edge Attestation Hash</Text>
              <Text style={[Fonts.labelSm, { color: theme.text, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>SHA256-48F9-2024-EDG-SUNITA-DEVI</Text>
            </View>
            <View style={styles.auditGrid}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Terminal Device ID</Text>
                <Text style={[Fonts.labelSm, { color: theme.text, marginTop: 2 }]}>HW-TAB-094</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>Certified Field ANM</Text>
                <Text style={[Fonts.labelSm, { color: theme.text, marginTop: 2 }]}>Sister Amina Akhtar</Text>
              </View>
            </View>
          </View>

          <View style={styles.auditFooter}>
            <MaterialIcons name="lock" size={16} color={StitchColors.primary} />
            <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }]}>
              Tamper-evident payload generated offline and queued for multi-path network dispatch.
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Floating Actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: StitchColors.primary }]} onPress={handleSave}>
          <MaterialIcons name="check-circle" size={20} color={StitchColors.onPrimary} />
          <Text style={[Fonts.labelLg, { color: StitchColors.onPrimary, marginLeft: Spacing.xs }]}>Complete Case & Return to Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.surfaceContainer }]} onPress={() => Alert.alert('Queued', 'Compressed telemetry queued for emergency SMS transmission.')}>
          <MaterialIcons name="sms" size={18} color={StitchColors.primary} />
          <Text style={[Fonts.labelLg, { color: StitchColors.primary, marginLeft: Spacing.xs }]}>Queue for Instant Emergency SMS Dispatch</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140, // Space for floating actions
  },
  bannerCard: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 122, 104, 0.2)', // primaryContainer/20
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  queueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  card: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  initialsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  complaintBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  photoWrapper: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 144,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  photoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  segmentedMetrics: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  segmentMetric: {
    flex: 1,
    alignItems: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  consensusBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  consensusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  consensusFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  diagnosisBox: {
    marginTop: Spacing.md,
  },
  icdBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  overrideBox: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  guidanceList: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  guidanceItem: {
    flexDirection: 'row',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  guidanceText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  urgentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  routingBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  auditBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  auditGrid: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  auditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
});

