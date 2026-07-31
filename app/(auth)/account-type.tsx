import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { Button } from '@/ui/components';
import { colors, radius, s, spacing } from '@/ui/theme';

type AccountType = 'GUARDIAN' | 'ADULT_PLAYER';

/**
 * Spec 2.1: after verification the user picks "I'm a parent enrolling my
 * child" or "I'm an adult player". Combined parent+player account — one login,
 * N player profiles, no separate child logins.
 */
export default function AccountTypeScreen() {
  const [choice, setChoice] = useState<AccountType | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await api.patch('/api/v1/accounts/me', { type: choice });
    } catch {
      // Non-fatal: the server also accepts the type during the first player
      // profile creation, so a network blip here should not strand the user.
    } finally {
      setBusy(false);
      router.replace('/');
    }
  };

  return (
    <View style={[s.screen, s.content, { paddingTop: spacing.xxl }]}>
      <Text style={s.h1}>Who is this account for?</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Option
          value="GUARDIAN"
          selected={choice === 'GUARDIAN'}
          onSelect={setChoice}
          title="I’m a parent enrolling my child"
          body="You hold the account; each child gets their own player profile under it. One wallet, one payment history, everything in one place."
        />
        <Option
          value="ADULT_PLAYER"
          selected={choice === 'ADULT_PLAYER'}
          onSelect={setChoice}
          title="I’m an adult player"
          body="You play yourself — your account holds a single player profile in your name."
        />
      </View>

      <Button label="Continue" onPress={submit} disabled={!choice} loading={busy} />
    </View>
  );
}

/**
 * Declared at module scope, not inside the screen. A component created during
 * render is a brand-new component type on every render, so React unmounts and
 * remounts it — throwing away any state it holds.
 */
function Option({
  value,
  selected,
  onSelect,
  title,
  body,
}: {
  value: AccountType;
  selected: boolean;
  onSelect: (value: AccountType) => void;
  title: string;
  body: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={{
        backgroundColor: selected ? `${colors.accent}18` : colors.surface,
        borderColor: selected ? colors.accent : colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.xs,
      }}
    >
      <Text style={s.h3}>{title}</Text>
      <Text style={s.muted}>{body}</Text>
    </Pressable>
  );
}
