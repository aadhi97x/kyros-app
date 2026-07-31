import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CoachSession } from '@/api/types';
import { flush, pendingCount } from '@/offline/attendance-queue';
import { Badge, Card, EmptyState, ErrorState, Loading, OfflineBanner } from '@/ui/components';
import { colors, s } from '@/ui/theme';

/**
 * Coach landing screen (spec 4.1): today's batches and timings at a glance.
 * The response includes full rosters, so the app can cache everything it needs
 * to mark attendance with no connectivity at all.
 */
export default function TodayScreen() {
  const [pending, setPending] = useState(0);

  const query = useQuery({
    queryKey: ['coach-today'],
    queryFn: () => api.get<CoachSession[]>('/api/v1/sessions/today'),
  });

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPending();
    }, [refreshPending]),
  );

  // Try to drain the queue whenever this screen is mounted — it is the screen
  // a coach returns to after a session, which is exactly when the connection
  // tends to come back.
  useEffect(() => {
    void flush().then(refreshPending);
  }, [refreshPending]);

  if (query.isLoading) return <Loading label="Loading today’s sessions…" />;
  if (query.isError) {
    return (
      <ErrorState message="Could not load sessions. Marks you make are still saved on the device." onRetry={() => query.refetch()} />
    );
  }

  const sessions = query.data ?? [];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            void flush().then(refreshPending);
            void query.refetch();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <OfflineBanner pending={pending} />

      {sessions.length === 0 && (
        <EmptyState title="No sessions today" body="Enjoy the rest day — tomorrow’s schedule will appear here." />
      )}

      {sessions.map((session) => {
        const startsAt = new Date(session.startsAt);
        const marked = session.roster.filter((entry) => entry.currentMark !== null).length;

        return (
          <Pressable
            key={session.id}
            onPress={() => router.push(`/(coach)/session/${session.id}`)}
          >
            <Card>
              <View style={s.rowBetween}>
                <Text style={s.h3}>{session.batch.name}</Text>
                <Badge
                  label={session.attendanceComplete ? 'MARKED' : 'PENDING'}
                  tone={session.attendanceComplete ? 'ACTIVE' : 'PENDING_PAYMENT'}
                />
              </View>
              <Text style={s.muted}>
                {startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} ·{' '}
                {session.centre.name}
              </Text>
              {session.syllabusModule && <Text style={s.muted}>📘 {session.syllabusModule}</Text>}
              <Text style={s.muted}>
                {marked}/{session.roster.length} marked
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
