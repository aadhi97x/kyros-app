import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { SignupResponse } from '@/api/types';
import { Button } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<SignupResponse>(
        '/api/v1/auth/signup',
        { name, phone, email: email || undefined, password },
        true,
      );

      router.push({
        pathname: '/(auth)/verify',
        params: {
          phone,
          purpose: result.requiresClaim ? 'claim' : 'signup',
          // Dev-mode convenience: the API returns the code so the emulator
          // flow needs no SMS. Absent entirely in production.
          devCode: result.otp.devCode ?? '',
        },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: spacing.xl }]}>
        <Text style={s.h1}>Create your account</Text>
        <Text style={s.muted}>
          One account covers your whole family — you can add each player after this step. If a club
          registered you at the ground, use the same number here to claim that account.
        </Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View>
            <Text style={[s.label, { marginBottom: spacing.xs }]}>Your name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              autoComplete="name"
              editable={!busy}
            />
          </View>

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
            <Text style={[s.label, { marginBottom: spacing.xs }]}>Email (optional)</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!busy}
            />
          </View>

          <View>
            <Text style={[s.label, { marginBottom: spacing.xs }]}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
              editable={!busy}
            />
          </View>

          {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

          <Button
            label="Continue"
            onPress={submit}
            loading={busy}
            disabled={!name || !phone || password.length < 8}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
