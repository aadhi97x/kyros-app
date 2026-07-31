import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { PlayerProfile } from '@/api/types';
import { useSession } from '@/state/session';
import { Badge, Button, Card, ErrorState, Loading } from '@/ui/components';
import { colors, s, spacing } from '@/ui/theme';

/**
 * Player profiles + account settings (spec 2.2, 2.14). One account, N players.
 * The consent state of each minor is surfaced here, with the management path
 * (view / withdraw) one tap away — spec 2.3 requires withdrawal to be as easy
 * to find as the original grant.
 */
export default function FamilyScreen() {
  const { account, signOut } = useSession();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);

  const players = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get<PlayerProfile[]>('/api/v1/players'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string; requiresConsent: boolean }>('/api/v1/players', {
        fullName: name,
        dateOfBirth: dob,
      }),
    onSuccess: async (created) => {
      setAdding(false);
      setName('');
      setDob('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      // Spec 2.3: a minor's consent screen comes BEFORE any further processing.
      if (created.requiresConsent) {
        router.push({ pathname: '/(member)/consent/[playerId]', params: { playerId: created.id } });
      }
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Could not add the player.'),
  });

  if (players.isLoading) return <Loading />;
  if (players.isError) {
    return <ErrorState message="Could not load your family." onRetry={() => players.refetch()} />;
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>{account?.name}</Text>
      <Text style={s.muted}>{account?.phone}</Text>

      <Text style={[s.h2, { marginTop: spacing.md }]}>Players</Text>

      {(players.data ?? []).map((player) => (
        <Card key={player.id}>
          <View style={s.rowBetween}>
            <Text style={s.h3}>{player.fullName}</Text>
            <Badge label={player.status} tone={player.status === 'ACTIVE' ? 'ACTIVE' : 'CANCELLED'} />
          </View>
          <Text style={s.muted}>
            {player.ageYears} years · {player.positions.join(', ') || 'position not set'}
          </Text>

          {player.isMinor && (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(member)/consent/[playerId]', params: { playerId: player.id } })
              }
            >
              <Text
                style={{
                  color: player.consent.satisfied ? colors.accent : colors.warn,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {player.consent.satisfied
                  ? 'Consent on file — tap to review or withdraw'
                  : 'Consent needed — tap to provide'}
              </Text>
            </Pressable>
          )}

          {player.memberships.length > 0 && (
            <Text style={s.muted}>
              {player.memberships
                .map((membership) => `${membership.batch.club.name} (${membership.status.toLowerCase()})`)
                .join(' · ')}
            </Text>
          )}
        </Card>
      ))}

      {adding ? (
        <Card>
          <Text style={s.h3}>New player</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={s.input}
            value={dob}
            onChangeText={setDob}
            placeholder="Date of birth (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={s.muted}>
            Whether a player is a minor is worked out from the date of birth — for a child, the
            consent step follows automatically.
          </Text>
          {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}
          <Button
            label="Add player"
            onPress={() => create.mutate()}
            loading={create.isPending}
            disabled={!name || !/^\d{4}-\d{2}-\d{2}$/.test(dob)}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button label="Add a player" variant="secondary" onPress={() => setAdding(true)} />
      )}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label="Sign out"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        />
      </View>
    </ScrollView>
  );
}
