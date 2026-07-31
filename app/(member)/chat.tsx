import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ChatThread } from '@/api/types';
import { Card, EmptyState, ErrorState, Loading } from '@/ui/components';
import { colors, radius, s, spacing } from '@/ui/theme';

/** Batch group chats (spec 2.12). Clubs that switched chat off never appear. */
export default function ChatListScreen() {
  const query = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => api.get<ChatThread[]>('/api/v1/chat/threads'),
    refetchInterval: 30_000,
  });

  if (query.isLoading) return <Loading />;
  if (query.isError) {
    return <ErrorState message="Could not load conversations." onRetry={() => query.refetch()} />;
  }

  return (
    <View style={s.screen}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={
          <EmptyState
            title="No conversations"
            body="Batch group chats appear here once you are enrolled with a club that has chat enabled."
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(member)/thread/${item.id}`)}>
            <Card>
              <View style={s.rowBetween}>
                <Text style={s.h3}>{item.title}</Text>
                {item.unreadCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: radius.pill,
                      minWidth: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text style={{ color: colors.bg, fontSize: 12, fontWeight: '700' }}>
                      {item.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={s.muted}>{item.club.name}</Text>
              {item.lastMessage && (
                <Text style={s.muted} numberOfLines={1}>
                  {item.lastMessage.senderAccount.name}: {item.lastMessage.body}
                </Text>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
