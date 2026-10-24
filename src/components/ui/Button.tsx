/**
 * MedGuard AI — Button Component (Stitch Design)
 *
 * Flat, filled clinical buttons.
 * All existing props preserved: title, onPress, variant, disabled, loading,
 * icon, size, fullWidth, accessibilityLabel.
 */
import { BorderRadius, Fonts, MinTapTarget, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as Haptics from 'expo-haptics';
import React, { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  size?: ButtonSize;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  size = 'md',
  fullWidth = false,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const isPressed = useSharedValue(0);

  const getVariantStyles = (): { bg: string; textColor: string; borderColor?: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: StitchColors.primary,
          textColor: StitchColors.onPrimary,
        };
      case 'secondary':
        return {
          bg: theme.surfaceContainer,
          textColor: StitchColors.primary,
        };
      case 'outline':
        return {
          bg: 'transparent',
          textColor: StitchColors.primary,
          borderColor: StitchColors.primary,
        };
      case 'danger':
        return {
          bg: StitchColors.error,
          textColor: StitchColors.onError,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          textColor: theme.textSecondary,
        };
      default:
        return {
          bg: StitchColors.primary,
          textColor: StitchColors.onPrimary,
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, minHeight: 36 };
      case 'lg':
        return { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, minHeight: MinTapTarget + 4 };
      case 'md':
      default:
        return { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, minHeight: MinTapTarget };
    }
  };

  const { bg, textColor, borderColor } = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const handlePressIn = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isPressed.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    isPressed.value = withSpring(0, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - isPressed.value * 0.03 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        { backgroundColor: bg },
        borderColor ? { borderWidth: 1.5, borderColor } : undefined,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        animatedStyle,
        sizeStyles,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.label, { color: textColor }, icon ? { marginLeft: Spacing.sm } : undefined]}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: Spacing.xs,
  },
  label: {
    ...Fonts.labelLg,
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
});

export default Button;
