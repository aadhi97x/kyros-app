import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from '@/api/client';
import type { ChatMessage } from '@/api/types';
import { useSession } from '@/state/session';
import { Button, ErrorState, Loading } from '@/ui/components';
import { colors, radius, s, spacing } from '@/ui/theme';

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { account } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const messages = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => api.get<ChatMessage[]>(`/api/v1/chat/threads/${threadId}/messages`),
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<ChatMessage>(`/api/v1/chat/threads/${threadId}/messages`, {
        body,
        // Idempotent send: a retry after a timeout must not double-post.
        clientMutationId: Crypto.randomUUID(),
      }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    },
  });

  if (messages.isLoading) return <Loading />;
  if (messages.isError) {
    return <ErrorState message="Could not load messages." onRetry={() => messages.refetch()} />;
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={[...(messages.data ?? [])].reverse()}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => {
          const mine = item.senderAccount.id === account?.id;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? colors.accentDark : colors.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                maxWidth: '82%',
                gap: 2,
              }}
            >
              {!mine && (
                <Text style={{ color: colors.info, fontSize: 12, fontWeight: '600' }}>
                  {item.senderAccount.name}
                </Text>
              )}
              <Text style={s.body}>{item.body}</Text>
              <Text style={{ color: `${colors.text}77`, fontSize: 10, alignSelf: 'flex-end' }}>
                {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          );
        }}
      />

      {send.error instanceof ApiError && (
        <Text style={{ color: colors.danger, paddingHorizontal: spacing.lg, fontSize: 13 }}>
          {send.error.message}
        </Text>
      )}

      <View style={[s.row, { padding: spacing.lg, paddingTop: spacing.sm }]}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Button
          label="Send"
          onPress={() => draft.trim() && send.mutate(draft.trim())}
          loading={send.isPending}
          disabled={!draft.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
