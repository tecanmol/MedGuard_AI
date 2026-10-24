/**
 * MedGuard AI — EmptyState Component (Stitch Design)
 */
import { Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  body,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.surfaceContainer }]}>
        <MaterialIcons name={icon} size={32} color={StitchColors.outline} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Fonts.headlineSm,
    textAlign: 'center',
  },
  body: {
    ...Fonts.bodyMd,
    textAlign: 'center',
  },
});

export default EmptyState;

