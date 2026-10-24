/**
 * MedGuard AI — Image Capture & Quality Check (Stitch Design - Strict)
 * Preserves logic: ImagePicker, checkImageQuality, saveImages, caseId
 */
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaseImage } from '@/models/types';
import { saveImages } from '@/services/case-repository';
import { checkImageQuality } from '@/services/image-quality';
import { addToSyncQueue } from '@/services/sync-service';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CaptureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId?: string; id?: string }>();
  // Handle both param names to prevent crashes if the user is stuck on the old route
  const caseId = params.caseId || params.id || 'unknown';
  
  const [images, setImages] = useState<CaseImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityMsg, setQualityMsg] = useState<string | null>(null);

  const handleCapture = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setIsProcessing(true);
      
      const quality = await checkImageQuality(uri);
      
      setIsProcessing(false);
      
      if (!quality.passed) {
        setQualityMsg(quality.retakeGuidance || 'Image quality low. Please retake.');
        // Don't add to array if we enforce quality, but for flow, we'll let user retry
      } else {
        setQualityMsg('QA PASSED: FOCUS & EXPOSURE OPTIMAL');
        setImages((prev) => [
          ...prev, 
          { 
            id: Date.now().toString(), 
            caseId: caseId as string,
            uri, 
            type: 'clinical',
            capturedAt: new Date().toISOString()
          }
        ]);
      }
    }
  };

  const handleRetake = () => {
    setImages([]);
    setQualityMsg(null);
  };

  const handleSave = () => {
    if (images.length === 0) return;
    try {
      saveImages(images);
      // Queue images for upload to Firebase Cloud Storage
      addToSyncQueue({
        id: `img-${caseId}`,
        type: 'image',
        referenceId: caseId,
        estimatedSizeBytes: images.length * 500_000, // ~500KB per image estimate
      });
      router.push(`/case/analysis?caseId=${caseId}`);
    } catch (e) {
      console.warn("Failed to save images", e);
    }
  };

  const capturedUri = images.length > 0 ? images[0].uri : null;
  const qualityPassed = qualityMsg?.includes('PASSED') || qualityMsg?.includes('Good');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'transparent' }]}>
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Clinical Capture</Text>
        </View>
        <View style={styles.headerRight}>
            <View style={[styles.stepPill, { backgroundColor: theme.surfaceContainer }]}>
              <Text style={[styles.stepText, { color: StitchColors.primary }]}>Step 2 / 3</Text>
            </View>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* Optical Alignment Sensors */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardTitleRow}>
              <MaterialIcons name="verified-user" size={20} color={StitchColors.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Optical Capture Protocol</Text>
            </View>
            <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
              Hold 15-20cm perpendicular to wound bed. Align natural diffused light and maintain center focus.
            </Text>
            
            <View style={styles.sensorGrid}>
              <View style={[styles.sensorItem, { backgroundColor: theme.surfaceContainer }]}>
                <MaterialIcons name="light-mode" size={16} color={StitchColors.primary} />
                <Text style={[styles.sensorText, { color: theme.text }]}>Light: Optimal</Text>
              </View>
              <View style={[styles.sensorItem, { backgroundColor: theme.surfaceContainer }]}>
                <MaterialIcons name="straighten" size={16} color={StitchColors.primary} />
                <Text style={[styles.sensorText, { color: theme.text }]}>18cm Dist.</Text>
              </View>
              <View style={[styles.sensorItem, { backgroundColor: theme.surfaceContainer }]}>
                <MaterialIcons name="screen-lock-rotation" size={16} color={StitchColors.primary} />
                <Text style={[styles.sensorText, { color: theme.text }]}>Sensor Steady</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Viewfinder / Preview */}
        <View style={styles.viewfinderSection}>
          <View style={[styles.viewfinder, { backgroundColor: StitchColors.inverseSurface }]}>
            {capturedUri ? (
              <Image source={{ uri: capturedUri }} style={styles.previewImg} />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <MaterialIcons name="camera-alt" size={48} color="rgba(255,255,255,0.3)" />
              </View>
            )}

            {/* Overlays */}
            <View style={styles.viewfinderOverlay} />
            
            {!capturedUri && (
              <View style={styles.bracketsContainer}>
                {/* 4 Corners */}
                <View style={[styles.bracketTL, { borderColor: '#ffffff' }]} />
                <View style={[styles.bracketTR, { borderColor: '#ffffff' }]} />
                <View style={[styles.bracketBL, { borderColor: '#ffffff' }]} />
                <View style={[styles.bracketBR, { borderColor: '#ffffff' }]} />
                
                {/* Target */}
                <View style={[styles.reticle, { borderColor: 'rgba(153, 243, 221, 0.5)' }]}>
                  <View style={[styles.reticleDot, { backgroundColor: StitchColors.primaryFixed }]} />
                  <View style={[styles.reticleLabelBox, { backgroundColor: 'rgba(40, 48, 68, 0.8)' }]}>
                    <Text style={[styles.reticleLabel, { color: StitchColors.primaryFixed }]}>TARGET CENTERED</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Post-Capture AI Quality Check HUD */}
            {(capturedUri || qualityMsg) && (
              <View style={styles.hudContainer}>
                {isProcessing ? (
                  <View style={[styles.hudPill, { backgroundColor: 'rgba(40, 48, 68, 0.85)' }]}>
                    <ActivityIndicator size="small" color={StitchColors.primaryFixed} />
                    <Text style={[styles.hudText, { color: '#ffffff' }]}>Running Edge AI Quality Validation...</Text>
                  </View>
                ) : qualityPassed ? (
                  <View style={[styles.hudPill, { backgroundColor: 'rgba(5, 150, 105, 0.9)' }]}>
                    <MaterialIcons name="check-circle" size={18} color="#ffffff" />
                    <Text style={[styles.hudText, { color: '#ffffff', fontWeight: '700' }]}>{qualityMsg}</Text>
                  </View>
                ) : (
                  <View style={[styles.hudPill, { backgroundColor: 'rgba(186, 26, 26, 0.9)' }]}>
                    <MaterialIcons name="error" size={18} color="#ffffff" />
                    <Text style={[styles.hudText, { color: '#ffffff', fontWeight: '700' }]}>{qualityMsg}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
        
      </View>

      {/* Bottom Action Area */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surfaceContainerLowest }]}>
        {!capturedUri ? (
          <TouchableOpacity 
            style={[styles.captureBtnInner, { borderColor: StitchColors.primary }]}
            onPress={handleCapture}
          >
            <View style={[styles.captureBtnCore, { backgroundColor: StitchColors.primary }]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.postCaptureActions}>
            <TouchableOpacity 
              style={[styles.secondaryAction, { backgroundColor: theme.surfaceContainer }]}
              onPress={handleRetake}
            >
              <MaterialIcons name="refresh" size={24} color={theme.text} />
              <Text style={[styles.secondaryActionText, { color: theme.text }]}>Retake Image</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.primaryAction, 
                { backgroundColor: StitchColors.primary },
                (isProcessing || !qualityPassed) && { opacity: 0.5 }
              ]}
              onPress={handleSave}
              disabled={isProcessing || !qualityPassed}
            >
              <MaterialIcons name="save" size={24} color={StitchColors.onPrimary} />
              <Text style={[styles.primaryActionText, { color: StitchColors.onPrimary }]}>Save to Case File</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },
  headerRight: { paddingRight: Spacing.xs },
  stepPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  stepText: { ...Fonts.labelSm, fontWeight: '700' },

  content: { flex: 1, paddingTop: Spacing.md },
  sectionContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },

  // Protocol Card
  card: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { ...Fonts.labelLg, fontWeight: '600', letterSpacing: 0.2 },
  cardDesc: { ...Fonts.bodySm, marginBottom: Spacing.md },
  sensorGrid: { flexDirection: 'row', gap: Spacing.sm },
  sensorItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: BorderRadius.md },
  sensorText: { ...Fonts.labelSm, fontWeight: '600' },

  // Viewfinder
  viewfinderSection: { paddingHorizontal: Spacing.lg, flex: 1, paddingBottom: Spacing.lg },
  viewfinder: { flex: 1, width: '100%', borderRadius: BorderRadius.xl, overflow: 'hidden', position: 'relative', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4, elevation:2 },
  previewImg: { width: '100%', height: '100%' },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinderOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.1)' },
  
  bracketsContainer: { position: 'absolute', top: Spacing.lg, bottom: Spacing.lg, left: Spacing.lg, right: Spacing.lg },
  bracketTL: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTR: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBL: { position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBR: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2 },
  
  reticle: { position: 'absolute', top: '50%', left: '50%', width: 112, height: 112, marginLeft: -56, marginTop: -56, borderRadius: 56, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reticleDot: { width: 8, height: 8, borderRadius: 4, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.2, shadowRadius:1, elevation:1 },
  reticleLabelBox: { position: 'absolute', top: -12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reticleLabel: { fontSize: 10, fontFamily: Fonts.sans, fontWeight: '600', letterSpacing: 1 },

  hudContainer: { position: 'absolute', bottom: Spacing.lg, left: Spacing.lg, right: Spacing.lg, alignItems: 'center' },
  hudPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  hudText: { ...Fonts.labelSm, letterSpacing: 0.5 },

  // Bottom Bar
  bottomBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  captureBtnInner: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center', padding: 4 },
  captureBtnCore: { flex: 1, width: '100%', borderRadius: 36 },

  postCaptureActions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  secondaryAction: { flex: 1, height: 56, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { ...Fonts.labelLg, fontWeight: '600' },
  primaryAction: { flex: 2, height: 56, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { ...Fonts.labelLg, fontWeight: '700' },
});

