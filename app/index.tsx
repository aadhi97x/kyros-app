import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { isSignedIn } from '@/api/tokens';
import { useSession } from '@/state/session';
import { Loading } from '@/ui/components';
import { s } from '@/ui/theme';

/**
 * Entry gate. Sends the user to the right side of the product:
 * signed out → auth, coach/owner → coach tabs, everyone else → member tabs.
 */
export default function Index() {
  const { account, loading, isStaff } = useSession();

  useEffect(() => {
    if (loading) return;

    (async () => {
      if (!(await isSignedIn())) {
        router.replace('/(auth)/sign-in');
        return;
      }
      router.replace(isStaff ? '/(coach)/today' : '/(member)/discover');
    })();
  }, [loading, account, isStaff]);

  return (
    <View style={[s.screen, { justifyContent: 'center' }]}>
      <Loading label="Kyros" />
    </View>
  );
}
