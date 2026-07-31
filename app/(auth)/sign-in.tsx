import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { AuthSession } from '@/api/types';
import { useSession } from '@/state/session';
import { Button } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<
        AuthSession | { requiresVerification: true; devCode?: string }
      >('/api/v1/auth/login', { phone, password }, true);

      if ('requiresVerification' in result) {
        router.push({ pathname: '/(auth)/verify', params: { phone, purpose: 'signup' } });
        return;
      }

      await signIn(result);
      router.replace(
        result.account.needsAccountType ? '/(auth)/account-type' : '/',
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[s.content, { paddingTop: spacing.xxl }]}>
        <Text style={s.h1}>Welcome back</Text>
        <Text style={s.muted}>Sign in with the phone number you registered with.</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View>
            <Text style={[s.label, { marginBottom: spacing.xs }]}>Phone</Text>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!busy}
            />
          </View>

          <View>
            <Text style={[s.label, { marginBottom: spacing.xs }]}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
              editable={!busy}
              onSubmitEditing={submit}
            />
          </View>

          {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

          <Button label="Sign in" onPress={submit} loading={busy} disabled={!phone || !password} />
        </View>

        <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Link href="/(auth)/sign-up" style={{ color: colors.accent, fontSize: 15 }}>
            New here? Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
