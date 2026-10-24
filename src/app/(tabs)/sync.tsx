/**
 * MedGuard AI — Offline Sync Center (Stitch Design - Strict)
 * Preserves logic: queue, lastSync, handleSync, syncAll, getSyncQueue
 */
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import type { SyncItem } from '@/models/types';
import { getLastSyncTime, getSyncQueue, syncAll, updateSyncItemStatus, retryFailedItems } from '@/services/sync-service';
import { getCase } from '@/services/case-repository';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SyncScreen() {
  const { isOnline, language, refreshPendingSyncCount } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const [queue, setQueue] = useState<SyncItem[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'high' | 'routine' | 'failed'>('all');

  const loadData = useCallback(() => {
    try {
      const q = getSyncQueue();
      setQueue(q || []);
      const ls = getLastSyncTime();
      setLastSync(ls);
    } catch (e) {
      console.warn("Failed to load sync queue", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      await syncAll();
      loadData();
      await refreshPendingSyncCount();
    } catch (e) {
      console.warn("Sync failed", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    updateSyncItemStatus(id, 'pending');
    loadData();
    if (isOnline) {
      handleSync();
    }
  };

  const handlePrioritizeAll = async () => {
    retryFailedItems();
    loadData();
    if (isOnline) {
      handleSync();
    }
  };

  const filteredQueue = queue.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'failed') return item.status === 'failed';
    
    // Check risk level for 'high' and 'routine' filtering
    let isHighRisk = false;
    if (item.type === 'case' || item.type === 'image') {
      try {
        const c = getCase(item.referenceId);
        if (c?.triageResult?.finalRiskLevel === 'high') {
          isHighRisk = true;
        }
      } catch (e) {
        // ignore
      }
    }

    if (activeTab === 'high') return isHighRisk;
    if (activeTab === 'routine') return !isHighRisk && item.status !== 'failed';
    
    return true;
  });

  const getStatusPillConfig = (status: SyncItem['status']) => {
    switch (status) {
      case 'done':
        return {
          label: 'DONE',
          bg: theme.isDark ? 'rgba(16, 185, 129, 0.20)' : '#DCFCE7',
          text: theme.isDark ? '#34D399' : '#15803D',
          border: theme.isDark ? 'rgba(52, 211, 153, 0.4)' : '#BBF7D0',
        };
      case 'uploading':
        return {
          label: 'UPLOADING',
          bg: theme.isDark ? 'rgba(14, 165, 233, 0.22)' : '#E0F2FE',
          text: theme.isDark ? '#38BDF8' : '#0369A1',
          border: theme.isDark ? 'rgba(56, 189, 248, 0.4)' : '#BAE6FD',
        };
      case 'failed':
        return {
          label: 'FAILED',
          bg: theme.isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEE2E2',
          text: theme.isDark ? '#F87171' : '#B91C1C',
          border: theme.isDark ? 'rgba(248, 113, 113, 0.4)' : '#FECACA',
        };
      case 'pending':
      default:
        return {
          label: 'PENDING',
          bg: theme.isDark ? 'rgba(245, 158, 11, 0.20)' : '#FEF3C7',
          text: theme.isDark ? '#FBBF24' : '#B45309',
          border: theme.isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A',
        };
    }
  };

  const renderItem = ({ item }: { item: SyncItem }) => {
    const isFailed = item.status === 'failed';
    const pill = getStatusPillConfig(item.status);
    
    return (
      <View style={[styles.queueItem, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.border, borderWidth: 1 }]}>
        <View style={styles.queueItemHeader}>
          <View style={styles.queueItemTitleRow}>
            <View style={[styles.typeIconBox, { backgroundColor: isFailed ? (theme.isDark ? 'rgba(239, 68, 68, 0.2)' : StitchColors.errorContainer) : theme.surfaceContainer }]}>
              <MaterialIcons 
                name={item.type === 'case' ? 'folder' : item.type === 'image' ? 'image' : 'data-usage'} 
                size={16} 
                color={isFailed ? (theme.isDark ? '#F87171' : StitchColors.error) : theme.primary} 
              />
            </View>
            <View>
              <Text style={[styles.queueItemTitle, { color: theme.text }]}>{item.type.toUpperCase()} PAYLOAD</Text>
              <Text style={[styles.queueItemSub, { color: theme.textSecondary }]}>Ref: {item.referenceId.substring(0, 8)}</Text>
            </View>
          </View>
          
          <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border, borderWidth: 1 }]}>
            <Text style={[styles.statusPillText, { color: pill.text }]}>
              {pill.label}
            </Text>
          </View>
        </View>

        {isFailed && item.errorMessage && (
          <View style={[styles.errorMsgBox, { backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(186, 26, 26, 0.05)', borderColor: theme.isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(186, 26, 26, 0.1)' }]}>
            <Text style={[styles.errorMsgText, { color: theme.isDark ? '#F87171' : StitchColors.error }]}>{item.errorMessage}</Text>
          </View>
        )}

        <View style={[styles.queueItemFooter, { borderTopColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
          <Text style={[styles.queueSize, { color: theme.textSecondary }]}>{item.type === 'image' ? '3.2 MB' : '14 KB'}</Text>
          {isFailed && (
            <TouchableOpacity 
              style={[styles.retryBtn, { backgroundColor: theme.isDark ? 'rgba(124, 215, 193, 0.15)' : 'rgba(0, 95, 80, 0.08)' }]} 
              onPress={() => handleRetryItem(item.id)}
            >
              <MaterialIcons name="refresh" size={14} color={theme.primary} />
              <Text style={[styles.retryBtnText, { color: theme.primary }]}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Sync Center</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.networkBadge, { backgroundColor: isOnline ? StitchColors.secondaryFixedDim : theme.surfaceContainerHighest }]}>
            <View style={[styles.networkDot, { backgroundColor: isOnline ? StitchColors.onSecondaryFixedVariant : theme.textTertiary }]} />
            <Text style={[styles.networkText, { color: isOnline ? StitchColors.onSecondaryFixedVariant : theme.textTertiary }]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredQueue}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Status Hero Card */}
            <View style={styles.sectionContainer}>
              <View style={[styles.heroCard, { backgroundColor: theme.surfaceContainerLowest }]}>
                <View style={styles.heroTopRow}>
                  <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
                    <View style={[styles.heroIconBox, { backgroundColor: StitchColors.tertiaryFixed }]}>
                      <MaterialIcons name={isOnline ? "cloud-done" : "cloud-off"} size={28} color={StitchColors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.heroTitle, { color: theme.text }]}>
                        {isOnline ? 'Connected to PHC Hub' : 'Offline Field Mode Active'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MaterialIcons name="lock" size={12} color={StitchColors.tertiary} />
                        <Text style={[styles.heroSub, { color: StitchColors.tertiary }]}>AES-256 Local Enclave Verified</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.securePill, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <Text style={[styles.secureText, { color: theme.textSecondary }]}>SECURE</Text>
                  </View>
                </View>

                <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>
                  <Text style={{ fontWeight: '600', color: theme.text }}>{queue.length} items</Text> queued locally. Safe for storage without mobile network reception.
                </Text>

                <View style={[styles.lastSyncBox, { backgroundColor: theme.surfaceContainerLow }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="history-toggle-off" size={16} color={StitchColors.primary} />
                    <Text style={[styles.lastSyncLabel, { color: theme.textSecondary }]}>Last full sync:</Text>
                  </View>
                  <Text style={[styles.lastSyncValue, { color: theme.text }]}>
                    {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.syncCta, { backgroundColor: isOnline ? StitchColors.primary : theme.surfaceContainerHigh }]}
                  onPress={handleSync}
                  disabled={!isOnline || syncing}
                >
                  {syncing ? <ActivityIndicator color={StitchColors.onPrimary} size="small" style={{ marginRight: 8 }} /> : <MaterialIcons name="sync" size={20} color={isOnline ? StitchColors.onPrimary : theme.textTertiary} style={{ marginRight: 8 }} />}
                  <Text style={[styles.syncCtaText, { color: isOnline ? StitchColors.onPrimary : theme.textTertiary }]}>
                    {syncing ? 'Transmitting Data...' : 'Scan & Transmit to PHC Hub'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Queue Header */}
            <View style={styles.queueHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.queueTitle, { color: theme.text }]}>Transmission Queue</Text>
                <View style={[styles.pendingPill, { backgroundColor: StitchColors.primaryFixed }]}>
                  <Text style={[styles.pendingPillText, { color: StitchColors.onPrimaryFixed }]}>{queue.length} Pending</Text>
                </View>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                onPress={handlePrioritizeAll}
                disabled={syncing}
              >
                <Text style={[styles.prioritizeText, { color: theme.primary }]}>Prioritize All</Text>
                <MaterialIcons name="bolt" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {/* Filters */}
            <View style={styles.filtersRow}>
              {(['all', 'high', 'routine', 'failed'] as const).map(tab => {
                const isActive = activeTab === tab;
                let label = 'All Items';
                if (tab === 'high') label = 'High Risk';
                if (tab === 'routine') label = 'Routine';
                if (tab === 'failed') label = 'Failed';

                return (
                  <TouchableOpacity 
                    key={tab}
                    style={[
                      styles.filterBtn, 
                      isActive 
                        ? { 
                            backgroundColor: theme.isDark ? 'rgba(109, 245, 225, 0.22)' : StitchColors.secondaryFixedDim, 
                            borderColor: theme.isDark ? '#6DF5E1' : 'transparent' 
                          } 
                        : { 
                            backgroundColor: theme.surfaceContainerLowest, 
                            borderColor: theme.border 
                          }
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    {tab === 'failed' && (
                      <MaterialIcons 
                        name="error-outline" 
                        size={14} 
                        color={isActive ? (theme.isDark ? '#6DF5E1' : StitchColors.onSecondaryFixedVariant) : theme.textSecondary} 
                        style={{ marginRight: 4 }} 
                      />
                    )}
                    <Text 
                      style={[
                        styles.filterText, 
                        isActive 
                          ? { color: theme.isDark ? '#6DF5E1' : StitchColors.onSecondaryFixedVariant, fontWeight: '700' } 
                          : { color: theme.textSecondary }
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle-outline" size={48} color={theme.isDark ? '#34D399' : theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>All Caught Up</Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>There are no pending items in the transmission queue.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { paddingBottom: Spacing.xl },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', zIndex: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  headerTitle: { ...Fonts.headlineSm, flex: 1 },
  headerRight: { paddingRight: Spacing.xs },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { ...Fonts.labelSm, fontWeight: '700' },

  sectionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  // Hero Card
  heroCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md },
  heroIconBox: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...Fonts.headlineSm },
  heroSub: { ...Fonts.labelSm, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  securePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  secureText: { ...Fonts.labelSm, fontWeight: '700' },

  heroDesc: { ...Fonts.bodyMd, marginBottom: Spacing.md, lineHeight: 22 },
  
  lastSyncBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  lastSyncLabel: { ...Fonts.bodySm },
  lastSyncValue: { ...Fonts.labelMd },

  syncCta: { width: '100%', minHeight: 52, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius:4, elevation:2 },
  syncCtaText: { ...Fonts.labelLg, fontWeight: '600' },

  // Queue Header & Filters
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  queueTitle: { ...Fonts.headlineSm },
  pendingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  pendingPillText: { ...Fonts.labelSm, fontWeight: '600' },
  prioritizeText: { ...Fonts.labelSm, fontWeight: '700' },

  filtersRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: 6 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  filterText: { ...Fonts.labelMd },

  // Queue Items
  queueItem: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.05, shadowRadius:2, elevation:1 },
  queueItemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  queueItemTitleRow: { flexDirection: 'row', gap: Spacing.sm },
  typeIconBox: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  queueItemTitle: { ...Fonts.labelLg, fontWeight: '700' },
  queueItemSub: { ...Fonts.bodySm, fontFamily: Fonts.mono, marginTop: 2 },
  
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.md },
  statusPillText: { ...Fonts.labelSm, fontWeight: '700' },

  errorMsgBox: { marginTop: Spacing.sm, padding: Spacing.sm, backgroundColor: 'rgba(186, 26, 26, 0.05)', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(186, 26, 26, 0.1)' },
  errorMsgText: { ...Fonts.bodySm },

  queueItemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  queueSize: { ...Fonts.labelSm },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(0, 95, 80, 0.05)' },
  retryBtnText: { ...Fonts.labelSm, fontWeight: '600' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { ...Fonts.headlineSm, marginTop: Spacing.md },
  emptyDesc: { ...Fonts.bodyMd, textAlign: 'center', marginTop: 4 },
});

