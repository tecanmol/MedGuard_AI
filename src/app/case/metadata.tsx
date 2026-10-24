/**
 * MedGuard AI — Patient Details Intake (Stitch Design - Strict)
 * Preserves all logic: draft saving, debouncedSave, handleChange, handleContinue, Context.
 */
import { t } from '@/constants/i18n';
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import type { ConditionCategory, DiabetesStatus, PatientMetadata, Sex } from '@/models/types';
import { saveDraft } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MetadataScreen() {
  const theme = useTheme();
  const { language, worker } = useApp();
  const router = useRouter();

  const [caseId, setCaseId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<PatientMetadata>>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (data: Partial<PatientMetadata>, currentCaseId: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
        if (!currentCaseId) return;
        try {
          saveDraft({
            id: currentCaseId,
            workerId: worker?.id || 'unknown',
            patientMetadata: data as PatientMetadata
          });
          if (Platform.OS === 'android') {
            ToastAndroid.show(t(language, 'patient', 'draft_saved') || 'Draft auto-saved', ToastAndroid.SHORT);
          }
        } catch (e) {
          console.warn("Failed to auto-save", e);
        }
      }, 500);
    },
    [language, worker?.id]
  );

  const handleChange = (key: keyof PatientMetadata, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    setErrors((prev) => ({ ...prev, [key]: '' }));

    let currentId = caseId;
    if (!currentId) {
      currentId = Crypto.randomUUID();
      setCaseId(currentId);
    }
    debouncedSave(newData, currentId);
  };

  const handleContinue = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.age) newErrors.age = t(language, 'patient', 'error_age_required') || 'Age is required';
    if (!formData.conditionCategory) newErrors.conditionCategory = t(language, 'patient', 'error_condition_required') || 'Condition category is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let currentId = caseId;
    if (!currentId) {
      currentId = Crypto.randomUUID();
      setCaseId(currentId);
    }

    try {
      saveDraft({
        id: currentId,
        workerId: worker?.id || 'unknown',
        patientMetadata: formData as PatientMetadata
      });
      router.push(`/case/capture?caseId=${currentId}`);
    } catch (e) {
      console.warn("Failed to save draft", e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'transparent' }]}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Patient Triage Intake</Text>
        </View>
        <View style={styles.headerRight}>
            <View style={[styles.stepPill, { backgroundColor: theme.surfaceContainer }]}>
              <Text style={[styles.stepText, { color: StitchColors.primary }]}>Step 1 / 3</Text>
            </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Demographics */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <MaterialIcons name="person-outline" size={20} color={StitchColors.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>1. Patient Demographics</Text>
              </View>
              <View style={[styles.reqPill, { backgroundColor: theme.surfaceContainer }]}>
                <Text style={[styles.reqText, { color: StitchColors.primary }]}>Required</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Patient Full Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter patient name"
                  placeholderTextColor={theme.textTertiary}
                  value={formData.patientName || ''}
                  onChangeText={(val) => handleChange('patientName', val)}
                />
              </View>
              <Text style={[styles.helper, { color: theme.textSecondary }]}>Check official Ayushman or Aadhaar registry card if accessible.</Text>
            </View>

            <View style={styles.rowGrid}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Age <Text style={{ color: StitchColors.error }}>*</Text></Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: errors.age ? StitchColors.error : 'transparent', borderWidth: errors.age ? 1 : 0 }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text, textAlign: 'center', ...Fonts.headlineSm }]}
                    keyboardType="numeric"
                    maxLength={3}
                    value={formData.age?.toString() || ''}
                    onChangeText={(val) => handleChange('age', parseInt(val) || 0)}
                  />
                </View>
                {errors.age && <Text style={{ color: StitchColors.error, ...Fonts.labelSm }}>{errors.age}</Text>}
              </View>
              
              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Assigned Sex <Text style={{ color: StitchColors.error }}>*</Text></Text>
                <View style={[styles.segmentBg, { backgroundColor: theme.surfaceContainerLow }]}>
                  {(['Female', 'Male', 'Other'] as Sex[]).map((s) => {
                    const isSel = formData.sex === s;
                    return (
                      <TouchableOpacity 
                        key={s}
                        style={[styles.segmentBtn, isSel ? { backgroundColor: StitchColors.primary } : { backgroundColor: 'transparent' }]}
                        onPress={() => handleChange('sex', s)}
                      >
                        <Text style={[styles.segmentText, isSel ? { color: StitchColors.onPrimary } : { color: theme.textSecondary }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
            
          </View>
        </View>

        {/* 2. Primary Clinical Pathology */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <MaterialIcons name="healing" size={20} color={StitchColors.tertiary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>2. Skin Condition (AI Classification)</Text>
              </View>
              <View style={[styles.reqPill, { backgroundColor: theme.surfaceContainer }]}>
                <Text style={[styles.reqText, { color: StitchColors.primary }]}>Required</Text>
              </View>
            </View>
            
            <Text style={[styles.label, { color: theme.text, marginBottom: 8 }]}>Visual Skin Condition Classification <Text style={{ color: StitchColors.error }}>*</Text></Text>
            <View style={styles.radioGroupCol}>
              {([
                'Acne / Acne Vulgaris',
                'Carcinoma / Skin Cancer',
                'Eczema / Atopic Dermatitis',
                'Keratosis',
                'Milia',
                'Rosacea',
                'Other / Unknown'
              ] as ConditionCategory[]).map((cat) => {
                const isSel = formData.conditionCategory === cat;
                // Sub-labels to help the health worker
                const subLabel: Record<string, string> = {
                  'Acne / Acne Vulgaris': 'Acne, comedones, papules, pustules',
                  'Carcinoma / Skin Cancer': 'BCC, SCC or any suspicious malignant lesion',
                  'Eczema / Atopic Dermatitis': 'Itchy, inflamed, dry or weeping skin patches',
                  'Keratosis': 'Seborrheic or actinic keratosis (warty growths)',
                  'Milia': 'Small white keratin-filled cysts (often facial)',
                  'Rosacea': 'Facial redness, telangiectasia, papulopustular rosacea',
                  'Other / Unknown': 'Condition not listed above or unsure',
                };
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.radioItemRow, { backgroundColor: theme.surfaceContainerLow, borderColor: isSel ? StitchColors.primary : 'transparent', borderWidth: 1 }]}
                    onPress={() => handleChange('conditionCategory', cat)}
                  >
                    <View style={[styles.radioOuter, { borderColor: isSel ? StitchColors.primary : theme.textTertiary }]}>
                      {isSel && <View style={[styles.radioInner, { backgroundColor: StitchColors.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.radioText, { color: theme.text }]}>{cat}</Text>
                      <Text style={[styles.helper, { color: theme.textSecondary, marginTop: 2 }]}>{subLabel[cat]}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.conditionCategory && <Text style={{ color: StitchColors.error, ...Fonts.labelSm, marginTop: 4 }}>{errors.conditionCategory}</Text>}
          </View>
        </View>
        
        {/* 3. Comorbidity Baseline */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <MaterialIcons name="monitor-heart" size={20} color={StitchColors.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>3. Comorbidity Baseline</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Diabetic Status Profile</Text>
              <View style={styles.radioGroupCol}>
                {(['None / No History', 'Type 2 Diabetes (T2DM)', 'Type 1 Diabetes (T1DM)'] as DiabetesStatus[]).map((status) => {
                  const isSel = formData.diabetesStatus === status;
                  return (
                    <TouchableOpacity 
                      key={status}
                      style={[styles.radioItemRow, { backgroundColor: theme.surfaceContainerLow, borderColor: isSel ? StitchColors.primary : 'transparent', borderWidth: 1 }]}
                      onPress={() => handleChange('diabetesStatus', status)}
                    >
                      <View style={[styles.radioOuter, { borderColor: isSel ? StitchColors.primary : theme.textTertiary }]}>
                        {isSel && <View style={[styles.radioInner, { backgroundColor: StitchColors.primary }]} />}
                      </View>
                      <Text style={[styles.radioText, { color: theme.text }]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>


            
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Clinical Comorbidity Notes</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
                <TextInput
                  style={[styles.input, { color: theme.text, height: '100%', textAlignVertical: 'top' }]}
                  placeholder="Record neuropathy, hypertension, prior amputations, or systemic symptoms."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  value={formData.comorbidityNotes || ''}
                  onChangeText={(val) => handleChange('comorbidityNotes', val)}
                />
              </View>
            </View>
            
          </View>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surfaceContainerLowest }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.secondaryAction, { backgroundColor: theme.surfaceContainer }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryActionText, { color: theme.text }]}>Discard Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryAction, { backgroundColor: StitchColors.primary }]}
            onPress={handleContinue}
          >
            <Text style={[styles.primaryActionText, { color: StitchColors.onPrimary }]}>Proceed to Image Capture</Text>
            <MaterialIcons name="arrow-forward" size={18} color={StitchColors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl + 80 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },
  headerRight: { paddingRight: Spacing.xs },
  stepPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  stepText: { ...Fonts.labelSm, fontWeight: '700' },

  sectionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  protocolBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.xl, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  protocolIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  protocolTitle: { ...Fonts.labelLg, fontWeight: '600' },
  protocolDesc: { ...Fonts.bodySm, marginTop: 4 },

  card: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { ...Fonts.headlineSm },
  reqPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  reqText: { ...Fonts.labelSm, fontWeight: '700' },

  fieldGroup: { marginBottom: Spacing.md },
  label: { ...Fonts.labelLg, fontWeight: '600', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, ...Fonts.bodyLg, height: '100%' },
  helper: { ...Fonts.bodySm, marginTop: 4, lineHeight: 18 },

  rowGrid: { flexDirection: 'row', gap: Spacing.sm },
  segmentBg: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: BorderRadius.md, height: 48 },
  segmentBtn: { flex: 1, height: '100%', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  segmentText: { ...Fonts.labelLg, fontWeight: '600' },

  radioGroupCol: { gap: 8 },
  radioItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: BorderRadius.md },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioText: { ...Fonts.bodyLg, flex: 1 },

  valueText: { ...Fonts.headlineSm, fontWeight: '700' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', zIndex: 100 },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  secondaryAction: { flex: 1, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { ...Fonts.labelLg, fontWeight: '600' },
  primaryAction: { flex: 2, height: 48, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { ...Fonts.labelLg, fontWeight: '700' },
});

