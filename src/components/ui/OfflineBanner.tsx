/**
 * MedGuard AI — OfflineBanner Component (Stitch Design)
 *
 * Top ribbon shown when the device is offline.
 * Connects to useApp().isOnline — returns null when online.
 */
import { Fonts, Spacing, StatusColors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface OfflineBannerProps {
  isOnline: boolean;
  pendingSyncCount?: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOnline, pendingSyncCount }) => {
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={styles.text}>
        Offline Mode{pendingSyncCount != null && pendingSyncCount > 0 ? ` — ${pendingSyncCount} pending sync` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: StatusColors.offlineBg,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: StatusColors.offline,
  },
  text: {
    ...Fonts.labelSm,
    color: StatusColors.offline,
  },
});

export default OfflineBanner;

