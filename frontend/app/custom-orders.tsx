import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

const STATUSES = ['All', 'Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled'] as const;

export default function CustomOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState<typeof STATUSES[number]>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const q = status === 'All' ? '' : `?status_filter=${encodeURIComponent(status)}`;
    const list = await api<any[]>(`/custom-orders${q}`);
    setOrders(list);
  }, [status]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="custom-orders-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Custom Orders</Text>
        <Pressable onPress={() => router.push('/custom-order/new')} testID="add-co-btn"><Ionicons name="add-circle" size={26} color={theme.color.brand} /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {STATUSES.map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipSel]} testID={`co-status-${s}`}>
            <Text style={[styles.chipText, status === s && styles.chipTextSel]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={theme.color.brand} /> : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.color.brand} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="construct-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No custom orders</Text><Pressable onPress={() => router.push('/custom-order/new')}><Text style={styles.linkText}>Create first order</Text></Pressable></View>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/custom-order/[id]', params: { id: item.id } })} testID={`co-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{item.order_number}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardMeta}>{item.customer_name} · {item.items.length} item{item.items.length === 1 ? '' : 's'}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedText}>{item.expected_delivery ? `Due ${item.expected_delivery}` : `Created ${(item.created_at || '').slice(0, 10)}`}</Text>
                  <Text style={styles.amount}>{inr(item.total)}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Pending': theme.color.warning,
    'In Production': '#5856D6',
    'Ready': theme.color.brand,
    'Delivered': theme.color.success,
    'Cancelled': theme.color.error,
  };
  const c = colors[status] || theme.color.muted;
  return <View style={[styles.badge, { backgroundColor: c + '20' }]}><Text style={[styles.badgeText, { color: c }]}>{status}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  chipsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSel: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSel: { color: '#FFF', fontWeight: '500' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14, gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted },
  mutedText: { fontSize: 12, color: theme.color.muted },
  amount: { fontSize: 14, color: theme.color.brand, fontWeight: '500' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: theme.color.muted, fontSize: 14 },
  linkText: { color: theme.color.brand, fontWeight: '500' },
});
