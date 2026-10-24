import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { t } from '@/constants/i18n';
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import type { CaseRecord } from '@/models/types';
import { searchCases } from '@/services/case-repository';
import { getAllFacilities, type ExtendedFacility } from '@/services/facility-repository';

export default function HistoryScreen() {
  const { language, worker } = useApp();
  const theme = useTheme();
  const router = useRouter();

  // Search input state (typing does NOT trigger database lookups on every keystroke)
  const [searchTextInput, setSearchTextInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // Raw records loaded from SQLite repository
  const [cases, setCases] = useState<CaseRecord[]>([]);

  // Filter states
  const [activeRiskFilter, setActiveRiskFilter] = useState<'all' | 'high' | 'moderate' | 'low'>('all');
  const [selectedFacility, setSelectedFacility] = useState<string>('All');
  const [dateFilterChoice, setDateFilterChoice] = useState<'latest' | 'oldest' | 'today' | 'week' | 'month'>('latest');

  // Modal dialog states
  const [showDateModal, setShowDateModal] = useState(false);
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilitySearchQuery, setFacilitySearchQuery] = useState('');

  // Cached facilities registry
  const [facilitiesList, setFacilitiesList] = useState<ExtendedFacility[]>([]);

  // Load cases from repository based on active committed search query
  const loadData = useCallback(() => {
    try {
      const results = searchCases({ query: activeSearchQuery || undefined });
      setCases(results || []);
    } catch (e) {
      console.warn('Failed to load case history:', e);
    }
  }, [activeSearchQuery]);

  // Load cached facility registry once on mount
  useEffect(() => {
    try {
      const facs = getAllFacilities();
      setFacilitiesList(facs || []);
    } catch (e) {
      console.warn('Failed to load facilities:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Search execution handlers
  const handleExecuteSearch = () => {
    setActiveSearchQuery(searchTextInput.trim());
  };

  const handleClearSearch = () => {
    setSearchTextInput('');
    setActiveSearchQuery('');
  };

  // Derive unique facility list across registered facilities, cases, and worker affiliation
  const uniqueFacilities = useMemo(() => {
    const facNames = new Set<string>();
    if (worker?.phcAffiliation) {
      facNames.add(worker.phcAffiliation);
    }
    for (const fac of facilitiesList) {
      if (fac.name) facNames.add(fac.name);
    }
    for (const c of cases) {
      if (c.referralInfo?.nearbyFacilities) {
        for (const f of c.referralInfo.nearbyFacilities) {
          if (f.name) facNames.add(f.name);
        }
      }
    }
    return Array.from(facNames).sort((a, b) => a.localeCompare(b));
  }, [facilitiesList, cases, worker?.phcAffiliation]);

  const filteredModalFacilities = useMemo(() => {
    if (!facilitySearchQuery.trim()) return uniqueFacilities;
    const q = facilitySearchQuery.toLowerCase();
    return uniqueFacilities.filter((f) => f.toLowerCase().includes(q));
  }, [uniqueFacilities, facilitySearchQuery]);

  // Real-time risk distribution count
  const riskCounts = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;

    for (const c of cases) {
      const risk = (c.triageResult?.finalRiskLevel || c.classificationResult?.riskLevel || 'low').toLowerCase();
      if (risk === 'high') high++;
      else if (risk === 'moderate') moderate++;
      else if (risk === 'low') low++;
    }

    return {
      all: cases.length,
      high,
      moderate,
      low,
    };
  }, [cases]);

  // Filter and sort the cases
  const filteredCases = useMemo(() => {
    const result = cases.filter((item) => {
      // 1. Risk Tier Filter
      if (activeRiskFilter !== 'all') {
        const itemRisk = (item.triageResult?.finalRiskLevel || item.classificationResult?.riskLevel || 'low').toLowerCase();
        if (itemRisk !== activeRiskFilter) {
          return false;
        }
      }

      // 2. Facility Filter
      if (selectedFacility !== 'All') {
        const target = selectedFacility.toLowerCase();
        const primaryDest = item.referralInfo?.nearbyFacilities?.[0]?.name?.toLowerCase();
        const anyNearbyMatch = item.referralInfo?.nearbyFacilities?.some(
          (f) => f.name.toLowerCase() === target
        );
        const workerAffiliationMatch = worker?.phcAffiliation?.toLowerCase() === target;

        const matchesFacility = anyNearbyMatch || primaryDest === target || (!primaryDest && workerAffiliationMatch);
        if (!matchesFacility) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (dateFilterChoice === 'today') {
        const caseDate = new Date(item.createdAt).toDateString();
        const today = new Date().toDateString();
        if (caseDate !== today) return false;
      } else if (dateFilterChoice === 'week') {
        const caseTime = new Date(item.createdAt).getTime();
        const weekAgo = Date.now() - 7 * 86400000;
        if (caseTime < weekAgo) return false;
      } else if (dateFilterChoice === 'month') {
        const caseTime = new Date(item.createdAt).getTime();
        const monthAgo = Date.now() - 30 * 86400000;
        if (caseTime < monthAgo) return false;
      }

      return true;
    });

    // 4. Date Sorting
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return dateFilterChoice === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [cases, activeRiskFilter, selectedFacility, dateFilterChoice, worker?.phcAffiliation]);

  // Dynamic label for Date pill
  const getDateLabel = () => {
    switch (dateFilterChoice) {
      case 'latest': return 'Date: Latest First';
      case 'oldest': return 'Date: Oldest First';
      case 'today': return 'Date: Today';
      case 'week': return 'Date: Past 7 Days';
      case 'month': return 'Date: Past 30 Days';
      default: return 'Date: Latest First';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || '??';
  };

  const getRiskColors = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'high':
        return {
          bg: theme.isDark ? 'rgba(239, 68, 68, 0.22)' : StitchColors.errorContainer,
          text: theme.isDark ? '#F87171' : StitchColors.error,
          border: theme.isDark ? 'rgba(248, 113, 113, 0.4)' : '#FECACA',
          icon: 'warning' as const,
        };
      case 'moderate':
        return {
          bg: theme.isDark ? 'rgba(245, 158, 11, 0.20)' : '#FEF3C7',
          text: theme.isDark ? '#FBBF24' : '#B45309',
          border: theme.isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A',
          icon: 'info' as const,
        };
      case 'low':
        return {
          bg: theme.isDark ? 'rgba(16, 185, 129, 0.20)' : '#DCFCE7',
          text: theme.isDark ? '#34D399' : '#15803D',
          border: theme.isDark ? 'rgba(52, 211, 153, 0.4)' : '#BBF7D0',
          icon: 'check-circle' as const,
        };
      default:
        return {
          bg: theme.surfaceContainer,
          text: theme.textSecondary,
          border: theme.border,
          icon: 'help' as const,
        };
    }
  };



  const renderFooter = () => (
    <View style={[styles.integrityBanner, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.border }]}>
      <View style={[styles.integrityIconContainer, { backgroundColor: theme.surfaceContainerHighest }]}>
        <MaterialIcons name="verified-user" size={28} color={theme.primary} />
      </View>
      <View style={styles.integrityTextContainer}>
        <Text style={[styles.integrityTitle, { color: theme.text }]}>Local Archive Validated</Text>
        <Text style={[styles.integrityDesc, { color: theme.textSecondary }]}>
          All local records verified and stored in encrypted offline SQLite storage.
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: CaseRecord }) => {
    const name = item.patientMetadata.patientName || t(language, 'common', 'unknown');
    const risk = item.triageResult?.finalRiskLevel || item.classificationResult?.riskLevel || 'low';
    const condition = item.triageResult?.predictedCondition || item.classificationResult?.predictedCondition || item.patientMetadata.conditionCategory || 'Unknown Condition';
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const initials = getInitials(name);
    const riskStyles = getRiskColors(risk);
    const imageUri = item.classificationResult?.imageUri || item.images?.[0]?.uri;
    const destFacility = item.referralInfo?.nearbyFacilities?.[0]?.name;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/case/${item.id}` as any)}
        style={[styles.card, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.border }]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.avatar, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
            </View>
            <View style={styles.patientInfoContainer}>
              <View style={styles.patientNameRow}>
                <Text style={[styles.patientName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                <Text style={[styles.patientDemographic, { color: theme.textSecondary }]}>
                  {item.patientMetadata.age ? `${item.patientMetadata.age}y` : ''}
                  {item.patientMetadata.sex ? ` • ${item.patientMetadata.sex.toUpperCase()}` : ''}
                </Text>
              </View>
              <Text style={[styles.caseIdText, { color: theme.textTertiary }]}>
                #{item.id.substring(0, 8).toUpperCase()} {destFacility ? `• ${destFacility}` : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: riskStyles.bg, borderColor: riskStyles.border }]}>
            <MaterialIcons name={riskStyles.icon} size={14} color={riskStyles.text} />
            <Text style={[styles.riskBadgeText, { color: riskStyles.text }]}>
              {risk.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.surfaceContainerHighest }]}>
              <MaterialIcons name="image" size={32} color={theme.border} />
            </View>
          )}

          <View style={styles.cardDetails}>
            <Text style={[styles.conditionTitle, { color: theme.text }]} numberOfLines={1}>
              {condition.toUpperCase()}
            </Text>

            <View style={styles.timeRow}>
              <MaterialIcons name="schedule" size={14} color={theme.textTertiary} />
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{dateStr}</Text>
            </View>

            <View style={styles.statusRow}>
              {item.syncStatus === 'pending' ? (
                <View style={[styles.statusChip, { backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.20)' : '#FEF3C7', borderColor: theme.isDark ? 'rgba(251, 191, 36, 0.4)' : '#FDE68A' }]}>
                  <MaterialIcons name="cloud-off" size={12} color={theme.isDark ? '#FBBF24' : '#B45309'} />
                  <Text style={[styles.statusChipText, { color: theme.isDark ? '#FBBF24' : '#B45309' }]}>Pending Sync</Text>
                </View>
              ) : (
                <View style={[styles.statusChip, { backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.20)' : '#DCFCE7', borderColor: theme.isDark ? 'rgba(52, 211, 153, 0.4)' : '#BBF7D0' }]}>
                  <MaterialIcons name="cloud-done" size={12} color={theme.isDark ? '#34D399' : '#15803D'} />
                  <Text style={[styles.statusChipText, { color: theme.isDark ? '#34D399' : '#15803D' }]}>Synced</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isDateFiltered = dateFilterChoice !== 'latest';
  const isFacilityFiltered = selectedFacility !== 'All';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Top App Bar */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="health-and-safety" size={32} color={theme.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerOverline, { color: theme.primary }]}>MEDGUARD AI</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Case History</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusButton, { backgroundColor: theme.surfaceContainer }]}>
            <View style={[styles.statusDot, { backgroundColor: '#059669' }]} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>LOCAL DB</Text>
          </View>
        </View>
      </View>

      {/* Persistent Controls: Search, Toolbar & Risk Chips (Rendered OUTSIDE FlatList to preserve keyboard focus) */}
      <View style={styles.fixedHeaderSection}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              Case History & Archive
            </Text>
            <View style={[styles.encryptedBadge, { backgroundColor: theme.surfaceContainerHigh }]}>
              <MaterialIcons name="shield" size={14} color={theme.primary} />
              <Text style={[styles.encryptedText, { color: theme.primary }]}>Encrypted</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {filteredCases.length} of {cases.length} triage records
          </Text>
        </View>

        {/* Search Input Section */}
        <View style={styles.searchSection}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.border }]}>
            <MaterialIcons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                { color: theme.text }
              ]}
              placeholder="Search by patient name, case ID..."
              placeholderTextColor={theme.textTertiary}
              value={searchTextInput}
              onChangeText={(text) => {
                setSearchTextInput(text);
                // When completely erased, immediately show all results
                if (text.length === 0 && activeSearchQuery) {
                  setActiveSearchQuery('');
                }
              }}
              returnKeyType="search"
              onSubmitEditing={handleExecuteSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchTextInput.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                style={[styles.clearButton, { backgroundColor: theme.surfaceContainer }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleExecuteSearch}
              style={[styles.searchSubmitButton, { backgroundColor: theme.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-forward" size={18} color={StitchColors.onPrimary} />
            </TouchableOpacity>
          </View>

          {/* Action Toolbar (Date & Facility Pills — Export removed) */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.actionToolbar}
          >
            {/* Date Sort / Filter Pill */}
            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: isDateFiltered ? (theme.isDark ? 'rgba(0, 95, 80, 0.35)' : StitchColors.primaryFixed) : theme.surfaceContainerLowest,
                  borderColor: isDateFiltered ? theme.primary : theme.border,
                }
              ]}
              onPress={() => setShowDateModal(true)}
            >
              <MaterialIcons name="calendar-today" size={16} color={theme.primary} />
              <Text
                style={[
                  styles.actionPillText,
                  { color: isDateFiltered ? (theme.isDark ? '#6DF5E1' : StitchColors.onPrimaryFixed) : theme.text, fontWeight: isDateFiltered ? '700' : '500' }
                ]}
                numberOfLines={1}
              >
                {getDateLabel()}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={16} color={isDateFiltered ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>

            {/* Facility Filter Pill */}
            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: isFacilityFiltered ? (theme.isDark ? 'rgba(30, 93, 82, 0.35)' : StitchColors.tertiaryFixed) : theme.surfaceContainerLowest,
                  borderColor: isFacilityFiltered ? StitchColors.tertiary : theme.border,
                }
              ]}
              onPress={() => setShowFacilityModal(true)}
            >
              <MaterialIcons name="domain" size={16} color={StitchColors.tertiary} />
              <Text
                style={[
                  styles.actionPillText,
                  { color: isFacilityFiltered ? (theme.isDark ? '#95d2c4' : StitchColors.onTertiaryFixed) : theme.text, fontWeight: isFacilityFiltered ? '700' : '500' }
                ]}
                numberOfLines={1}
              >
                Facility: {selectedFacility}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={16} color={isFacilityFiltered ? StitchColors.tertiary : theme.textSecondary} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Risk Tier Filter Chips with Real Counts */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filterChipsContainer}
        >
          {[
            { id: 'all' as const, label: `All (${riskCounts.all})` },
            { id: 'high' as const, label: `High Risk (${riskCounts.high})`, color: StitchColors.error },
            { id: 'moderate' as const, label: `Moderate (${riskCounts.moderate})`, color: '#D97706' },
            { id: 'low' as const, label: `Low Risk (${riskCounts.low})`, color: '#15803D' },
          ].map((filter) => {
            const isActive = activeRiskFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setActiveRiskFilter(filter.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.primary : theme.surfaceContainerLowest,
                    borderColor: isActive ? theme.primary : theme.border,
                  }
                ]}
              >
                {filter.color && !isActive && (
                  <View style={[styles.filterChipDot, { backgroundColor: filter.color }]} />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? StitchColors.onPrimary : theme.text,
                      fontWeight: isActive ? '700' : '500',
                    }
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredCases}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Cases Found</Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              {activeRiskFilter !== 'all' || selectedFacility !== 'All' || dateFilterChoice !== 'latest' || activeSearchQuery
                ? 'Try resetting the active filters or search terms.'
                : 'No triage records found in offline storage.'}
            </Text>
            {(activeRiskFilter !== 'all' || selectedFacility !== 'All' || dateFilterChoice !== 'latest' || activeSearchQuery) && (
              <TouchableOpacity
                style={[styles.resetFiltersBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setActiveRiskFilter('all');
                  setSelectedFacility('All');
                  setDateFilterChoice('latest');
                  setSearchTextInput('');
                  setActiveSearchQuery('');
                }}
              >
                <Text style={[styles.resetFiltersText, { color: StitchColors.onPrimary }]}>Reset All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Date Filter & Sort Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="calendar-today" size={20} color={theme.primary} />
                <Text style={[Fonts.headlineSm, { color: theme.text }]}>Date Filter & Sort</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptionsList}>
              {[
                { id: 'latest' as const, label: 'Latest First', desc: 'Sort by newest created cases', icon: 'schedule' as const },
                { id: 'oldest' as const, label: 'Oldest First', desc: 'Sort by earliest created cases', icon: 'history' as const },
                { id: 'today' as const, label: "Today's Cases", desc: 'Cases recorded today only', icon: 'today' as const },
                { id: 'week' as const, label: 'Past 7 Days', desc: 'Recorded in the last 7 days', icon: 'date-range' as const },
                { id: 'month' as const, label: 'Past 30 Days', desc: 'Recorded in the last 30 days', icon: 'calendar-month' as const },
              ].map((opt) => {
                const isSelected = dateFilterChoice === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected ? (theme.isDark ? 'rgba(0, 95, 80, 0.25)' : StitchColors.primaryFixed) : theme.surfaceContainer,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      }
                    ]}
                    onPress={() => {
                      setDateFilterChoice(opt.id);
                      setShowDateModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <MaterialIcons name={opt.icon} size={22} color={isSelected ? theme.primary : theme.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.labelLg, { color: isSelected ? (theme.isDark ? '#6DF5E1' : StitchColors.onPrimaryFixed) : theme.text, fontWeight: '700' }]}>
                          {opt.label}
                        </Text>
                        <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>
                          {opt.desc}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Facility Filter Modal */}
      <Modal
        visible={showFacilityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFacilityModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFacilityModal(false)}
        >
          <View style={[styles.modalCard, styles.facilityModalCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="domain" size={20} color={StitchColors.tertiary} />
                <Text style={[Fonts.headlineSm, { color: theme.text }]}>Filter by Facility</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFacilityModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* In-modal facility search input */}
            <View style={[styles.modalSearchContainer, { backgroundColor: theme.surfaceContainer, borderColor: theme.border }]}>
              <MaterialIcons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.modalSearchInput, { color: theme.text }]}
                placeholder="Search facility name..."
                placeholderTextColor={theme.textTertiary}
                value={facilitySearchQuery}
                onChangeText={setFacilitySearchQuery}
              />
              {facilitySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFacilitySearchQuery('')}>
                  <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.facilityScrollView} showsVerticalScrollIndicator={true}>
              {/* Option: All Facilities */}
              <TouchableOpacity
                style={[
                  styles.modalOptionItem,
                  {
                    backgroundColor: selectedFacility === 'All' ? (theme.isDark ? 'rgba(0, 95, 80, 0.25)' : StitchColors.primaryFixed) : theme.surfaceContainer,
                    borderColor: selectedFacility === 'All' ? theme.primary : 'transparent',
                    marginBottom: 8,
                  }
                ]}
                onPress={() => {
                  setSelectedFacility('All');
                  setShowFacilityModal(false);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <MaterialIcons name="apps" size={20} color={selectedFacility === 'All' ? theme.primary : theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.labelLg, { color: selectedFacility === 'All' ? (theme.isDark ? '#6DF5E1' : StitchColors.onPrimaryFixed) : theme.text, fontWeight: '700' }]}>
                      All Facilities
                    </Text>
                    <Text style={[Fonts.bodySm, { color: theme.textSecondary, marginTop: 2 }]}>
                      Show cases from all clinics and referral hubs
                    </Text>
                  </View>
                </View>
                {selectedFacility === 'All' && (
                  <MaterialIcons name="check" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>

              {/* List of facilities */}
              {filteredModalFacilities.map((facName) => {
                const isSelected = selectedFacility === facName;
                return (
                  <TouchableOpacity
                    key={facName}
                    style={[
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected ? (theme.isDark ? 'rgba(30, 93, 82, 0.25)' : StitchColors.tertiaryFixed) : theme.surfaceContainer,
                        borderColor: isSelected ? StitchColors.tertiary : 'transparent',
                        marginBottom: 6,
                      }
                    ]}
                    onPress={() => {
                      setSelectedFacility(facName);
                      setShowFacilityModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <MaterialIcons name="local-hospital" size={18} color={isSelected ? StitchColors.tertiary : theme.textSecondary} />
                      <Text
                        style={[
                          Fonts.bodyMd,
                          {
                            color: isSelected ? (theme.isDark ? '#95d2c4' : StitchColors.onTertiaryFixed) : theme.text,
                            fontWeight: isSelected ? '700' : '500',
                            flex: 1,
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {facName}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check" size={18} color={StitchColors.tertiary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerOverline: {
    ...Fonts.labelSm,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    ...Fonts.headlineSm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Fonts.labelSm,
    fontWeight: '700',
  },
  fixedHeaderSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
  },
  titleSection: {
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Fonts.headlineLg,
    fontWeight: '700',
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  encryptedText: {
    ...Fonts.labelSm,
    fontWeight: '700',
  },
  subtitle: {
    ...Fonts.bodyMd,
  },
  searchSection: {
    gap: Spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...Fonts.bodyMd,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  searchSubmitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionToolbar: {
    flexDirection: 'row',
    paddingVertical: 2,
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPillText: {
    ...Fonts.labelMd,
  },
  filterChipsContainer: {
    paddingVertical: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterChipText: {
    ...Fonts.labelMd,
  },
  card: {
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Fonts.headlineSm,
    fontWeight: '700',
  },
  patientInfoContainer: {
    flex: 1,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patientName: {
    ...Fonts.headlineSm,
    fontWeight: '700',
    flexShrink: 1,
  },
  patientDemographic: {
    ...Fonts.labelMd,
    fontWeight: '500',
  },
  caseIdText: {
    ...Fonts.labelSm,
    marginTop: 2,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  riskBadgeText: {
    ...Fonts.labelSm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  cardImage: {
    width: 76,
    height: 76,
    borderRadius: 10,
  },
  imagePlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  conditionTitle: {
    ...Fonts.labelLg,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    ...Fonts.bodySm,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusChipText: {
    ...Fonts.labelSm,
    fontWeight: '700',
  },
  integrityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 16,
    marginTop: Spacing.sm,
    borderWidth: 1,
  },
  integrityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrityTextContainer: {
    flex: 1,
  },
  integrityTitle: {
    ...Fonts.labelLg,
    fontWeight: '700',
  },
  integrityDesc: {
    ...Fonts.bodySm,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Fonts.headlineSm,
    marginTop: Spacing.md,
    fontWeight: '700',
  },
  emptyDesc: {
    ...Fonts.bodyMd,
    textAlign: 'center',
    marginTop: 4,
  },
  resetFiltersBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resetFiltersText: {
    ...Fonts.labelMd,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  facilityModalCard: {
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalOptionsList: {
    gap: 8,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: Spacing.md,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    height: '100%',
    ...Fonts.bodyMd,
  },
  facilityScrollView: {
    maxHeight: 320,
  },
});
