import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { Button, Card } from '@/ui/components';
import { s, spacing } from '@/ui/theme';

export default function CoachProfileScreen() {
  const { account, signOut } = useSession();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>{account?.name}</Text>
      <Text style={s.muted}>{account?.phone}</Text>

      <Card>
        <Text style={s.h3}>Role</Text>
        <Text style={s.muted}>
          {account?.role === 'CLUB_OWNER'
            ? 'Club owner — the full dashboard lives on the web at your club’s Kyros page.'
            : 'Coach — your sessions, attendance and batch chats are in this app.'}
        </Text>
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label="Sign out"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        />
      </View>
    </ScrollView>
  );
}
