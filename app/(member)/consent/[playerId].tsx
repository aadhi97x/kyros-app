import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { ConsentScreenData, VerificationStart } from '@/api/types';
import { Button, Card, ErrorState, Loading } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

/**
 * The consent screen (spec 2.3). Legally load-bearing, so the shape matters:
 *
 *  - Each purpose is listed separately with a plain-language explanation of
 *    what is collected and why — never one "I agree to everything" box.
 *  - Required purposes (without which the service cannot run) are marked and
 *    fixed on; optional ones are genuinely declinable switches.
 *  - Identity verification happens BEFORE the grant is recorded, and the grant
 *    quotes the verification's requestId.
 */
export default function ConsentScreen() {
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const queryClient = useQueryClient();

  const [optionalChoices, setOptionalChoices] = useState<Record<string, boolean>>({});
  const [verification, setVerification] = useState<VerificationStart | null>(null);
  const [error, setError] = useState<string | null>(null);

  const screen = useQuery({
    queryKey: ['consent', playerId],
    queryFn: () => api.get<ConsentScreenData>(`/api/v1/players/${playerId}/consent`),
  });

  const startVerification = useMutation({
    mutationFn: () =>
      api.post<VerificationStart>(`/api/v1/players/${playerId}/consent/verify`, {}),
    onSuccess: async (start) => {
      setVerification(start);
      setError(null);
      // DigiLocker is a browser redirect; the mock and offline verifiers are
      // completed in-app.
      if (start.redirectUrl) {
        await WebBrowser.openBrowserAsync(start.redirectUrl);
      }
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Could not start verification.'),
  });

  const grant = useMutation({
    mutationFn: () => {
      if (!verification || !screen.data) throw new Error('Verification has not been started.');

      const scopes = [
        ...screen.data.purposes.filter((purpose) => purpose.required).map((purpose) => purpose.scope),
        ...screen.data.purposes
          .filter((purpose) => !purpose.required && optionalChoices[purpose.scope])
          .map((purpose) => purpose.scope),
      ];

      return api.post(`/api/v1/players/${playerId}/consent`, {
        scopes,
        verification: {
          method: verification.method,
          requestId: verification.requestId,
          // The mock verifier needs an explicit confirmation payload; a real
          // DigiLocker completion carries the OAuth code from the redirect.
          payload: verification.method === 'MOCK' ? { confirm: true } : {},
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      await queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      router.back();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Could not record consent.'),
  });

  if (screen.isLoading) return <Loading />;
  if (screen.isError || !screen.data) {
    return <ErrorState message="Could not load the consent details." onRetry={() => screen.refetch()} />;
  }

  const { purposes, status } = screen.data;

  if (status.satisfied) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Text style={s.h1}>Consent on file</Text>
        <Text style={s.body}>
          You have already given consent for this player. You can review or withdraw it at any time
          from Settings.
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>Your child’s data</Text>
      <Text style={s.body}>
        Before the club can process this player’s information, we need your specific agreement to
        each purpose below. Nothing here is bundled — the optional ones are genuinely optional and
        saying no changes nothing else.
      </Text>

      {purposes.map((purpose) => (
        <Card key={purpose.scope}>
          <View style={s.rowBetween}>
            <Text style={[s.h3, { flex: 1 }]}>{purpose.label}</Text>
            {purpose.required ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Required</Text>
            ) : (
              <Switch
                value={optionalChoices[purpose.scope] ?? false}
                onValueChange={(value) =>
                  setOptionalChoices((previous) => ({ ...previous, [purpose.scope]: value }))
                }
                trackColor={{ true: colors.accentDark, false: colors.surfaceAlt }}
              />
            )}
          </View>
          <Text style={s.muted}>{purpose.explanation}</Text>
          <Text style={[s.muted, { fontSize: 12 }]}>
            Collected: {purpose.dataCollected.join(', ')}. Kept: {purpose.retention}
          </Text>
        </Card>
      ))}

      <Card>
        <Text style={s.h3}>Verify it’s you</Text>
        <Text style={s.muted}>
          The law requires us to confirm the consenting adult’s identity. This is a one-time step
          {screen.data.verificationMethod === 'DIGILOCKER' ? ' through DigiLocker' : ''}. We keep a
          reference that verification happened — never your documents.
        </Text>

        {!verification ? (
          <Button
            label="Verify identity"
            onPress={() => startVerification.mutate()}
            loading={startVerification.isPending}
          />
        ) : (
          <Text style={{ color: colors.accent, fontSize: 14 }}>
            {verification.instruction ?? 'Verification started — complete it, then agree below.'}
          </Text>
        )}
      </Card>

      {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

      <Button
        label="I agree to the selected purposes"
        onPress={() => grant.mutate()}
        loading={grant.isPending}
        disabled={!verification}
      />

      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.md }}>
          Not now
        </Text>
      </Pressable>
    </ScrollView>
  );
}
