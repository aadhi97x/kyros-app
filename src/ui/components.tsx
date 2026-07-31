import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, s, spacing, statusColor } from './theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const background =
    variant === 'primary'
      ? colors.accentDark
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: radius.sm,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone?: string }) {
  const color = tone ? statusColor(tone) : colors.info;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      <Text style={[s.body, { color: colors.danger }]}>{message}</Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
      <Text style={s.h3}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

/**
 * The banner that keeps a coach informed while offline. Deliberately reassuring
 * rather than alarming — marks are safe on the device, and saying so stops
 * coaches re-tapping in the belief that nothing was recorded.
 */
export function OfflineBanner({ pending }: { pending: number }) {
  if (pending === 0) return null;
  return (
    <View
      style={{
        backgroundColor: `${colors.warn}22`,
        borderColor: `${colors.warn}55`,
        borderWidth: 1,
        borderRadius: radius.sm,
        padding: spacing.md,
      }}
    >
      <Text style={{ color: colors.warn, fontSize: 13, fontWeight: '600' }}>
        {pending} mark{pending === 1 ? '' : 's'} saved on this device
      </Text>
      <Text style={[s.muted, { marginTop: 2 }]}>
        They will sync automatically when you have a connection. Nothing is lost.
      </Text>
    </View>
  );
}
