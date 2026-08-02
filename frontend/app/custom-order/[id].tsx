import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

const STATUS_FLOW = ['Pending', 'In Production', 'Ready', 'Delivered'] as const;

export default function CustomOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const load = () => { api(`/custom-orders/${id}`).then(setOrder).catch(() => {}); };
  useEffect(load, [id]);

  const changeStatus = async (s: string) => {
    setUpdating(true);
    try {
      const updated = await api(`/custom-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ new_status: s }) });
      setOrder(updated);
    } finally { setUpdating(false); }
  };

  if (!order) return <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>;

  const currentIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="co-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>{order.order_number}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.hero}>
          <Text style={styles.customer}>{order.customer_name}</Text>
          <Text style={styles.amount}>{inr(order.total)}</Text>
          <Text style={styles.mutedText}>Balance Due {inr(order.balance_due)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Production Timeline</Text>
        <View style={styles.timeline}>
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <Pressable key={s} onPress={() => !updating && changeStatus(s)} style={styles.step} testID={`co-step-${s}`} disabled={updating}>
                <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                  {done ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepLabel, active && { color: theme.color.brand, fontWeight: '500' }]}>{s}</Text>
                </View>
                {i < STATUS_FLOW.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.section}>
          {order.items.map((it: any, i: number) => (
            <View key={i} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.product_name}</Text>
                <Text style={styles.itemMeta}>{it.order_type} · {Object.entries(it.measurements || {}).map(([k, v]) => `${k}:${v}`).join(' · ')}</Text>
                {it.notes ? <Text style={styles.itemMeta}>Note: {it.notes}</Text> : null}
              </View>
              <Text style={styles.priceText}>{inr(it.price)}</Text>
            </View>
          ))}
        </View>

        {order.expected_delivery ? (
          <View style={styles.section}>
            <Text style={styles.mutedText}>Expected Delivery</Text>
            <Text style={styles.value}>{order.expected_delivery}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  hero: { backgroundColor: theme.color.brand, padding: 20, borderRadius: 20 },
  customer: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  amount: { color: '#FFF', fontSize: 32, fontWeight: '500', marginTop: 4 },
  mutedText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 13, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeline: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 16 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: theme.color.brand },
  dotActive: { backgroundColor: theme.color.brand, borderWidth: 3, borderColor: theme.color.brandTertiary },
  stepLabel: { color: theme.color.onSurface, fontSize: 14 },
  line: { position: 'absolute', left: 11, top: 32, width: 2, height: 20, backgroundColor: theme.color.borderStrong },
  lineDone: { backgroundColor: theme.color.brand },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderTopWidth: 0.5, borderTopColor: theme.color.border },
  itemName: { color: theme.color.onSurface, fontWeight: '500', fontSize: 14 },
  itemMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  priceText: { color: theme.color.brand, fontWeight: '500', fontSize: 14 },
  value: { color: theme.color.onSurface, fontSize: 15, fontWeight: '500', marginTop: 4 },
});
