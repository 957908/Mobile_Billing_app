import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/src/i18n';
import { theme } from '@/src/theme/theme';

export default function More() {
  const router = useRouter();
  const { t } = useI18n();

  const items = [
    { icon: 'construct-outline', label: t('custom_orders'), route: '/custom-orders', tid: 'more-custom-orders', tint: '#274A3D' },
    { icon: 'hammer-outline', label: t('manufacturing'), route: '/manufacturing', tid: 'more-manufacturing', tint: '#FF9500' },
    { icon: 'reorder-four-outline', label: t('rolls'), route: '/rolls', tid: 'more-rolls', tint: '#8E8E93' },
    { icon: 'bicycle-outline', label: t('delivery'), route: '/deliveries', tid: 'more-deliveries', tint: '#34C759' },
    { icon: 'wallet-outline', label: t('expenses'), route: '/expenses', tid: 'more-expenses', tint: '#FF3B30' },
    { icon: 'stats-chart-outline', label: t('reports'), route: '/reports', tid: 'more-reports', tint: '#274A3D' },
    { icon: 'settings-outline', label: t('settings'), route: '/settings', tid: 'more-settings', tint: '#48484A' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="more-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>More Modules</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.grid}>
          {items.map((it) => (
            <Pressable key={it.route} testID={it.tid} style={styles.card} onPress={() => router.push(it.route as any)}>
              <View style={[styles.iconWrap, { backgroundColor: it.tint + '15' }]}>
                <Ionicons name={it.icon as any} size={26} color={it.tint} />
              </View>
              <Text style={styles.cardLabel}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: '48%', backgroundColor: theme.color.surfaceSecondary, borderRadius: 16, padding: 18, marginHorizontal: '1%', marginBottom: 10, alignItems: 'flex-start' },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
});
