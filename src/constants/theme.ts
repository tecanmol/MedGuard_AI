/**
 * MedGuard AI — Stitch Clinical Design System Tokens
 *
 * Primary:     #005f50 (Deep Clinical Teal)
 * Background:  #faf8ff (Surface White)
 * Typography:  Inter (system fallback: system-ui/normal)
 *
 * This is a LIGHT-FIRST theme. Dark mode architecture is preserved
 * so dark tokens can be filled in later without structural changes.
 *
 * Risk colors are theme-invariant (always the same hue regardless of mode).
 */

import { Platform } from 'react-native';

// ── Stitch Clinical Palette (raw tokens) ──────────────────────────────
export const StitchColors = {
  // Primary teal family
  primary: '#005f50',
  primaryContainer: '#0d7a68',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#aaffe9',
  primaryFixed: '#99f3dd',
  primaryFixedDim: '#7cd7c1',
  onPrimaryFixed: '#00201a',
  onPrimaryFixedVariant: '#005043',

  // Secondary teal
  secondary: '#006b5f',
  secondaryContainer: '#6df5e1',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#006f64',
  secondaryFixed: '#6df5e1',
  secondaryFixedDim: '#4fd9c6',
  onSecondaryFixed: '#00201c',
  onSecondaryFixedVariant: '#005047',

  // Tertiary deep teal
  tertiary: '#1e5d52',
  tertiaryContainer: '#3a766a',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#bcfbeb',
  tertiaryFixed: '#b1efdf',
  tertiaryFixedDim: '#95d2c4',
  onTertiaryFixed: '#00201a',
  onTertiaryFixedVariant: '#005044',

  // Surface hierarchy
  background: '#faf8ff',
  surface: '#faf8ff',
  surfaceBright: '#faf8ff',
  surfaceDim: '#d2d9f4',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f3ff',
  surfaceContainer: '#eaedff',
  surfaceContainerHigh: '#e2e7ff',
  surfaceContainerHighest: '#dae2fd',

  // On-surface
  onBackground: '#131b2e',
  onSurface: '#131b2e',
  onSurfaceVariant: '#3e4946',
  surfaceVariant: '#dae2fd',

  // Outline
  outline: '#6e7a75',
  outlineVariant: '#bdc9c4',

  // Error / danger
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Inverse
  inverseSurface: '#283044',
  inverseOnSurface: '#eef0ff',
  inversePrimary: '#7cd7c1',
} as const;

// ── Brand Colors (backward-compatible alias) ─────────────────────────
export const BrandColors = {
  primary: StitchColors.primary,
  primaryLight: StitchColors.primaryFixedDim,
  primaryDark: StitchColors.primaryContainer,
  accent: StitchColors.secondary,
  accentLight: StitchColors.secondaryContainer,
  accentDark: StitchColors.secondary,
} as const;

// ── Risk-Level Colors (Stitch spec, theme-invariant) ─────────────────
export const RiskColors = {
  low: '#15803D',
  lowBg: '#F0FDF4',
  lowBorder: '#BBF7D0',
  moderate: '#D97706',
  moderateBg: '#FFFBEB',
  moderateBorder: '#FDE68A',
  high: '#DC2626',
  highBg: '#FEF2F2',
  highBorder: '#FECACA',
  uncertain: '#3B82F6',
  uncertainBg: '#EFF6FF',
  uncertainBorder: '#BFDBFE',
} as const;

// ── Status Colors (theme-invariant) ──────────────────────────────────
export const StatusColors = {
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  online: '#059669',
  onlineBg: '#ECFDF5',
  offline: '#B45309',
  offlineBg: '#FEF3C7',
  syncPending: '#2563EB',
  syncPendingBg: '#EFF6FF',
  syncFailed: '#B91C1C',
  syncFailedBg: '#FEE2E2',
} as const;

// ── Theme-Adaptive Colors (light-first) ──────────────────────────────
export const Colors = {
  light: {
    // Core text
    text: StitchColors.onSurface,
    textSecondary: StitchColors.onSurfaceVariant,
    textTertiary: StitchColors.outline,

    // Surfaces
    background: StitchColors.background,
    surface: StitchColors.surface,
    surfaceElevated: StitchColors.surfaceContainerLowest,
    surfaceContainer: StitchColors.surfaceContainer,
    surfaceContainerLow: StitchColors.surfaceContainerLow,
    surfaceContainerHigh: StitchColors.surfaceContainerHigh,
    surfaceContainerHighest: StitchColors.surfaceContainerHighest,
    surfaceContainerLowest: StitchColors.surfaceContainerLowest,

    // Borders
    border: StitchColors.outlineVariant,
    borderLight: StitchColors.surfaceContainerHighest,

    // Selected / active states
    backgroundElement: StitchColors.surfaceContainerLow,
    backgroundSelected: StitchColors.surfaceContainer,

    // Brand
    primary: StitchColors.primary,
    primaryText: StitchColors.onPrimary,
    primaryContainer: StitchColors.primaryContainer,
    accent: StitchColors.secondary,

    // Shadows — flat, subtle. No neumorphic.
    shadowLight: 'rgba(0,0,0,0.04)',
    shadowDark: 'rgba(0,0,0,0.08)',
  },
  dark: {
    // Dark mode stubs — keep structure identical for future implementation
    text: '#eef0ff',
    textSecondary: '#bdc9c4',
    textTertiary: '#6e7a75',
    background: '#131b2e',
    surface: '#131b2e',
    surfaceElevated: '#1c2533',
    surfaceContainer: '#1f2d3f',
    surfaceContainerLow: '#18253a',
    surfaceContainerHigh: '#273244',
    surfaceContainerHighest: '#2d3850',
    surfaceContainerLowest: '#101413',
    border: '#3e4946',
    borderLight: '#283044',
    backgroundElement: '#1c2533',
    backgroundSelected: '#1f2d3f',
    primary: StitchColors.primaryFixedDim,
    primaryText: '#00201a',
    primaryContainer: StitchColors.primaryFixed,
    accent: StitchColors.secondaryContainer,
    shadowLight: 'rgba(0,0,0,0.20)',
    shadowDark: 'rgba(0,0,0,0.40)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ── Spacing (Stitch tokens) ───────────────────────────────────────────
export const Spacing = {
  // Stitch named tokens
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,

  // Legacy numeric aliases — kept for backward compat
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  s: 8,
  m: 12,
  l: 16,
  '2xl': 32,
} as const;

// ── Border Radius (Stitch tokens) ────────────────────────────────────
export const BorderRadius = {
  sm: 4,
  md: 8,      // Stitch DEFAULT radius (cards, inputs)
  lg: 16,     // Stitch lg (large cards, sheets)
  xl: 24,     // Stitch xl (bottom sheets, modals)
  full: 9999, // Pills / circles
} as const;

/** Minimum tap-target size per accessibility guidelines (48dp). */
export const MinTapTarget = 48;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ── Typography (Stitch scale → React Native) ─────────────────────────
const FontFamilies = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'serif',
    rounded: 'ui-rounded',
    mono: 'monospace',
  },
})!;

/**
 * Typography scale from Stitch DESIGN.md.
 * `sizes` keeps backward-compat with old code.
 * New code should prefer the named tokens below.
 */
export const Fonts = {
  ...FontFamilies,

  // Stitch named type scale (fontSize, lineHeight pairs in px)
  headlineXl:       { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.64  },
  headlineXlMobile: { fontSize: 26, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.52  },
  headlineLg:       { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.36  },
  headlineMd:       { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.20  },
  headlineSm:       { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.09  },
  bodyLg:           { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing:  0     },
  bodyMd:           { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing:  0.07  },
  bodySm:           { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing:  0.13  },
  labelLg:          { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing:  0.14  },
  labelMd:          { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing:  0.24  },
  labelSm:          { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing:  0.44  },
  metricDisplay:    { fontSize: 36, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -1.08  },

  // Legacy sizes map — kept for backward compatibility
  sizes: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
} as const;
