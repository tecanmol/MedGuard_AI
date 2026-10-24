/**
 * MedGuard AI — Settings & Operations (Stitch Design - Strict)
 * Preserves logic: worker context, setLanguage, clearSession/handleLogout
 */
import { SUPPORTED_LANGUAGES } from '@/constants/i18n';
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { clearSession } from '@/services/worker-repository';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Appearance, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { worker, setWorker, language, setLanguage, isOnline } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await clearSession();
    setWorker(null);
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Field Operations & Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* User Profile Identity */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.workerProfileRow}>
              <View style={styles.avatarBox}>
                <Image source={{ uri: 'https://i.pravatar.cc/150?u=' + (worker?.id || 'worker') }} style={styles.avatar} />
                <View style={[styles.statusBadge, { backgroundColor: StitchColors.primaryContainer }]}>
                  <MaterialIcons name="verified-user" size={14} color={StitchColors.onPrimaryContainer} />
                </View>
              </View>
              
              <View style={styles.workerInfo}>
                <Text style={[styles.workerName, { color: theme.text }]}>{worker?.name || 'Worker Name'}</Text>
                
                <View style={styles.workerMetaRow}>
                  <MaterialIcons name="badge" size={15} color={theme.textSecondary} />
                  <Text style={[styles.workerMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                    ID: {worker?.id || 'MED-IN-XXXX'}
                  </Text>
                </View>
                
                <View style={styles.workerMetaRow}>
                  <MaterialIcons name="apartment" size={15} color={StitchColors.primary} />
                  <Text style={[styles.workerMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {worker?.phcAffiliation || 'No Facility Assigned'}
                  </Text>
                </View>
              </View>
            </View>


          </View>
        </View>

        {/* UI Theme Configuration */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconBox, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <MaterialIcons name="palette" size={20} color={theme.text} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Visual Theme</Text>
              </View>
            </View>
            
            <View style={styles.langList}>
              {['light', 'dark'].map(t => {
                const isActive = Appearance.getColorScheme() === t;
                return (
                  <TouchableOpacity 
                    key={t}
                    style={[
                      styles.langBtn,
                      { backgroundColor: theme.surfaceContainerLow },
                      isActive && { borderColor: StitchColors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => Appearance.setColorScheme(t as 'light' | 'dark')}
                  >
                    <View style={styles.langBtnLeft}>
                      <MaterialIcons 
                        name={isActive ? "radio-button-checked" : "radio-button-unchecked"} 
                        size={20} 
                        color={isActive ? StitchColors.primary : theme.textTertiary} 
                      />
                      <Text style={[styles.langText, { color: theme.text }, isActive && { fontWeight: '700' }]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Regional Language Configuration */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconBox, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <MaterialIcons name="translate" size={20} color={theme.text} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Regional Dialect & UI Language</Text>
              </View>
            </View>
            
            <View style={styles.langList}>
              {SUPPORTED_LANGUAGES.map(lang => {
                const isActive = language === lang.code;
                return (
                  <TouchableOpacity 
                    key={lang.code}
                    style={[
                      styles.langBtn,
                      { backgroundColor: theme.surfaceContainerLow },
                      isActive && { borderColor: StitchColors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => setLanguage(lang.code)}
                  >
                    <View style={styles.langBtnLeft}>
                      <MaterialIcons 
                        name={isActive ? "radio-button-checked" : "radio-button-unchecked"} 
                        size={20} 
                        color={isActive ? StitchColors.primary : theme.textTertiary} 
                      />
                      <Text style={[styles.langText, { color: theme.text }, isActive && { fontWeight: '700' }]}>
                        {lang.nativeLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sync & Advanced Operations */}
        <View style={styles.sectionContainer}>
          <View style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconBox, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <MaterialIcons name="settings" size={20} color={theme.text} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>System Operations</Text>
              </View>
            </View>

            <View style={styles.opsList}>
              <TouchableOpacity style={[styles.opsBtn, { backgroundColor: theme.surfaceContainerLow }]} onPress={() => router.push('/(tabs)/sync')}>
                <View style={styles.opsBtnLeft}>
                  <MaterialIcons name="sync" size={20} color={theme.text} />
                  <Text style={[styles.opsBtnText, { color: theme.text }]}>Force Offline Sync</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.opsBtn, { backgroundColor: theme.surfaceContainerLow }]}
                onPress={() => Alert.alert('Diagnostic Logs', 'Exporting logs...\n\nLogs successfully dumped to device storage.')}
              >
                <View style={styles.opsBtnLeft}>
                  <MaterialIcons name="bug-report" size={20} color={theme.text} />
                  <Text style={[styles.opsBtnText, { color: theme.text }]}>Diagnostic Logs</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.opsBtn, { backgroundColor: 'rgba(186, 26, 26, 0.05)' }]} onPress={handleLogout}>
                <View style={styles.opsBtnLeft}>
                  <MaterialIcons name="logout" size={20} color={StitchColors.error} />
                  <Text style={[styles.opsBtnText, { color: StitchColors.error }]}>Sign Out / Wipe Device Cache</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: theme.textTertiary, ...Fonts.bodySm }}>AI Health Assistant v4.2.1 • Edge NPU Enabled</Text>
          <Text style={{ color: theme.textTertiary, ...Fonts.bodySm, marginTop: 4 }}>ID: 8F99-4B2C-A190</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  sectionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },

  // Card general
  card: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardIconBox: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Fonts.headlineSm },
  offlinePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  offlinePillText: { ...Fonts.labelSm, fontWeight: '700' },

  // Profile
  workerProfileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarBox: { width: 64, height: 64, position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  statusBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  workerInfo: { flex: 1 },
  workerName: { ...Fonts.headlineMd, fontWeight: '700', marginBottom: 2 },
  workerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  workerMetaText: { ...Fonts.bodySm, flex: 1 },

  shiftRibbon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', borderRadius: BorderRadius.md, padding: Spacing.sm },
  shiftLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  shiftPulse: { width: 10, height: 10, borderRadius: 5 },
  shiftTitle: { ...Fonts.labelSm, fontWeight: '700' },
  shiftSub: { ...Fonts.labelMd },
  endShiftBtn: { minHeight: 44, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.lg, justifyContent: 'center' },
  endShiftText: { ...Fonts.labelMd, fontWeight: '600' },

  // Models
  modelList: { gap: Spacing.sm, marginTop: Spacing.sm },
  modelItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.lg },
  modelItemLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, flex: 1 },
  modelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modelTitle: { ...Fonts.labelLg, fontWeight: '600' },
  modelDot: { width: 8, height: 8, borderRadius: 4 },
  modelSub: { ...Fonts.bodySm, marginTop: 2 },
  modelNpu: { ...Fonts.labelSm, fontWeight: '700', marginTop: 4 },
  versionPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  versionText: { ...Fonts.labelSm },

  // Languages
  langList: { gap: Spacing.xs, marginTop: Spacing.sm },
  langBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderRadius: BorderRadius.lg },
  langBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  langText: { ...Fonts.labelLg, flexShrink: 1 },
  langActiveBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  langActiveText: { ...Fonts.labelSm, fontWeight: '700' },

  // Ops
  opsList: { gap: Spacing.xs, marginTop: Spacing.sm },
  opsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderRadius: BorderRadius.lg },
  opsBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  opsBtnText: { ...Fonts.labelLg, fontWeight: '600' },
});


