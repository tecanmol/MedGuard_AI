/**
 * MedGuard AI — StatusChip Component (Stitch Design)
 *
 * Pill chip for connectivity or sync status.
 * All existing props preserved (backward-compatible discriminated union).
 */
import { BorderRadius, Fonts, Spacing, StatusColors, StitchColors } from '@/constants/theme';
import { SyncStatus } from '@/models/types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type StatusChipProps =
  | { type: 'connectivity'; isOnline: boolean }
  | { type: 'sync'; status: SyncStatus };

const getDetails = (props: StatusChipProps): { dot: string; bg: string; label: string } => {
  if (props.type === 'connectivity') {
    return props.isOnline
      ? { dot: StatusColors.online, bg: StatusColors.onlineBg, label: 'Online' }
      : { dot: StatusColors.offline, bg: StatusColors.offlineBg, label: 'Offline' };
  } else {
    switch (props.status) {
      case 'pending':
        return { dot: StatusColors.syncPending, bg: StatusColors.syncPendingBg, label: 'Pending' };
      case 'uploading':
        return { dot: StatusColors.info, bg: '#EFF6FF', label: 'Uploading' };
      case 'failed':
        return { dot: StatusColors.syncFailed, bg: StatusColors.syncFailedBg, label: 'Failed' };
      case 'done':
        return { dot: StatusColors.success, bg: StatusColors.onlineBg, label: 'Synced' };
      default:
        return { dot: StitchColors.outline, bg: StitchColors.surfaceContainer, label: 'Unknown' };
    }
  }
};

export const StatusChip: React.FC<StatusChipProps> = (props) => {
  const { dot, bg, label } = getDetails(props);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: dot }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  label: {
    ...Fonts.labelSm,
  },
});

export default StatusChip;
