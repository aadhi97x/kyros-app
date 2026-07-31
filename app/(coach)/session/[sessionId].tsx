import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { api, ApiError } from '@/api/client';
import type { CoachSession } from '@/api/types';
import {
  enqueueMark,
  flush,
  pendingForSession,
  type AttendanceMark,
} from '@/offline/attendance-queue';
import { Button, Card, ErrorState, Loading, OfflineBanner } from '@/ui/components';
import { colors, radius, s, spacing } from '@/ui/theme';

const MARKS: Array<{ value: AttendanceMark; label: string; color: string }> = [
  { value: 'PRESENT', label: 'P', color: colors.accent },
  { value: 'LATE', label: 'L', color: colors.warn },
  { value: 'ABSENT', label: 'A', color: colors.danger },
];

/**
 * The attendance screen (spec 4.3): a roster with one tap per player.
 *
 * OFFLINE-FIRST. Every tap goes straight to the on-device queue and updates
 * the UI from that queue — never from a network response. The flush runs
 * opportunistically and the roster carries on regardless of what the radio is
 * doing. The one thing that must never happen here is a coach's tap waiting on
 * a spinner in the middle of a session.
 */
export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [local, setLocal] = useState<Map<string, AttendanceMark>>(new Map());
  const [pendingTotal, setPendingTotal] = useState(0);
  const [checkInState, setCheckInState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const session = useQuery({
    queryKey: ['coach-session', sessionId],
    queryFn: async () => {
      const sessions = await api.get<CoachSession[]>('/api/v1/sessions/today');
      const found = sessions.find((candidate) => candidate.id === sessionId);
      if (!found) throw new Error('Session not found in today’s list.');
      return found;
    },
    // The roster barely changes mid-session; do not chew the radio for it.
    staleTime: 5 * 60_000,
  });

  const reloadQueueState = useCallback(async () => {
    if (!sessionId) return;
    setLocal(await pendingForSession(sessionId));
    const { remaining } = await flush().catch(() => ({ remaining: 0 }));
    setPendingTotal(remaining);
  }, [sessionId]);

  useEffect(() => {
    void reloadQueueState();
  }, [reloadQueueState]);

  const mark = async (playerProfileId: string, status: AttendanceMark) => {
    if (!sessionId) return;
    // Optimistic and local-first: update state and the on-disk queue, then let
    // the background flush deal with the network whenever it can.
    setLocal((previous) => new Map(previous).set(playerProfileId, status));
    await enqueueMark({ sessionId, playerProfileId, status });
    void flush().then((result) => setPendingTotal(result.remaining));
  };

  const checkIn = async () => {
    if (!session.data) return;
    setCheckInState({ kind: 'busy' });

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setCheckInState({ kind: 'error', message: 'Location permission is needed to check in.' });
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result = await api.post<{ accepted: boolean; distanceM: number; flagged: boolean }>(
        '/api/v1/coach/check-in',
        {
          sessionId: session.data.id,
          centreId: session.data.centre.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? undefined,
        },
      );

      setCheckInState({
        kind: 'done',
        message: result.flagged
          ? `Checked in ${result.distanceM}m from the centre — flagged for the owner to review.`
          : `Checked in, ${result.distanceM}m from the centre.`,
      });
    } catch (caught) {
      setCheckInState({
        kind: 'error',
        message: caught instanceof ApiError ? caught.message : 'Check-in failed.',
      });
    }
  };

  if (session.isLoading) return <Loading label="Loading roster…" />;
  if (session.isError || !session.data) {
    return <ErrorState message="Could not load this session." onRetry={() => session.refetch()} />;
  }

  const roster = session.data.roster;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>{session.data.batch.name}</Text>
      <Text style={s.muted}>
        {new Date(session.data.startsAt).toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
        })}{' '}
        · {session.data.centre.name}
      </Text>

      <OfflineBanner pending={pendingTotal} />

      {/* Spec 4.2: geofenced "I'm here". */}
      <Card>
        {checkInState.kind === 'done' ? (
          <Text style={{ color: colors.accent, fontSize: 14 }}>{checkInState.message}</Text>
        ) : (
          <>
            <Button
              label="I’m here — check in"
              variant="secondary"
              onPress={checkIn}
              loading={checkInState.kind === 'busy'}
            />
            {checkInState.kind === 'error' && (
              <Text style={{ color: colors.danger, fontSize: 13 }}>{checkInState.message}</Text>
            )}
          </>
        )}
      </Card>

      <Text style={s.h2}>Roster ({roster.length})</Text>

      {roster.map((entry) => {
        // The queue is the source of truth for this device; the server's mark
        // fills in only where the device has nothing newer.
        const current = local.get(entry.playerProfileId) ?? entry.currentMark;

        return (
          <Card key={entry.playerProfileId}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.h3}>{entry.fullName}</Text>
                {entry.positions.length > 0 && (
                  <Text style={s.muted}>{entry.positions.join(', ')}</Text>
                )}
                {entry.medicalNotes && (
                  <Text style={{ color: colors.warn, fontSize: 12 }}>⚕ {entry.medicalNotes}</Text>
                )}
              </View>

              <View style={s.row}>
                {MARKS.map(({ value, label, color }) => {
                  const selected = current === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${entry.fullName} ${value.toLowerCase()}`}
                      onPress={() => mark(entry.playerProfileId, value)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? color : colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: selected ? color : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.bg : colors.textMuted,
                          fontWeight: '800',
                          fontSize: 16,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        );
      })}

      <Text style={[s.muted, { textAlign: 'center', paddingBottom: spacing.xl }]}>
        Every tap is saved on this device immediately and syncs on its own. You can mark the whole
        session with no signal.
      </Text>
    </ScrollView>
  );
}
