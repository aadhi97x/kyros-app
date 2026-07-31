import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type {
  ConsentScreenData,
  VerificationComplete,
  VerificationStart,
} from '@/api/types';
import { Button, Card, ErrorState, Loading } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

/**
 * The consent screen (spec 2.3). Legally load-bearing, so the shape matters:
 *
 *  - Each purpose is listed separately with a plain-language explanation of
 *    what is collected and why — never one "I agree to everything" box.
 *  - Required purposes (without which the service cannot run) are marked and
 *    fixed on; optional ones are genuinely declinable switches.
 *  - Identity verification completes BEFORE the grant is recorded, and the
 *    grant quotes the verification's requestId, which the server proves it
 *    issued and then burns.
 *
 * Two verification shapes are handled. DigiLocker is a redirect: the parent
 * leaves for the provider, the SERVER does the token exchange (the client
 * secret must never be in this bundle), and we come back on a deep link.
 * Mock and manual-offline complete in-app with a PUT.
 */
export default function ConsentScreen() {
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const queryClient = useQueryClient();

  const [optionalChoices, setOptionalChoices] = useState<Record<string, boolean>>({});
  const [verification, setVerification] = useState<VerificationStart | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screen = useQuery({
    queryKey: ['consent', playerId],
    queryFn: () => api.get<ConsentScreenData>(`/api/v1/players/${playerId}/consent`),
  });

  // The DigiLocker round trip ends at kyros://consent-callback. Catch it and
  // read the outcome the server determined — the app is told what happened,
  // never asked to decide it.
  useEffect(() => {
    const handle = (url: string) => {
      const parsed = Linking.parse(url);
      if (!parsed.path?.includes('consent-callback')) return;

      const status = parsed.queryParams?.status;
      const requestId = parsed.queryParams?.requestId;

      if (status === 'verified' && typeof requestId === 'string') {
        setVerified(true);
        setError(null);
        setVerification((previous) => (previous ? { ...previous, requestId } : previous));
      } else if (status === 'cancelled') {
        setError('Verification was cancelled.');
      } else {
        const reason = parsed.queryParams?.reason;
        setError(typeof reason === 'string' ? reason : 'Verification failed.');
      }
    };

    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    void Linking.getInitialURL().then((url) => url && handle(url));

    return () => subscription.remove();
  }, []);

  const startVerification = useMutation({
    mutationFn: () => api.post<VerificationStart>(`/api/v1/players/${playerId}/consent/verify`, {}),
    onSuccess: async (start) => {
      setVerification(start);
      setError(null);

      if (start.isRedirectFlow && start.redirectUrl) {
        // The browser session closes itself on the deep-link redirect; the
        // listener above picks up the outcome.
        await WebBrowser.openAuthSessionAsync(start.redirectUrl, 'kyros://consent-callback');
        return;
      }

      // Non-redirect verifiers finish here.
      try {
        await api.put<VerificationComplete>(`/api/v1/players/${playerId}/consent/verify`, {
          requestId: start.requestId,
          payload: start.method === 'MOCK' ? { confirm: true } : {},
        });
        setVerified(true);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Verification failed.');
      }
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Could not start verification.'),
  });

  const grant = useMutation({
    mutationFn: () => {
      if (!verification || !screen.data) throw new Error('Verification has not been completed.');

      const scopes = [
        ...screen.data.purposes.filter((purpose) => purpose.required).map((purpose) => purpose.scope),
        ...screen.data.purposes
          .filter((purpose) => !purpose.required && optionalChoices[purpose.scope])
          .map((purpose) => purpose.scope),
      ];

      return api.post(`/api/v1/players/${playerId}/consent`, {
        scopes,
        verificationRequestId: verification.requestId,
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

        {verified ? (
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
            ✓ Identity verified
          </Text>
        ) : (
          <>
            <Button
              label={verification ? 'Try verification again' : 'Verify identity'}
              onPress={() => startVerification.mutate()}
              loading={startVerification.isPending}
            />
            {verification?.instruction && (
              <Text style={s.muted}>{verification.instruction}</Text>
            )}
          </>
        )}
      </Card>

      {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

      <Button
        label="I agree to the selected purposes"
        onPress={() => grant.mutate()}
        loading={grant.isPending}
        disabled={!verified}
      />
      {!verified && (
        <Text style={[s.muted, { textAlign: 'center' }]}>
          Verify your identity above before agreeing.
        </Text>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.md }}>
          Not now
        </Text>
      </Pressable>
    </ScrollView>
  );
}
