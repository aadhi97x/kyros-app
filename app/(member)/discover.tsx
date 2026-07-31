import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CatalogCard } from '@/api/types';
import { Badge, Card, EmptyState, ErrorState, Loading } from '@/ui/components';
import { colors, formatInr, formatSchedule, radius, s, spacing } from '@/ui/theme';

type ModeFilter = 'ALL' | 'ACADEMY' | 'CREDITS';

/**
 * The discovery catalog (spec 2.4). One consistent experience across every
 * published club — filters map straight onto the API's query parameters.
 */
export default function DiscoverScreen() {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [age, setAge] = useState('');

  const query = useQuery({
    queryKey: ['catalog', search, mode, age],
    queryFn: () =>
      api.get<CatalogCard[]>(
        '/api/v1/catalog',
        {
          q: search || undefined,
          mode: mode === 'ALL' ? undefined : mode,
          age: age || undefined,
        },
        true,
      ),
  });

  const chips = useMemo(
    () =>
      [
        { key: 'ALL' as const, label: 'All' },
        { key: 'ACADEMY' as const, label: 'Academy' },
        { key: 'CREDITS' as const, label: 'Pay per session' },
      ] satisfies Array<{ key: ModeFilter; label: string }>,
    [],
  );

  return (
    <View style={s.screen}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <TextInput
          style={s.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clubs, batches, areas…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />

        <View style={s.row}>
          {chips.map((chip) => {
            const active = mode === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setMode(chip.key)}
                style={{
                  backgroundColor: active ? colors.accentDark : colors.surfaceAlt,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}

          <TextInput
            style={[s.input, { flex: 1, paddingVertical: spacing.sm }]}
            value={age}
            onChangeText={setAge}
            placeholder="Age"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      {query.isLoading && <Loading label="Finding clubs…" />}
      {query.isError && (
        <ErrorState message="Could not load the catalog." onRetry={() => query.refetch()} />
      )}

      {query.data && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.batchId}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingTop: 0 }}
          ListEmptyComponent={
            <EmptyState
              title="Nothing matches"
              body="Try widening the filters — or check back soon, new clubs are joining."
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(member)/club/${item.clubId}`)}>
              <Card>
                <View style={s.rowBetween}>
                  <Text style={s.h3}>{item.clubName}</Text>
                  <Badge
                    label={item.mode === 'ACADEMY' ? 'ACADEMY' : 'CREDITS'}
                    tone={item.mode === 'ACADEMY' ? 'ACTIVE' : 'INFO'}
                  />
                </View>

                <Text style={s.body}>{item.batchName}</Text>
                <Text style={s.muted}>
                  {item.centreName}, {item.city}
                  {item.distanceKm !== null ? ` · ${item.distanceKm} km` : ''}
                </Text>
                <Text style={s.muted}>
                  Ages {item.minAge}–{item.maxAge} · {item.skillLevel.toLowerCase()} ·{' '}
                  {formatSchedule(item.schedule)}
                </Text>

                <View style={s.rowBetween}>
                  <Text style={[s.body, { fontWeight: '700' }]}>
                    {item.fromPricePaise !== null ? `From ${formatInr(item.fromPricePaise)}` : ''}
                  </Text>
                  <Text style={s.muted}>
                    {item.rating > 0 ? `★ ${item.rating.toFixed(1)} (${item.ratingCount})` : 'New'}
                  </Text>
                </View>

                {!item.hasSpace && (
                  <Text style={{ color: colors.warn, fontSize: 13 }}>
                    Batch full — waitlist may be available
                  </Text>
                )}
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
