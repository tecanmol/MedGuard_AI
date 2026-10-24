/**
 * MedGuard AI — RiskBadge Component (Stitch Design)
 *
 * Pill badge showing risk level with Stitch clinical semantic colors.
 * All existing props preserved: level, size, showLabel.
 */
import { BorderRadius, Fonts, RiskColors, Spacing } from '@/constants/theme';
import { RiskLevel } from '@/models/types';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RiskBadgeProps {
  level: RiskLevel | 'uncertain';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const getTokens = (level: RiskLevel | 'uncertain') => {
  switch (level) {
    case 'low':
      return { text: RiskColors.low, bg: RiskColors.lowBg, border: RiskColors.lowBorder, label: 'Low Risk' };
    case 'moderate':
      return { text: RiskColors.moderate, bg: RiskColors.moderateBg, border: RiskColors.moderateBorder, label: 'Moderate Risk' };
    case 'high':
      return { text: RiskColors.high, bg: RiskColors.highBg, border: RiskColors.highBorder, label: 'High Risk' };
    case 'uncertain':
    default:
      return { text: RiskColors.uncertain, bg: RiskColors.uncertainBg, border: RiskColors.uncertainBorder, label: 'Uncertain' };
  }
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'md',
  showLabel = true,
}) => {
  const tokens = getTokens(level);

  const dotSize = size === 'sm' ? 7 : size === 'lg' ? 12 : 9;
  const textStyle = size === 'sm'
    ? Fonts.labelSm
    : size === 'lg'
    ? Fonts.labelLg
    : Fonts.labelMd;

  const paddingV = size === 'sm' ? Spacing.xs - 1 : Spacing.xs;
  const paddingH = size === 'sm' ? Spacing.sm : Spacing.md;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.bg,
          borderColor: tokens.border,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tokens.text, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
      {showLabel && (
        <Text style={[styles.label, textStyle, { color: tokens.text }]}>
          {tokens.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    marginRight: Spacing.xs,
  },
  label: {
    fontWeight: '600',
  },
});

export default RiskBadge;
