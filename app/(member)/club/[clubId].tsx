import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ClubDetail } from '@/api/types';
import { Badge, Button, Card, ErrorState, Loading } from '@/ui/components';
import { colors, formatInr, formatSchedule, s, spacing } from '@/ui/theme';

/**
 * Club + package detail (spec 2.5).
 *
 * The primary button is DYNAMIC: `callToAction` comes from the club's config
 * via the API — "Book a demo", "Start a trial" or "Enroll now". The app never
 * decides this itself; that is the whole point of the config engine.
 */
export default function ClubDetailScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();

  const query = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => api.get<ClubDetail>(`/api/v1/clubs/${clubId}`, undefined, true),
  });

  if (query.isLoading) return <Loading label="Loading club…" />;
  if (query.isError || !query.data) {
    return <ErrorState message="Could not load this club." onRetry={() => query.refetch()} />;
  }

  const club = query.data;

  const ctaLabel =
    club.callToAction === 'BOOK_DEMO'
      ? 'Book a demo'
      : club.callToAction === 'START_TRIAL'
        ? 'Start with a trial'
        : 'Enroll now';

  const startEnrollment = (batchId?: string, packageId?: string) => {
    router.push({
      pathname: '/(member)/enroll',
      params: { clubId: club.id, batchId: batchId ?? '', packageId: packageId ?? '' },
    });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>{club.name}</Text>
      {club.description && <Text style={s.body}>{club.description}</Text>}
      <Text style={s.muted}>
        {club.rating > 0 ? `★ ${club.rating.toFixed(1)} · ${club.ratingCount} ratings · ` : ''}
        {club.centres.map((centre) => centre.city).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      </Text>

      {/* Spec 2.5: dynamic primary button, driven by that club's config. */}
      <Button label={ctaLabel} onPress={() => startEnrollment()} />

      <Text style={[s.h2, { marginTop: spacing.md }]}>Centres</Text>
      {club.centres.map((centre) => (
        <Card key={centre.id}>
          <Text style={s.h3}>{centre.name}</Text>
          <Text style={s.muted}>{centre.address}</Text>
          {centre.amenities.length > 0 && (
            <Text style={s.muted}>{centre.amenities.join(' · ')}</Text>
          )}
        </Card>
      ))}

      <Text style={[s.h2, { marginTop: spacing.md }]}>Batches & packages</Text>
      {club.batches.map((batch) => (
        <Card key={batch.id}>
          <View style={s.rowBetween}>
            <Text style={s.h3}>{batch.name}</Text>
            <Badge label={batch.mode} tone={batch.mode === 'ACADEMY' ? 'ACTIVE' : 'INFO'} />
          </View>
          <Text style={s.muted}>
            Ages {batch.minAge}–{batch.maxAge} · {batch.skillLevel.toLowerCase()} ·{' '}
            {formatSchedule(batch.schedule)}
          </Text>
          {batch.coach && (
            <Text style={s.muted}>
              Coach {batch.coach.name}
              {batch.coach.qualification ? ` · ${batch.coach.qualification}` : ''}
            </Text>
          )}
          <Text style={batch.spotsLeft > 0 ? s.muted : { color: colors.warn, fontSize: 13 }}>
            {batch.spotsLeft > 0
              ? `${batch.spotsLeft} of ${batch.capacity} places open`
              : club.config.waitlistEnabled
                ? 'Full — waitlist open'
                : 'Full'}
          </Text>

          {/* Spec 2.5: exact price breakdown — registration, price, add-ons as
              separate lines. Never one opaque number. */}
          {batch.packages.map((pkg) => (
            <View
              key={pkg.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: spacing.md,
                marginTop: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <View style={s.rowBetween}>
                <Text style={[s.body, { fontWeight: '600' }]}>{pkg.tierName}</Text>
                <Text style={[s.body, { fontWeight: '700' }]}>
                  {formatInr(pkg.pricePaise)}
                  <Text style={s.muted}>
                    {pkg.billingType === 'MONTHLY'
                      ? '/month'
                      : pkg.billingType === 'TERM'
                        ? `/${pkg.termMonths ?? 3} months`
                        : pkg.billingType === 'CREDIT_PACK'
                          ? ` · ${pkg.creditSessions} sessions`
                          : ''}
                  </Text>
                </Text>
              </View>

              {pkg.registrationFeePaise > 0 && (
                <Text style={s.muted}>+ {formatInr(pkg.registrationFeePaise)} one-time registration</Text>
              )}
              {pkg.addOns.map((addOn) => (
                <Text key={addOn.id} style={s.muted}>
                  + {formatInr(addOn.pricePaise)} {addOn.name}
                  {addOn.mandatory ? ' (required)' : ' (optional)'}
                </Text>
              ))}
              {pkg.inclusions.length > 0 && (
                <Text style={s.muted}>{pkg.inclusions.join(' · ')}</Text>
              )}
              {pkg.partPaymentAllowed && club.config.partPaymentAllowed && (
                <Text style={{ color: colors.accent, fontSize: 13 }}>
                  Instalments available ({club.config.partPaymentSplits} payments)
                </Text>
              )}

              <Button
                label={ctaLabel}
                variant="secondary"
                onPress={() => startEnrollment(batch.id, pkg.id)}
              />
            </View>
          ))}
        </Card>
      ))}

      <Text style={[s.h2, { marginTop: spacing.md }]}>How this club works</Text>
      <Card>
        <Text style={s.muted}>
          {club.config.demoEnabled
            ? club.config.demoRequiredBeforeEnrollment
              ? '• A demo session is required before enrolling.'
              : '• Demo sessions are offered.'
            : '• No demo needed — enroll directly.'}
        </Text>
        <Text style={s.muted}>
          {club.config.memberPicksBatch
            ? '• You choose the batch.'
            : '• A coach places each player in the right batch.'}
        </Text>
        <Text style={s.muted}>
          {club.config.approvalRequired
            ? '• Enrollments are reviewed by the club before activating.'
            : '• Enrollment activates as soon as payment succeeds.'}
        </Text>
        <Text style={s.muted}>
          {club.config.pauseAllowed
            ? `• Memberships can be paused (${club.config.pauseMinDays}–${club.config.pauseMaxDaysPerYear} days/year).`
            : '• Memberships cannot be paused.'}
        </Text>
        <Text style={s.muted}>
          • Cancellation needs {club.config.cancellationNoticeDays} days’ notice.
        </Text>
      </Card>
    </ScrollView>
  );
}
