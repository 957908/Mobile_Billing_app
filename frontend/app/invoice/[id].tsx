import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<any>(null);

  useEffect(() => { api(`/invoices/${id}`).then(setInv).catch(() => {}); }, [id]);

  if (!inv) return <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="invoice-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>{inv.invoice_number}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <LinearGradient colors={['#274A3D', '#1B3529']} style={styles.hero}>
          <Text style={styles.heroLabel}>Total Amount</Text>
          <Text style={styles.heroValue}>{inr(inv.total)}</Text>
          <View style={styles.heroFooter}>
            <View><Text style={styles.hf}>Subtotal</Text><Text style={styles.hv}>{inr(inv.subtotal)}</Text></View>
            <View><Text style={styles.hf}>GST</Text><Text style={styles.hv}>{inr(inv.tax)}</Text></View>
            <View><Text style={styles.hf}>Paid</Text><Text style={styles.hv}>{inr(inv.amount_paid)}</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Row label="Customer" value={inv.customer_name} />
          <Row label="Payment" value={inv.payment_method} />
          <Row label="Balance Due" value={inr(inv.balance_due)} highlight={inv.balance_due > 0} />
          <Row label="Type" value={inv.kind === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'} last />
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.section}>
          {inv.items.map((it: any, i: number) => (
            <View key={i} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>{it.quantity} × {inr(it.price)} · GST {it.gst_rate}%</Text>
              </View>
              <Text style={styles.itemTotal}>{inr(it.price * it.quantity)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight, last }: any) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && { color: theme.color.error }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  hero: { padding: 24, borderRadius: 20 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  heroValue: { color: '#FFF', fontSize: 36, fontWeight: '500', marginTop: 4 },
  heroFooter: { flexDirection: 'row', gap: 24, marginTop: 20 },
  hf: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  hv: { color: '#FFF', fontSize: 14, marginTop: 2, fontWeight: '500' },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, overflow: 'hidden' },
  sectionTitle: { fontSize: 14, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
  rowLabel: { color: theme.color.muted, fontSize: 13 },
  rowValue: { color: theme.color.onSurface, fontSize: 14, fontWeight: '500' },
  itemRow: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  itemName: { color: theme.color.onSurface, fontWeight: '500', fontSize: 14 },
  itemMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  itemTotal: { color: theme.color.brand, fontWeight: '500', fontSize: 14 },
});
