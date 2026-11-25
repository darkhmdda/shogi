import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import {type Colors, spacing, useColors, useStyles} from '../theme'

type ButtonProps = {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function Button({ title, onPress, variant = 'secondary', disabled }: ButtonProps) {
  const styles = useStyles(createStyles)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'primary' && styles.primaryText]}>{title}</Text>
    </Pressable>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(createStyles)
  return <View style={[styles.card, style]}>{children}</View>
}

export function Row({ children }: { children: ReactNode }) {
  const styles = useStyles(createStyles)
  return <View style={styles.row}>{children}</View>
}

export function Feedback({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'error' }) {
  const styles = useStyles(createStyles)
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.feedback, tone === 'success' && styles.success, tone === 'error' && styles.error]}
    >
      {text}
    </Text>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  button: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.button,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primaryBorder },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.buttonText, fontSize: 14, fontWeight: '600' },
  primaryText: { color: colors.onPrimary },
  card: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  feedback: { padding: 10, borderRadius: 8, backgroundColor: colors.surfaceAlt, color: colors.text, lineHeight: 20 },
  success: { backgroundColor: colors.successBg, color: colors.success },
  error: { backgroundColor: colors.errorBg, color: colors.error },
})
