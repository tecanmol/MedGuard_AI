import { Fonts, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={StitchColors.primary} />
      <Text style={[styles.text, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  text: {
    ...Fonts.bodyMd,
    textAlign: 'center',
  },
});

