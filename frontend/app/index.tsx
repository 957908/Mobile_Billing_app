import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/state/auth';
import { theme } from '@/src/theme/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace('/(tabs)/dashboard');
      else router.replace('/(auth)/login');
    }
  }, [loading, user, router]);

  return (
    <View style={styles.container} testID="splash-loader">
      <ActivityIndicator color={theme.color.brand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
