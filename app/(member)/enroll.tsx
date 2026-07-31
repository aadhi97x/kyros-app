import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type {
  ClubDetail,
  EnrollmentDecision,
  PlayerProfile,
} from '@/api/types';
import { Badge, Button, Card, ErrorState, Loading } from '@/ui/components';
import { colors, formatInr, radius, s, spacing } from '@/ui/theme';

/**
 * The adaptive enrollment flow (spec 2.7).
 *
 * This screen is intentionally dumb. It asks the server "what step is this
 * enrollment on?" and renders EXACTLY that step. It never guesses the next
 * screen, never assumes a club runs demos, approval or waitlists — the state
 * machine on the server branches on the club's config, and a club changing its
 * config mid-enrollment is handled by simply re-asking.
 */
export default function EnrollScreen() {
  const params = useLocalSearchParams<{ clubId: string; batchId?: string; packageId?: string }>();
  const queryClient = useQueryClient();

  const [playerProfileId, setPlayerProfileId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState(params.batchId || null);
  const [packageId, setPackageId] = useState(params.packageId || null);

  const players = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get<PlayerProfile[]>('/api/v1/players'),
  });

  const club = useQuery({
    queryKey: ['club', params.clubId],
    queryFn: () => api.get<ClubDetail>(`/api/v1/clubs/${params.clubId}`, undefined, true),
  });

  const decision = useQuery({
    queryKey: ['enrollment', playerProfileId, params.clubId, batchId, packageId],
    enabled: playerProfileId !== null,
    queryFn: () =>
      api.get<EnrollmentDecision>('/api/v1/enrollment', {
        playerProfileId: playerProfileId!,
        clubId: params.clubId,
        batchId: batchId ?? undefined,
        packageId: packageId ?? undefined,
      }),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['enrollment'] });

  const enroll = useMutation({
    mutationFn: (usePartPayment: boolean) =>
      api.post<{ membershipId: string; totalPaise: number; instalmentCount: number }>(
        '/api/v1/enrollment',
        {
          playerProfileId,
          clubId: params.clubId,
          batchId,
          packageId,
          usePartPayment,
          selectedAddOnNames: [],
          applyWalletCredit: true,
        },
      ),
    onSuccess: () => refresh(),
  });

  const joinWaitlist = useMutation({
    mutationFn: () =>
      api.post<{ position: number; message: string }>('/api/v1/enrollment/waitlist', {
        playerProfileId,
        clubId: params.clubId,
        batchId,
      }),
    onSuccess: () => refresh(),
  });

  // ------------------------------------------------------------------
  // Step 0 (client-side): whose enrollment is this?
  // ------------------------------------------------------------------
  if (players.isLoading || club.isLoading) return <Loading />;
  if (players.isError) {
    return <ErrorState message="Could not load your players." onRetry={() => players.refetch()} />;
  }

  if (!playerProfileId) {
    const activePlayers = (players.data ?? []).filter((player) => player.status === 'ACTIVE');
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Text style={s.h1}>Who is enrolling?</Text>
        {activePlayers.length === 0 && (
          <Card>
            <Text style={s.body}>No player profiles yet.</Text>
            <Button
              label="Add a player"
              onPress={() => router.push('/(member)/family')}
            />
          </Card>
        )}
        {activePlayers.map((player) => (
          <Pressable key={player.id} onPress={() => setPlayerProfileId(player.id)}>
            <Card>
              <View style={s.rowBetween}>
                <Text style={s.h3}>{player.fullName}</Text>
                <Text style={s.muted}>{player.ageYears} yrs</Text>
              </View>
              {player.isMinor && !player.consent.satisfied && (
                <Text style={{ color: colors.warn, fontSize: 13 }}>
                  Consent needed before enrolling — we’ll walk you through it.
                </Text>
              )}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  // ------------------------------------------------------------------
  // Every later step: render what the server says.
  // ------------------------------------------------------------------
  if (decision.isLoading) return <Loading label="Checking where you are…" />;
  if (decision.isError || !decision.data) {
    const message =
      decision.error instanceof ApiError ? decision.error.message : 'Could not load the next step.';
    return <ErrorState message={message} onRetry={() => decision.refetch()} />;
  }

  const step = decision.data;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <StepHeader decision={step} />

      {step.step === 'CONSENT_REQUIRED' && (
        <Button
          label="Give consent"
          onPress={() =>
            router.push({ pathname: '/(member)/consent/[playerId]', params: { playerId: playerProfileId } })
          }
        />
      )}

      {step.step === 'BOOK_DEMO' && (
        <Button
          label="See demo slots"
          onPress={() =>
            router.push({
              pathname: '/(member)/demo/[clubId]',
              params: { clubId: params.clubId, playerProfileId },
            })
          }
        />
      )}

      {step.step === 'SELECT_BATCH' && club.data && (
        <BatchPicker
          club={club.data}
          playerAge={
            players.data?.find((player) => player.id === playerProfileId)?.ageYears ?? null
          }
          onPick={(picked) => {
            setBatchId(picked);
            setPackageId(null);
            void refresh();
          }}
        />
      )}

      {step.step === 'SELECT_PACKAGE' && club.data && batchId && (
        <PackagePicker
          club={club.data}
          batchId={batchId}
          onPick={(picked) => {
            setPackageId(picked);
            void refresh();
          }}
        />
      )}

      {step.step === 'OFFER_WAITLIST' && (
        <View style={{ gap: spacing.md }}>
          <Button
            label="Join the waitlist"
            onPress={() => joinWaitlist.mutate()}
            loading={joinWaitlist.isPending}
          />
          <Button
            label="Look at other batches"
            variant="ghost"
            onPress={() => {
              setBatchId(null);
              setPackageId(null);
              void refresh();
            }}
          />
        </View>
      )}

      {step.step === 'PAYMENT' && (
        <PaymentActions
          decision={step}
          onPayFull={() => enroll.mutate(false)}
          onPayInstalments={() => enroll.mutate(true)}
          busy={enroll.isPending}
          error={enroll.error instanceof ApiError ? enroll.error.message : null}
        />
      )}

      {(step.step === 'AGE_BAND_MISMATCH' || step.step === 'CAPACITY_BLOCKED') && (
        <Button
          label="Browse other batches"
          variant="secondary"
          onPress={() => {
            setBatchId(null);
            setPackageId(null);
            void refresh();
          }}
        />
      )}

      {step.step === 'ACTIVE' && (
        <Button label="See my memberships" onPress={() => router.replace('/(member)/memberships')} />
      )}

      {/* Spec 2.6: the "what happens next" timeline, straight from the API. */}
      {step.remainingSteps.length > 0 && !step.terminal && (
        <Card>
          <Text style={s.label}>What happens next</Text>
          {step.remainingSteps.map((remaining, index) => (
            <Text key={remaining} style={s.muted}>
              {index + 1}. {STEP_LABELS[remaining] ?? remaining}
            </Text>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const STEP_LABELS: Record<string, string> = {
  CONSENT_REQUIRED: 'Guardian consent',
  BOOK_DEMO: 'Book a demo session',
  AWAITING_DEMO: 'Attend the demo',
  AWAITING_DEMO_FEEDBACK: 'Coach writes up the demo',
  POST_DEMO_REVIEW: 'See your feedback and recommended batch',
  AWAITING_BATCH_ASSIGNMENT: 'Coach assigns the batch',
  SELECT_BATCH: 'Choose a batch',
  SELECT_PACKAGE: 'Choose a package',
  TRIAL_AVAILABLE: 'Optional trial class',
  PAYMENT: 'Pay and confirm',
  AWAITING_APPROVAL: 'Club reviews the enrollment',
  ACTIVE: 'Training starts',
};

function StepHeader({ decision }: { decision: EnrollmentDecision }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Badge
        label={decision.terminal && decision.step !== 'ACTIVE' ? 'BLOCKED' : decision.step.replace(/_/g, ' ')}
        tone={decision.step === 'ACTIVE' ? 'ACTIVE' : decision.terminal ? 'CANCELLED' : 'PENDING_PAYMENT'}
      />
      <Text style={s.h1}>{STEP_LABELS[decision.step] ?? 'Enrollment'}</Text>
      <Text style={s.body}>{decision.reason}</Text>
    </View>
  );
}

function BatchPicker({
  club,
  playerAge,
  onPick,
}: {
  club: ClubDetail;
  playerAge: number | null;
  onPick: (batchId: string) => void;
}) {
  const batches = useMemo(
    () =>
      club.batches.map((batch) => ({
        ...batch,
        ageFits:
          playerAge === null || (playerAge >= batch.minAge && playerAge <= batch.maxAge),
      })),
    [club.batches, playerAge],
  );

  return (
    <View style={{ gap: spacing.md }}>
      {batches.map((batch) => (
        <Pressable
          key={batch.id}
          disabled={!batch.ageFits}
          onPress={() => onPick(batch.id)}
          style={{ opacity: batch.ageFits ? 1 : 0.45 }}
        >
          <Card>
            <View style={s.rowBetween}>
              <Text style={s.h3}>{batch.name}</Text>
              <Text style={s.muted}>
                {batch.spotsLeft > 0 ? `${batch.spotsLeft} places` : 'Full'}
              </Text>
            </View>
            <Text style={s.muted}>
              Ages {batch.minAge}–{batch.maxAge} · {batch.skillLevel.toLowerCase()}
            </Text>
            {!batch.ageFits && (
              <Text style={{ color: colors.warn, fontSize: 13 }}>
                Outside this batch’s age band
              </Text>
            )}
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function PackagePicker({
  club,
  batchId,
  onPick,
}: {
  club: ClubDetail;
  batchId: string;
  onPick: (packageId: string) => void;
}) {
  const batch = club.batches.find((candidate) => candidate.id === batchId);
  if (!batch) return null;

  return (
    <View style={{ gap: spacing.md }}>
      {batch.packages.map((pkg) => (
        <Pressable key={pkg.id} onPress={() => onPick(pkg.id)}>
          <Card>
            <View style={s.rowBetween}>
              <Text style={s.h3}>{pkg.tierName}</Text>
              <Text style={[s.body, { fontWeight: '700' }]}>{formatInr(pkg.pricePaise)}</Text>
            </View>
            {pkg.registrationFeePaise > 0 && (
              <Text style={s.muted}>+ {formatInr(pkg.registrationFeePaise)} registration</Text>
            )}
            {pkg.inclusions.length > 0 && <Text style={s.muted}>{pkg.inclusions.join(' · ')}</Text>}
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function PaymentActions({
  decision,
  onPayFull,
  onPayInstalments,
  busy,
  error,
}: {
  decision: EnrollmentDecision;
  onPayFull: () => void;
  onPayInstalments: () => void;
  busy: boolean;
  error: string | null;
}) {
  const canInstal = decision.availableActions.includes('PAY_INSTALMENT');
  return (
    <View style={{ gap: spacing.md }}>
      {error && (
        <View
          style={{
            backgroundColor: `${colors.danger}18`,
            borderColor: `${colors.danger}55`,
            borderWidth: 1,
            borderRadius: radius.sm,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>
        </View>
      )}
      <Button label="Pay in full" onPress={onPayFull} loading={busy} />
      {canInstal && (
        <Button label="Pay in instalments" variant="secondary" onPress={onPayInstalments} disabled={busy} />
      )}
      <Text style={s.muted}>
        Wallet credit on your account is applied automatically. Payment is processed securely; you
        will get a receipt in your payment history.
      </Text>
    </View>
  );
}
