/**
 * MedGuard AI — Card Component (Stitch Design)
 *
 * Flat surface card with subtle border and elevation shadow.
 * All existing props preserved: children, style, onPress, index.
 */
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as Haptics from 'expo-haptics';
import React, { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Used to stagger entrance animations */
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  index = 0,
}) => {
  const theme = useTheme();
  const isPressed = useSharedValue(0);

  const handlePressIn = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isPressed.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (!onPress) return;
    isPressed.value = withSpring(0, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - isPressed.value * 0.02 }],
  }));

  const enteringAnimation = FadeInDown.springify().damping(15).stiffness(150).delay(index * 50);

  const cardBody = (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight }, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        entering={enteringAnimation}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
        accessibilityRole="button"
      >
        {cardBody}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View entering={enteringAnimation}>
      {cardBody}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    // Subtle ambient shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginVertical: Spacing.xs,
  },
});

export default Card;
