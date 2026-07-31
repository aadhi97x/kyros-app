import { ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { DemoSlotsResponse } from '@/api/types';
import { Button, Card, EmptyState, ErrorState, Loading } from '@/ui/components';
import { colors, formatInr, s } from '@/ui/theme';

/** Demo booking (spec 2.6) — pick a slot, confirm which player it is for. */
export default function DemoBookingScreen() {
  const params = useLocalSearchParams<{ clubId: string; playerProfileId: string }>();
  const queryClient = useQueryClient();

  const slots = useQuery({
    queryKey: ['demo-slots', params.clubId],
    queryFn: () => api.get<DemoSlotsResponse>('/api/v1/demos', { clubId: params.clubId }),
  });

  const book = useMutation({
    mutationFn: (demoSlotId: string) =>
      api.post('/api/v1/demos', {
        clubId: params.clubId,
        playerProfileId: params.playerProfileId,
        demoSlotId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      router.back();
    },
  });

  if (slots.isLoading) return <Loading label="Finding demo slots…" />;
  if (slots.isError || !slots.data) {
    return <ErrorState message="Could not load demo slots." onRetry={() => slots.refetch()} />;
  }

  if (!slots.data.demoEnabled) {
    return (
      <EmptyState
        title="No demos here"
        body="This club enrolls directly — go back and continue the enrollment."
      />
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>Pick a demo slot</Text>
      {slots.data.feePaise !== undefined && slots.data.feePaise > 0 ? (
        <Text style={s.muted}>Demo fee: {formatInr(slots.data.feePaise)}</Text>
      ) : (
        <Text style={s.muted}>The demo is free.</Text>
      )}

      {book.error instanceof ApiError && (
        <Text style={{ color: colors.danger, fontSize: 14 }}>{book.error.message}</Text>
      )}

      {slots.data.slots.length === 0 && (
        <EmptyState
          title="No open slots right now"
          body="The club releases demo slots on a rolling basis — check back tomorrow."
        />
      )}

      {slots.data.slots.map((slot) => {
        const startsAt = new Date(slot.startsAt);
        return (
          <Card key={slot.id}>
            <Text style={s.h3}>
              {startsAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={s.muted}>
              {startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} ·{' '}
              {slot.centre.name}, {slot.centre.city}
            </Text>
            <Text style={s.muted}>
              {slot.placesLeft} place{slot.placesLeft === 1 ? '' : 's'} left
            </Text>
            <Button
              label="Book this slot"
              variant="secondary"
              onPress={() => book.mutate(slot.id)}
              loading={book.isPending}
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}
