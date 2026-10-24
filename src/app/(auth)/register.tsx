import { t } from '@/constants/i18n';
import { BorderRadius, Spacing, StatusColors, StitchColors, Fonts } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { getAllFacilities, type ExtendedFacility } from '@/services/facility-repository';
import { registerWorker, saveSession } from '@/services/worker-repository';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [phone, setPhone] = useState('');
  const [phc, setPhc] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enclaveChecked, setEnclaveChecked] = useState(true);
  const [pinVisible, setPinVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [allFacilities, setAllFacilities] = useState<ExtendedFacility[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { setWorker, language } = useApp();
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    setAllFacilities(getAllFacilities());
  }, []);

  const handleRegister = async () => {
    if (pin !== confirmPin) {
      setError(t(language, 'register', 'pin_mismatch'));
      return;
    }
    if (!name || !workerId || !phone || !phc || !pin) {
      setError(t(language, 'common', 'required'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const worker = await registerWorker(
        {
          id: workerId,
          name,
          phone,
          phcAffiliation: phc,
          language: language,
        },
        pin,
      );
      await saveSession(worker.id);
      setWorker(worker);
      router.replace('/(tabs)');
    } catch (e) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'transparent' }]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[Fonts.headlineSm, { color: theme.text, marginLeft: 4 }]}>
            Register
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.offlineBadge, { backgroundColor: theme.surfaceContainer }]}>
            <View style={styles.pulseDot} />
            <Text style={[Fonts.labelSm, { color: theme.textSecondary }]}>OFFLINE</Text>
          </View>
          <View style={[styles.userAvatar, { backgroundColor: StitchColors.primary }]}>
            <MaterialIcons name="person" size={18} color={StitchColors.onPrimary} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Top Info */}
          <View style={styles.topInfo}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.surfaceContainerHigh }]}>
                <MaterialIcons name="shield" size={14} color={StitchColors.primary} />
                <Text style={[Fonts.labelSm, { color: theme.textSecondary, textTransform: 'uppercase' }]}>Local Auth</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.surfaceContainerHigh }]}>
                <MaterialIcons name="lock" size={14} color={StitchColors.primary} />
                <Text style={[Fonts.labelSm, { color: theme.textSecondary, textTransform: 'uppercase' }]}>AES-256 On-Device</Text>
              </View>
            </View>
            <Text style={[Fonts.headlineLg, { color: theme.text, marginTop: Spacing.sm }]}>
              Worker Account Registration
            </Text>
            <Text style={[Fonts.bodyMd, { color: theme.textSecondary, marginTop: 4 }]}>
              Enroll field credentials for encrypted offline triage
            </Text>
          </View>

          {/* Identity Sync Card */}
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={[styles.cardIconBox, { backgroundColor: theme.surfaceContainer }]}>
              <MaterialIcons name="verified-user" size={22} color={StitchColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.labelLg, { color: theme.text }]}>Offline-Ready Identity Sync</Text>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>
                Your profile is sealed locally in Android Keystore. Zero data leaves device without physical sync confirmation.
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>Full Name (Clinical Designation)</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="badge" size={20} color="#6e7a75" style={styles.inputLeftIcon} />
                <TextInput
                  style={[styles.input, Fonts.bodyMd, { backgroundColor: theme.surfaceContainerLowest, color: theme.text }]}
                  placeholder="Sister Kavita Rao"
                  placeholderTextColor="#6e7a75"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Worker ID */}
            <View style={styles.inputGroup}>
              <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>Worker Registry ID (ABHA / NHM)</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="fingerprint" size={20} color="#6e7a75" style={styles.inputLeftIcon} />
                <TextInput
                  style={[styles.input, Fonts.bodyMd, { backgroundColor: theme.surfaceContainerLowest, color: theme.text, textTransform: 'uppercase' }]}
                  placeholder="HW-9021-UP"
                  placeholderTextColor="#6e7a75"
                  value={workerId}
                  onChangeText={setWorkerId}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={[styles.inputRightBtn, { backgroundColor: theme.surfaceContainer }]}>
                  <MaterialIcons name="qr-code-scanner" size={20} color={StitchColors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>Mobile Contact (SMS Verification)</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="phone-in-talk" size={20} color="#6e7a75" style={styles.inputLeftIcon} />
                <TextInput
                  style={[styles.input, Fonts.bodyMd, { backgroundColor: theme.surfaceContainerLowest, color: theme.text }]}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#6e7a75"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Facility */}
            <View style={styles.inputGroup}>
              <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>Assigned Health Facility / PHC Block</Text>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowPicker(true)}>
                <MaterialIcons name="local-hospital" size={20} color="#6e7a75" style={styles.inputLeftIcon} />
                <TextInput
                  style={[styles.input, Fonts.bodyMd, { backgroundColor: theme.surfaceContainerLowest, color: theme.text }]}
                  placeholder="Select your assigned facility"
                  placeholderTextColor="#6e7a75"
                  value={phc}
                  editable={false}
                  pointerEvents="none"
                />
                <MaterialIcons name="expand-more" size={20} color="#6e7a75" style={styles.inputRightIcon} />
              </TouchableOpacity>
            </View>

            {/* Clinical Access PIN */}
            <View style={[styles.pinCard, { backgroundColor: theme.surfaceContainerLowest }]}>
              <View style={styles.pinHeader}>
                <Text style={[Fonts.labelLg, { color: theme.text }]}>Clinical Access PIN</Text>
                <Text style={[Fonts.labelSm, { color: StitchColors.primary, textTransform: 'uppercase', fontWeight: 'bold' }]}>Required for Offline Auth</Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.pinHeader}>
                  <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>4-Digit Security PIN</Text>
                  <TouchableOpacity onPress={() => setPinVisible(!pinVisible)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name={pinVisible ? "visibility-off" : "visibility"} size={16} color={StitchColors.primary} />
                    <Text style={[Fonts.labelSm, { color: StitchColors.primary }]}>{pinVisible ? "Hide" : "Show"}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.pinInput, Fonts.headlineMd, { backgroundColor: theme.surfaceContainer, color: StitchColors.primary }]}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry={!pinVisible}
                  textAlign="center"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[Fonts.labelMd, { color: theme.textSecondary }]}>Confirm 4-Digit Security PIN</Text>
                <TextInput
                  style={[styles.pinInput, Fonts.headlineMd, { backgroundColor: theme.surfaceContainer, color: StitchColors.primary }]}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry={!pinVisible}
                  textAlign="center"
                />
              </View>
            </View>

            {/* Hardware Enclave */}
            <TouchableOpacity 
              style={[styles.checkboxCard, { backgroundColor: theme.surfaceContainerLowest }]}
              onPress={() => setEnclaveChecked(!enclaveChecked)}
            >
              <View style={[styles.checkbox, { backgroundColor: enclaveChecked ? StitchColors.primary : theme.surfaceContainer }]}>
                {enclaveChecked && <MaterialIcons name="check" size={16} color={StitchColors.onPrimary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.labelMd, { color: theme.text }]}>Bind credentials to hardware enclave</Text>
                <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>
                  Enables instant biometric unlock (Fingerprint / Face ID) even without cellular connection.
                </Text>
              </View>
            </TouchableOpacity>

            {error ? (
              <Text style={[Fonts.bodySm, { color: StatusColors.error, textAlign: 'center' }]}>{error}</Text>
            ) : null}

            {/* Submit */}
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: StitchColors.primary }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={StitchColors.onPrimary} />
              ) : (
                <>
                  <Text style={[Fonts.labelLg, { color: StitchColors.onPrimary }]}>Complete Registration & Launch Field App</Text>
                  <MaterialIcons name="arrow-forward" size={18} color={StitchColors.onPrimary} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.textButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={18} color={StitchColors.primary} />
              <Text style={[Fonts.labelMd, { color: StitchColors.primary, marginLeft: 4 }]}>Already registered? Return to Worker Sign In</Text>
            </TouchableOpacity>

          </View>

          {/* Support */}
          <View style={[styles.supportCard, { backgroundColor: theme.surfaceContainerLow }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <MaterialIcons name="support-agent" size={20} color={StitchColors.primary} />
              <Text style={[Fonts.labelMd, { textTransform: 'uppercase', color: theme.text }]}>Field Support Desk</Text>
            </View>
            
            <View style={styles.supportRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>NHM Helpdesk (Toll Free)</Text>
              <Text style={[Fonts.labelSm, { color: theme.text, fontWeight: 'bold' }]}>1800-180-1104</Text>
            </View>
            <View style={styles.supportRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>District Registry Node</Text>
              <Text style={[Fonts.labelSm, { color: theme.text, fontWeight: 'bold' }]}>UP-LKO-04</Text>
            </View>
            <View style={styles.supportRow}>
              <Text style={[Fonts.bodySm, { color: theme.textSecondary }]}>Compliance Framework</Text>
              <Text style={[Fonts.labelSm, { color: theme.text, fontWeight: 'bold' }]}>ABDM M3 Certified</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
          <View style={styles.pickerHeader}>
            <Text style={[Fonts.headlineSm, { color: theme.text }]}>Select Facility</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: Spacing.md, flex: 1 }}>
            <TextInput 
              style={[styles.pickerSearchBar, { backgroundColor: theme.surfaceContainer, color: theme.text, marginBottom: Spacing.md }]} 
              placeholder="Search facility name or address..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={allFacilities.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.address?.toLowerCase().includes(searchQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: Spacing.xxl }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pickerFacilityItem, { borderBottomColor: theme.surfaceContainer }]} onPress={() => { setPhc(item.name); setShowPicker(false); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerFacilityName, { color: theme.text }]}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 }}>
                      <Text style={[styles.pickerFacilityBadge, { backgroundColor: theme.surfaceContainerHigh, color: theme.textSecondary }]}>{item.type}</Text>
                      {item.distance != null && <Text style={[styles.pickerFacilityMeta, { color: theme.textSecondary }]}>{item.distance} km</Text>}
                    </View>
                    <Text style={[styles.pickerFacilityMeta, { color: theme.textSecondary, marginTop: 4 }]} numberOfLines={1}>{item.address}</Text>
                  </View>
                  {item.name === phc && <MaterialIcons name="check-circle" size={24} color={StitchColors.primary} style={styles.pickerSelectedCheck} />}
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
  container: { flex: 1 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: 4,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3a766a', // tertiary-container from html
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 48,
  },
  topInfo: {
    marginBottom: Spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  card: {
    padding: Spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputLeftIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  inputRightIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  inputRightBtn: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 16,
  },
  pinCard: {
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinInput: {
    height: 52,
    borderRadius: 12,
    padding: 12,
    letterSpacing: 8,
  },
  checkboxCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: 14,
    borderRadius: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
  },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  supportCard: {
    marginTop: 32,
    padding: Spacing.md,
    borderRadius: 12,
    gap: 10,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    height: 48,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
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

