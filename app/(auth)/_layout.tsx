import { Stack } from 'expo-router';
import { colors } from '@/ui/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify your number' }} />
      <Stack.Screen name="account-type" options={{ title: 'Who is this account for?' }} />
    </Stack>
  );
}
