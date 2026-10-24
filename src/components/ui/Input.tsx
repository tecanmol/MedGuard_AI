/**
 * MedGuard AI — Input Components (Stitch Design)
 *
 * All existing sub-components preserved with backward-compatible props:
 *   TextInput, NumberInput, Slider, Select, Checkbox, RadioGroup
 *
 * Styling: Flat outlined field with 1px border, rounded-md corners.
 * Focused state: primary-color border.
 */
import { BorderRadius, Fonts, MinTapTarget, Spacing, StitchColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import RNSlider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { KeyboardTypeOptions, Pressable, TextInput as RNTextInput, StyleSheet, Text, View } from 'react-native';

// ── Shared base props ─────────────────────────────────────────────────

export interface InputBaseProps {
  label: string;
  error?: string;
  required?: boolean;
}

// ── TextInput ─────────────────────────────────────────────────────────

export interface TextInputProps extends InputBaseProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export const TextInput: React.FC<TextInputProps> = ({
  label, value, onChangeText, placeholder, error, required,
  multiline, keyboardType, secureTextEntry, autoCapitalize,
}) => {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? StitchColors.error
    : focused
    ? StitchColors.primary
    : theme.border;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <View
        style={[
          styles.fieldBox,
          { backgroundColor: theme.surfaceElevated, borderColor },
          multiline && styles.multilineBox,
        ]}
      >
        <RNTextInput
          style={[styles.inputBase, { color: theme.text }, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// ── NumberInput ───────────────────────────────────────────────────────

export interface NumberInputProps extends Omit<TextInputProps, 'onChangeText' | 'keyboardType' | 'value'> {
  value: number | undefined;
  onChangeNumber: (val: number | undefined) => void;
}

export const NumberInput: React.FC<NumberInputProps> = (props) => {
  const handleChange = (text: string) => {
    if (text === '') { props.onChangeNumber(undefined); return; }
    const parsed = parseFloat(text);
    props.onChangeNumber(isNaN(parsed) ? undefined : parsed);
  };

  return (
    <TextInput
      {...props}
      value={props.value !== undefined ? props.value.toString() : ''}
      onChangeText={handleChange}
      keyboardType="numeric"
    />
  );
};

// ── Slider ────────────────────────────────────────────────────────────

export interface SliderProps extends InputBaseProps {
  value: number;
  onValueChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label, value, onValueChange, min, max, step = 1,
  minLabel, maxLabel, error, required,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={[styles.sliderValue, { color: StitchColors.primary }]}>{value}</Text>
      </View>
      <View style={{ height: 44, justifyContent: 'center' }}>
        <RNSlider
          style={{ width: '100%', height: 44 }}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={(val) => {
            Haptics.selectionAsync();
            onValueChange(val);
          }}
          minimumTrackTintColor={StitchColors.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={StitchColors.primary}
        />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, { color: theme.textTertiary }]}>{minLabel ?? min}</Text>
        <Text style={[styles.sliderLabel, { color: theme.textTertiary }]}>{maxLabel ?? max}</Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// ── Select (pill selector) ────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends InputBaseProps {
  value: string;
  onValueChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label, value, onValueChange, options, error, required,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.selectOptions}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onValueChange(opt.value);
              }}
              style={[
                styles.selectPill,
                {
                  backgroundColor: isSelected ? StitchColors.primary : theme.surfaceContainer,
                  borderColor: isSelected ? StitchColors.primary : theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.selectPillText,
                  { color: isSelected ? StitchColors.onPrimary : theme.text },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// ── Checkbox ──────────────────────────────────────────────────────────

export interface CheckboxProps extends InputBaseProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onToggle, error, required }) => {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.checkboxRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(!checked);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          style={[
            styles.checkboxBox,
            {
              backgroundColor: checked ? StitchColors.primary : theme.surfaceElevated,
              borderColor: checked ? StitchColors.primary : theme.border,
            },
          ]}
        >
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.checkboxLabel, { color: theme.text }]}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// ── RadioGroup ────────────────────────────────────────────────────────

export interface RadioGroupProps extends InputBaseProps {
  value: string;
  onValueChange: (val: string) => void;
  options: SelectOption[];
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ label, value, onValueChange, options, error, required }) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.radioGroup}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={styles.radioRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onValueChange(opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
            >
              <View
                style={[
                  styles.radioCircle,
                  {
                    borderColor: isSelected ? StitchColors.primary : theme.border,
                    backgroundColor: theme.surfaceElevated,
                  },
                ]}
              >
                {isSelected && (
                  <View style={[styles.radioDot, { backgroundColor: StitchColors.primary }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: theme.text }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Fonts.labelMd,
    marginBottom: Spacing.xs,
  },
  required: {
    color: StitchColors.error,
  },
  fieldBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  multilineBox: {
    minHeight: 100,
  },
  inputBase: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...Fonts.bodyMd,
    minHeight: MinTapTarget,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: StitchColors.error,
    ...Fonts.bodySm,
    marginTop: Spacing.xs,
  },
  // Slider
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sliderValue: {
    ...Fonts.labelLg,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderLabel: {
    ...Fonts.labelSm,
  },
  // Select
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  selectPill: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  selectPillText: {
    ...Fonts.labelMd,
  },
  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTapTarget,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: StitchColors.onPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    marginLeft: Spacing.sm,
    ...Fonts.bodyMd,
    flex: 1,
  },
  // Radio
  radioGroup: {
    gap: Spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTapTarget,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  radioLabel: {
    marginLeft: Spacing.sm,
    ...Fonts.bodyMd,
    flex: 1,
  },
});
