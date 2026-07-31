import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { SessionProvider } from '@/state/session';
import { flush } from '@/offline/attendance-queue';
import { colors } from '@/ui/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Indian ground conditions: assume a poor connection and do not thrash it.
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  // Drain the offline attendance queue whenever the device regains a
  // connection. The queue itself is idempotent, so an over-eager flush is
  // harmless; a missed one would leave a coach's marks stranded.
  useEffect(() => {
    let cancelled = false;

    const attempt = async () => {
      if (cancelled) return;
      try {
        const state = await Network.getNetworkStateAsync();
        if (state.isConnected && state.isInternetReachable !== false) {
          await flush();
        }
      } catch {
        // Nothing useful to do — the next tick will try again.
      }
    };

    void attempt();
    const timer = setInterval(attempt, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(member)" options={{ headerShown: false }} />
          <Stack.Screen name="(coach)" options={{ headerShown: false }} />
        </Stack>
      </SessionProvider>
    </QueryClientProvider>
  );
}
