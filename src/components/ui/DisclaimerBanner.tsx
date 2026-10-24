/**
 * MedGuard AI — DisclaimerBanner Component (Stitch Design)
 *
 * Disclaimer block with icon and message.
 * All existing props preserved: message, type.
 * Icon now uses text symbols (⚠ / ℹ) instead of emoji.
 */
import { BorderRadius, Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface DisclaimerBannerProps {
  message: string;
  type?: 'warning' | 'info' | 'caution';
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  message,
  type = 'warning',
}) => {
  const theme = useTheme();

  const getStyle = () => {
    switch (type) {
      case 'info':
        return { bg: '#EFF6FF', border: '#BFDBFE', iconColor: '#2563EB', icon: 'ℹ' };
      case 'caution':
        return { bg: StitchColors.errorContainer, border: StitchColors.error + '40', iconColor: StitchColors.error, icon: '⚠' };
      case 'warning':
      default:
        return { bg: '#FFFBEB', border: '#FDE68A', iconColor: '#D97706', icon: '⚠' };
    }
  };

  const s = getStyle();

  return (
    <View style={[styles.container, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.icon, { color: s.iconColor }]}>{s.icon}</Text>
      <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    width: '100%',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 16,
    lineHeight: 20,
    marginTop: 1,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    ...Fonts.bodySm,
  },
});

export default DisclaimerBanner;
