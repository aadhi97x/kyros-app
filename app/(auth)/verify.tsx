import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { AuthSession } from '@/api/types';
import { useSession } from '@/state/session';
import { Button } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

export default function VerifyScreen() {
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ phone: string; purpose?: string; devCode?: string }>();
  const [code, setCode] = useState(
    process.env.EXPO_PUBLIC_DEV_TOOLS === 'true' ? (params.devCode ?? '') : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<AuthSession>(
        '/api/v1/auth/verify',
        { phone: params.phone, code, purpose: params.purpose ?? 'signup' },
        true,
      );

      await signIn(session);
      router.replace(session.account.needsAccountType ? '/(auth)/account-type' : '/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      // Re-running signup for a pending account re-issues the OTP.
      await api.post('/api/v1/auth/login', { phone: params.phone, useOtp: true }, true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not resend the code.');
    }
  };

  return (
    <View style={[s.screen, s.content, { paddingTop: spacing.xxl }]}>
      <Text style={s.h1}>Enter the code</Text>
      <Text style={s.muted}>We sent a 6-digit code to {params.phone}.</Text>

      <TextInput
        style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="sms-otp"
        editable={!busy}
        onSubmitEditing={submit}
      />

      {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

      <Button label="Verify" onPress={submit} loading={busy} disabled={code.length !== 6} />
      <Button label="Resend code" variant="ghost" onPress={resend} disabled={busy} />
    </View>
  );
}
