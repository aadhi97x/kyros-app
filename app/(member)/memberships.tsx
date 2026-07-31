import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { MembershipsResponse } from '@/api/types';
import { Badge, Card, EmptyState, ErrorState, Loading } from '@/ui/components';
import { colors, formatInr, s, spacing } from '@/ui/theme';

/**
 * "My memberships" (spec 2.9): each player and their memberships with status
 * badges, plus the ACCOUNT-level wallet (spec 2.8) — a parent with two children
 * sees one balance, not two.
 */
export default function MembershipsScreen() {
  const query = useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.get<MembershipsResponse>('/api/v1/memberships'),
  });

  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data) {
    return <ErrorState message="Could not load memberships." onRetry={() => query.refetch()} />;
  }

  const { walletBalancePaise, players } = query.data;
  const hasAny = players.some((player) => player.memberships.length > 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Card>
        <Text style={s.label}>Family wallet</Text>
        <Text style={[s.h1, { color: colors.accent }]}>{formatInr(walletBalancePaise)}</Text>
        <Text style={s.muted}>
          Credit from pauses, downgrades and refunds. Applies automatically at the next payment, for
          any player on this account.
        </Text>
      </Card>

      {!hasAny && (
        <EmptyState
          title="No memberships yet"
          body="Find a club in Discover — enrollment takes a couple of minutes."
        />
      )}

      {players.map((player) =>
        player.memberships.length === 0 ? null : (
          <View key={player.id} style={{ gap: spacing.md }}>
            <Text style={s.h2}>{player.fullName}</Text>

            {player.memberships.map((membership) => (
              <Card key={membership.id}>
                <View style={s.rowBetween}>
                  <Text style={s.h3}>{membership.club.name}</Text>
                  <Badge label={membership.status.replace(/_/g, ' ')} tone={membership.status} />
                </View>
                <Text style={s.muted}>
                  {membership.batch.name} · {membership.package.tierName} ·{' '}
                  {membership.batch.centre.name}
                </Text>

                <View style={s.rowBetween}>
                  <Text style={s.muted}>Paid</Text>
                  <Text style={s.body}>
                    {formatInr(membership.paidPaise)} of {formatInr(membership.totalPaise)}
                  </Text>
                </View>

                {membership.outstandingPaise > 0 && (
                  <View style={s.rowBetween}>
                    <Text style={{ color: colors.warn, fontSize: 13 }}>Outstanding</Text>
                    <Text style={{ color: colors.warn, fontSize: 14, fontWeight: '600' }}>
                      {formatInr(membership.outstandingPaise)}
                    </Text>
                  </View>
                )}

                {membership.instalments.filter((instalment) => !instalment.paidAt).length > 0 && (
                  <View style={{ gap: spacing.xs }}>
                    <Text style={s.label}>Upcoming instalments</Text>
                    {membership.instalments
                      .filter((instalment) => !instalment.paidAt)
                      .map((instalment) => (
                        <View key={instalment.id} style={s.rowBetween}>
                          <Text style={instalment.overdue ? { color: colors.danger, fontSize: 13 } : s.muted}>
                            #{instalment.sequence} ·{' '}
                            {new Date(instalment.dueDate).toLocaleDateString('en-IN')}
                            {instalment.overdue ? ' · overdue' : ''}
                          </Text>
                          <Text style={s.body}>{formatInr(instalment.amountPaise)}</Text>
                        </View>
                      ))}
                  </View>
                )}

                {/* Spec 2.9: show the rules THIS club set, from its config. */}
                <Text style={[s.muted, { fontSize: 12 }]}>
                  {membership.policies.pauseAllowed
                    ? `Pause: ${membership.policies.pauseMinDays}–${membership.policies.pauseMaxDaysPerYear} days/yr, ${membership.policies.pauseNoticeDays}d notice. `
                    : 'Pauses not offered. '}
                  Cancel: {membership.policies.cancellationNoticeDays}d notice.
                </Text>
              </Card>
            ))}
          </View>
        ),
      )}
    </ScrollView>
  );
}
