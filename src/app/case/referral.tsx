import { Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CaseRecord, Facility } from '@/models/types';
import { getCase, getRecentCases } from '@/services/case-repository';
import { calculateDistance, getAllFacilities, getRecommendedFacility, type ExtendedFacility } from '@/services/facility-repository';
import { getCurrentUserLocation, isLocationNativeAvailable, type UserCoordinates } from '@/services/location-service';
import { searchAndCacheFacilities } from '@/services/overpass-api';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ImageBackground, Linking, Modal, Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReferralScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ caseId?: string; id?: string }>();
  const resolvedCaseId = params.caseId || params.id;

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [recommendedFacility, setRecommendedFacility] = useState<Facility | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [allFacilities, setAllFacilities] = useState<ExtendedFacility[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingOnline, setIsFetchingOnline] = useState(false);
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDataAndLocation() {
      try {
        let record = resolvedCaseId ? getCase(resolvedCaseId) : null;
        if (!record) {
          const recent = getRecentCases(1);
          if (recent && recent.length > 0) {
            record = recent[0];
          }
        }
        if (isMounted && record) {
          setCaseRecord(record);
        }

        const initialFacilities = getAllFacilities();
        if (isMounted) setAllFacilities(initialFacilities);

        const initialRec = getRecommendedFacility('Surgical');
        if (initialRec && isMounted) setRecommendedFacility(initialRec);

        // Fetch live GPS coordinates from device
        if (isMounted) setIsLocating(true);
        const coords = await getCurrentUserLocation();
        if (!isMounted) return;
        setIsLocating(false);

        if (coords) {
          setUserCoords(coords);

          // Calculate exact distances from user's current GPS position
          const withDist = initialFacilities.map(f => {
            if (typeof f.latitude === 'number' && typeof f.longitude === 'number') {
              const d = calculateDistance(coords, { latitude: f.latitude, longitude: f.longitude });
              return { ...f, distance: d };
            }
            return f;
          }).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

          setAllFacilities(withDist);

          // Find closest facility tailored to patient needs
          const locationRec = getRecommendedFacility('Surgical', coords);
          if (locationRec) {
            setRecommendedFacility(locationRec);
          }
        }
      } catch (e) {
        console.warn("Failed to load case or location", e);
        if (isMounted) setIsLocating(false);
      }
    }

    loadDataAndLocation();

    return () => {
      isMounted = false;
    };
  }, [resolvedCaseId]);

  const handleRefreshLocation = async () => {
    if (!isLocationNativeAvailable()) {
      Alert.alert(
        'Location Service',
        'Live GPS hardware requires rebuilding the APK with expo-location compiled (run `npx expo run:android`). Currently utilizing Maharashtra regional facility registry coordinates for distance routing.'
      );
      return;
    }

    setIsLocating(true);
    try {
      const coords = await getCurrentUserLocation();
      if (coords) {
        setUserCoords(coords);
        const updated = allFacilities.map(f => {
          if (typeof f.latitude === 'number' && typeof f.longitude === 'number') {
            const d = calculateDistance(coords, { latitude: f.latitude, longitude: f.longitude });
            return { ...f, distance: d };
          }
          return f;
        }).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
        setAllFacilities(updated);

        const locationRec = getRecommendedFacility('Surgical', coords);
        if (locationRec) {
          setRecommendedFacility(locationRec);
        }
      } else {
        Alert.alert('Location Notice', 'Could not detect current GPS coordinates. Please ensure Location permissions are enabled in settings.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  const handleOnlineSearch = async () => {
    setIsFetchingOnline(true);
    try {
      let lat = userCoords?.latitude;
      let lng = userCoords?.longitude;

      if (!lat || !lng) {
        const freshCoords = await getCurrentUserLocation();
        if (freshCoords) {
          setUserCoords(freshCoords);
          lat = freshCoords.latitude;
          lng = freshCoords.longitude;
        }
      }

      lat = lat ?? recommendedFacility?.latitude ?? 18.5204;
      lng = lng ?? recommendedFacility?.longitude ?? 73.8567;

      await searchAndCacheFacilities(lat, lng, 35000);
      const updated = getAllFacilities();
      const withDistance = lat && lng
        ? updated.map(f => ({
            ...f,
            distance: calculateDistance({ latitude: lat!, longitude: lng! }, { latitude: f.latitude, longitude: f.longitude }),
          })).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
        : updated;

      setAllFacilities(withDistance);
      if (withDistance.length > 0 && (!recommendedFacility || !recommendedFacility.distance)) {
        setRecommendedFacility(withDistance[0]);
      }
    } finally {
      setIsFetchingOnline(false);
    }
  };

  const handleExportPDF = async () => {
    if (!caseRecord) return;
    setIsPrinting(true);
    try {
      const patient = caseRecord.patientMetadata;
      const triage = caseRecord.triageResult;
      const risk = triage?.finalRiskLevel?.toUpperCase() ?? 'UNKNOWN';
      const condition = triage?.predictedCondition ?? 'N/A';
      const confidence = triage?.conditionConfidence != null
        ? `${Math.round(triage.conditionConfidence * 100)}%`
        : 'N/A';
      const dest = recommendedFacility?.name ?? 'Sub-District Hospital';
      const date = new Date(caseRecord.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });

      const referralText =
        `═══════════════════════════════\n` +
        `   MEDGUARD AI — REFERRAL SLIP\n` +
        `═══════════════════════════════\n` +
        `Case ID : ${caseRecord.id.substring(0, 8).toUpperCase()}\n` +
        `Date    : ${date}\n\n` +
        `── PATIENT INFORMATION ──\n` +
        `Name      : ${patient.patientName || 'N/A'}\n` +
        `Age / Sex : ${patient.age ?? 'N/A'} / ${patient.sex ?? 'N/A'}\n` +
        `Category  : ${patient.conditionCategory ?? 'N/A'}\n\n` +
        `── AI TRIAGE ASSESSMENT ──\n` +
        `Condition  : ${condition}\n` +
        `Risk Level : ${risk}\n` +
        `Confidence : ${confidence}\n\n` +
        `── REFERRAL RECOMMENDATION ──\n` +
        `Facility : ${dest}\n` +
        `Priority : ${risk === 'HIGH' ? 'URGENT — Within 24 hours' : 'Standard'}\n\n` +
        `───────────────────────────────\n` +
        `⚠ AI-assisted triage report.\n` +
        `Review by a Medical Officer is\n` +
        `required before clinical action.\n` +
        `═══════════════════════════════`;

      await Share.share({
        message: referralText,
        title: `Referral Slip — ${patient.patientName || caseRecord.id.substring(0, 6)}`,
      });
    } catch (err) {
      console.error('Export failed:', err);
      Alert.alert('Export Failed', 'Could not share the referral. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  if (!caseRecord) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[Fonts.bodyMd, { color: theme.textSecondary, marginTop: Spacing.md }]}>
          Loading referral details...
        </Text>
      </SafeAreaView>
    );
  }

  const riskLevel = caseRecord.triageResult?.finalRiskLevel || caseRecord.classificationResult?.riskLevel || 'moderate';
  const isHighRisk = riskLevel === 'high';
  const destinationName = recommendedFacility?.name || 'Sub-District Hospital (SDH) Rampur';
  const destinationDist = recommendedFacility?.distance ?? 14.2;
  const transitMins = recommendedFacility?.transitMinutesRural ?? 28;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.borderLight }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: 'transparent' }]} 
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: Spacing.xs }]} numberOfLines={1}>
            Referral Recommendation
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: theme.surfaceContainer }]}>
            <View style={[styles.statusDot, { backgroundColor: StitchColors.tertiaryContainer }]} />
            <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>OFFLINE</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: StitchColors.primary }]}>
            <MaterialIcons name="person" size={18} color={StitchColors.onPrimary} />
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 }}>
        
        {/* Patient Header Card */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
          <View style={styles.patientCardTop}>
            <View style={styles.patientInfo}>
              <View style={[styles.patientAvatar, { backgroundColor: theme.surfaceContainer }]}>
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyRU3o_UzR4nGh3AI1mE1yfHKHfqsu3dzXWiwpLNCGDhhn8nya3d9vv4OurXoSSXUEd6YM024JxlUWtU8OUKoZSYTuYtwZuxuzgUWAoh3cxWZTVv7Fq1hN1NIe49vmIbjrUcCHf1NQAxhrKXgdkhAwIu_hi_TAK0PVmP7RTpP8Qns4S4j_z-X5CSsaWnSaqqv3iDrNuBfRJpsQuX-ai_gkKIw9q2gRZsvhhmx9u3raLRFded3AzHPa' }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <View style={styles.patientDetails}>
                <View style={styles.patientNameRow}>
                  <Text style={[Fonts.headlineSm, { color: theme.text }]} numberOfLines={1}>
                    {caseRecord.patientMetadata.patientName || 'Sunita Devi'}
                  </Text>
                  <View style={[styles.agePill, { backgroundColor: theme.surfaceContainer }]}>
                    <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>
                      {caseRecord.patientMetadata.age || '48'}U
                    </Text>
                  </View>
                </View>
                <View style={styles.caseNumberRow}>
                  <MaterialIcons name="fingerprint" size={15} color={theme.border} />
                  <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginLeft: 4 }]}>
                    Case #{caseRecord.id.substring(0, 8).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.riskColumn}>
              <View style={[styles.riskBadge, { backgroundColor: isHighRisk ? StitchColors.errorContainer : StitchColors.secondaryContainer }]}>
                <MaterialIcons name="warning" size={14} color={isHighRisk ? StitchColors.onErrorContainer : StitchColors.onSecondaryContainer} />
                <Text style={[Fonts.labelSm, { color: isHighRisk ? StitchColors.onErrorContainer : StitchColors.onSecondaryContainer, marginLeft: 4 }]}>
                  {riskLevel.toUpperCase()} RISK
                </Text>
              </View>
              <Text style={[Fonts.labelSm, { color: theme.textSecondary, marginTop: 4 }]}>
                {caseRecord.triageResult?.predictedCondition || caseRecord.classificationResult?.predictedCondition || 'Diabetic Foot Ulcer'}
              </Text>
            </View>
          </View>
        </View>

        {/* Prominent Referral Decision Card */}
        {isHighRisk && (
          <View style={[styles.card, { backgroundColor: StitchColors.errorContainer, opacity: 0.9, gap: Spacing.md }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
              <View style={[styles.iconBox, { backgroundColor: StitchColors.error }]}>
                <MaterialIcons name="local-hospital" size={24} color={StitchColors.onError} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.labelSm, { color: StitchColors.error, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                  Triage Escalation Protocol
                </Text>
                <Text style={[Fonts.headlineSm, { color: StitchColors.onErrorContainer, marginTop: 2 }]}>
                  URGENT REFERRAL — SECONDARY / TERTIARY CARE REQUIRED
                </Text>
              </View>
            </View>

            <View style={[styles.urgencyBanner, { backgroundColor: theme.surfaceContainerLowest }]}>
              <MaterialIcons name="timer" size={20} color={StitchColors.error} />
              <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                <Text style={[Fonts.labelSm, { color: theme.border, textTransform: 'uppercase' }]}>Urgency Window</Text>
                <Text style={[Fonts.labelLg, { color: StitchColors.error }]}>Within 24 Hours (Transfer Priority: Mandatory)</Text>
              </View>
            </View>

            <View style={[styles.indicationsCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                <MaterialIcons name="description" size={18} color={StitchColors.primary} />
                <Text style={[Fonts.labelLg, { color: theme.text, marginLeft: 4 }]}>Clinical Indications for Immediate Transfer</Text>
              </View>
              <View style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: StitchColors.error }]} />
                <Text style={[Fonts.bodySm, { color: theme.text, flex: 1 }]}>
                  <Text style={{ fontWeight: '600' }}>Wagner Grade 2 Ulcer:</Text> Deep tissue penetration reaching tendon/joint capsule on Plantar 1st Metatarsal.
                </Text>
              </View>
              <View style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: StitchColors.error }]} />
                <Text style={[Fonts.bodySm, { color: theme.text, flex: 1 }]}>
                  <Text style={{ fontWeight: '600' }}>Ascending Cellulitis:</Text> Erythematous margin spreading {'>'}2.1 cm outward beyond wound perimeter.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Facility Tier & Destination Card */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest, gap: Spacing.md }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="local-hospital" size={20} color={StitchColors.primary} />
                  <Text style={[Fonts.labelSm, { color: StitchColors.primary, textTransform: 'uppercase', marginLeft: 4 }]}>
                    Recommended Destination
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.changeFacilityBtn}>
                  <MaterialIcons name="edit" size={16} color={StitchColors.primary} />
                  <Text style={[Fonts.labelSm, { color: StitchColors.primary, marginLeft: 2 }]}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={[Fonts.headlineSm, { color: theme.text, marginTop: 4 }]}>{destinationName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <MaterialIcons name="near-me" size={15} color={theme.border} />
                <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginLeft: 4 }]}>
                  {recommendedFacility?.type === 'Hospital' ? 'District Referral Hub' : 'Primary Health Facility'} • {destinationDist} km (Est. Transit: {transitMins} mins)
                </Text>
              </View>

              {userCoords ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 95, 80, 0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginTop: 6 }}>
                  <MaterialIcons name="my-location" size={13} color={StitchColors.primary} />
                  <Text style={[Fonts.labelSm, { color: StitchColors.primary, marginLeft: 4, fontSize: 11 }]}>
                    Based on your live GPS position ({userCoords.latitude.toFixed(3)}, {userCoords.longitude.toFixed(3)})
                  </Text>
                </View>
              ) : isLocating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.04)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginTop: 6 }}>
                  <ActivityIndicator size="small" color={StitchColors.primary} style={{ transform: [{ scale: 0.7 }] }} />
                  <Text style={[Fonts.labelSm, { color: theme.textSecondary, marginLeft: 4, fontSize: 11 }]}>
                    Acquiring live device GPS fix...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity onPress={handleRefreshLocation} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.04)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginTop: 6 }}>
                  <MaterialIcons name={isLocationNativeAvailable() ? "location-searching" : "domain"} size={13} color={theme.textSecondary} />
                  <Text style={[Fonts.labelSm, { color: theme.textSecondary, marginLeft: 4, fontSize: 11 }]}>
                    {isLocationNativeAvailable() ? 'Tap to enable live GPS routing' : 'Regional Facility Registry (Offline Routing)'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.checkCircle, { backgroundColor: theme.surfaceContainer }]}>
              <MaterialIcons name="verified" size={18} color={StitchColors.primary} />
            </View>
          </View>

          <ImageBackground
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASxL3RYZ0ZhsslMXYclwmUaeTJwzCyjdtEme9Iyp3PwSI-BKEEddhgR4Jy8fKta1VtR93agW0VWpY14v4aUmI5OiEhc6dPECRY6I-wM4vuaOxZWZB9ks4fyZZHcnNhTLgnZFYZbBytdgzcVrkLasjZJ5UulVs352SFIlCqiacYEcrJdRZgiBk0LZUfMjYf2ZcIjwtEucdAETqdnJSp3z1md_bzrc5M8sKx4wO6vXfAn2yQxKibcXpi' }}
            style={styles.mapSnippet}
            imageStyle={{ borderRadius: 8 }}
          >
            <View style={styles.mapOverlay} />
            <View style={styles.mapBottomRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="navigation" size={16} color={StitchColors.secondaryFixed} />
                <Text style={[Fonts.labelSm, { color: '#fff', marginLeft: 4 }]}>Corridor Route 7 (Clear)</Text>
              </View>
              <View style={{ backgroundColor: StitchColors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={[Fonts.labelSm, { color: StitchColors.onPrimary }]}>FASTEST TRANSIT</Text>
              </View>
            </View>
          </ImageBackground>

          <View style={{ gap: 6 }}>
            <Text style={[Fonts.labelSm, { color: theme.border, textTransform: 'uppercase' }]}>Key Available Capabilities</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['General Surgeon On-Duty', '24/7 Surgical Debridement', 'Blood Bank On-Site'].map(cap => (
                <View key={cap} style={[styles.chip, { backgroundColor: theme.surfaceContainer }]}>
                  <MaterialIcons name="check-circle" size={14} color={StitchColors.primary} />
                  <Text style={[Fonts.labelSm, { color: theme.textSecondary, marginLeft: 4 }]}>{cap}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.bypassBox, { backgroundColor: theme.surfaceContainer }]}>
            <MaterialIcons name="alt-route" size={18} color={theme.border} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[Fonts.labelSm, { color: theme.border, textTransform: 'uppercase' }]}>Bypass Protocol Rationale</Text>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>
                Primary Health Center (PHC Block B, 4.1 km) bypassed due to lack of inpatient surgical facilities and microbiological wound lab.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: theme.surfaceContainerHigh }]}
            onPress={() => Linking.openURL('tel:108')}
          >
            <MaterialIcons name="call" size={20} color={StitchColors.primary} />
            <Text style={[Fonts.labelLg, { color: StitchColors.primary, marginLeft: 8 }]}>Call Hospital Emergency Desk</Text>
          </TouchableOpacity>
        </View>

        {/* Official Referral Note */}
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest, overflow: 'hidden' }]}>
          <View style={[styles.documentNotch, { backgroundColor: StitchColors.primaryContainer }]} />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBoxSmall, { backgroundColor: theme.surfaceContainer }]}>
                <MaterialIcons name="receipt-long" size={18} color={StitchColors.primary} />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={[Fonts.headlineSm, { color: theme.text }]}>Official Triage Slip</Text>
                <Text style={[Fonts.labelSm, { color: theme.border }]}>REF-2024-891</Text>
              </View>
            </View>
            <View style={{ backgroundColor: 'rgba(0,95,80,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={[Fonts.labelSm, { color: StitchColors.primary, fontWeight: '600', textTransform: 'uppercase' }]}>Signed</Text>
            </View>
          </View>

          <View style={styles.clinicalDetails}>
            <View style={[styles.detailRow, { borderBottomColor: theme.surfaceContainer }]}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Predicted Condition</Text>
              <Text style={[Fonts.bodySm, { color: theme.text, fontWeight: '600' }]}>
                {caseRecord.triageResult?.predictedCondition || caseRecord.classificationResult?.predictedCondition || 'N/A'}
              </Text>
            </View>
            <View style={[styles.detailRow, { borderBottomColor: theme.surfaceContainer }]}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>AI Confidence</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="auto-awesome" size={14} color={StitchColors.primary} />
                <Text style={[Fonts.bodySm, { color: StitchColors.primary, fontWeight: '600', marginLeft: 4 }]}>
                  {caseRecord.triageResult?.conditionConfidence != null
                    ? `${Math.round(caseRecord.triageResult.conditionConfidence * 100)}%`
                    : (caseRecord.classificationResult?.confidence != null
                        ? `${Math.round(caseRecord.classificationResult.confidence * 100)}%`
                        : 'N/A')}
                </Text>
              </View>
            </View>
            <View style={[styles.detailRow, { borderBottomColor: theme.surfaceContainer, borderBottomWidth: 0 }]}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Risk Level</Text>
              <Text style={[Fonts.bodySm, { color: isHighRisk ? StitchColors.error : StitchColors.primary, fontWeight: '600' }]}>
                {riskLevel.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={[styles.cryptoFooter, { backgroundColor: theme.surfaceContainerLow }]}>
            <MaterialIcons name="info-outline" size={16} color={theme.textSecondary} />
            <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginLeft: 8, flex: 1, fontSize: 11 }]} numberOfLines={2}>
              AI-assisted triage report. Review by a Medical Officer is required before clinical action.
            </Text>
          </View>
        </View>

        {/* Export PDF Button */}
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: isPrinting ? theme.surfaceContainer : StitchColors.primaryContainer }]}
          onPress={handleExportPDF}
          disabled={isPrinting}
        >
          <MaterialIcons name="picture-as-pdf" size={18} color={isPrinting ? theme.textSecondary : StitchColors.onPrimaryContainer} />
          <Text style={[Fonts.labelMd, { color: isPrinting ? theme.textSecondary : StitchColors.onPrimaryContainer, marginLeft: 6 }]}>
            {isPrinting ? 'Generating PDF…' : 'Export Referral as PDF'}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.footer, { backgroundColor: theme.surface + 'F2' }]}>
        <TouchableOpacity
          style={[styles.finalizeButton, { backgroundColor: StitchColors.primary }]}
          onPress={() => router.push('/(tabs)' as any)}
        >
          <Text style={[Fonts.headlineSm, { color: StitchColors.onPrimary }]}>Finalize Case & Return to Dashboard</Text>
          <MaterialIcons name="arrow-forward" size={22} color={StitchColors.onPrimary} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>

      <Modal visible={showPicker} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
          <View style={styles.pickerHeader}>
            <Text style={[Fonts.headlineSm, { color: theme.text }]}>Select Facility</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: Spacing.md, flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
              <TextInput 
                style={[styles.pickerSearchBar, { backgroundColor: theme.surfaceContainer, color: theme.text }]} 
                placeholder="Search facility name or address..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={[styles.pickerOnlineBtn, { backgroundColor: userCoords ? 'rgba(0, 95, 80, 0.12)' : theme.surfaceContainer }]}
                onPress={handleRefreshLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color={StitchColors.primary} />
                ) : (
                  <MaterialIcons name="my-location" size={22} color={userCoords ? StitchColors.primary : theme.textSecondary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOnlineBtn, { backgroundColor: theme.surfaceContainer }]}
                onPress={handleOnlineSearch}
                disabled={isFetchingOnline}
              >
                {isFetchingOnline ? (
                  <ActivityIndicator size="small" color={StitchColors.primary} />
                ) : (
                  <MaterialIcons name="cloud-download" size={22} color={StitchColors.primary} />
                )}
              </TouchableOpacity>
            </View>
            <FlatList
              data={allFacilities.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.address?.toLowerCase().includes(searchQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: Spacing.xxl }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pickerFacilityItem, { borderBottomColor: theme.surfaceContainer }]} onPress={() => { setRecommendedFacility(item as any); setShowPicker(false); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerFacilityName, { color: theme.text }]}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 }}>
                      <Text style={[styles.pickerFacilityBadge, { backgroundColor: theme.surfaceContainerHigh, color: theme.textSecondary }]}>{item.type}</Text>
                      {item.distance != null && <Text style={[styles.pickerFacilityMeta, { color: theme.textSecondary }]}>{item.distance} km</Text>}
                    </View>
                    <Text style={[styles.pickerFacilityMeta, { color: theme.textSecondary, marginTop: 4 }]} numberOfLines={1}>{item.address}</Text>
                  </View>
                  {item.id === recommendedFacility?.id && <MaterialIcons name="check-circle" size={24} color={StitchColors.primary} style={styles.pickerSelectedCheck} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  patientCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  patientDetails: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  agePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  caseNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  riskColumn: {
    alignItems: 'flex-end',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  indicationsCard: {
    padding: Spacing.md,
    borderRadius: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapSnippet: {
    width: '100%',
    height: 128,
    justifyContent: 'flex-end',
    padding: 10,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  mapBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  bypassBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
  },
  ctaButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  documentNotch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  iconBoxSmall: {
    width: 28,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatoriesGrid: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  clinicalDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  cryptoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
  },
  shareGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shareButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  finalizeButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  changeFacilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 95, 80, 0.1)', // slightly tinted primary
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pickerSearchBar: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  pickerOnlineBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerFacilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  pickerFacilityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerFacilityBadge: {
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pickerFacilityMeta: {
    fontSize: 14,
  },
  pickerSelectedCheck: {
    marginLeft: Spacing.md,
  }
});

