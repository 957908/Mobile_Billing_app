import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prod, setProd] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const list = await api<any[]>('/products');
      setProd(list.find((p) => p.id === id));
    })();
  }, [id]);

  const remove = async () => {
    Alert.alert('Delete product?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api(`/products/${id}`, { method: 'DELETE' });
          router.back();
        },
      },
    ]);
  };

  if (!prod) return <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="product-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Product</Text>
        <Pressable onPress={remove} testID="delete-product-btn"><Ionicons name="trash-outline" size={22} color={theme.color.error} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.hero}>
          <View style={styles.thumb}><Ionicons name="cube-outline" size={40} color={theme.color.brand} /></View>
          <Text style={styles.name}>{prod.name}</Text>
          <Text style={styles.meta}>{prod.sku} · {prod.category}</Text>
        </View>
        <Row label="Selling Price" value={inr(prod.selling_price) + ' / ' + prod.unit} />
        <Row label="Purchase Price" value={inr(prod.purchase_price)} />
        <Row label="GST Rate" value={`${prod.gst_rate}%`} />
        <Row label="HSN Code" value={prod.hsn || '—'} />
        <Row label="Brand" value={prod.brand || '—'} />
        <Row label="Color" value={prod.color || '—'} />
        <Row label="Stock" value={`${prod.stock} ${prod.unit}`} highlight={prod.stock <= (prod.low_stock_alert || 5)} />
        <Row label="Warehouse" value={prod.warehouse || 'Main'} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: any) {
  return (
    <View style={styles.row}>
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
  hero: { alignItems: 'center', padding: 24, backgroundColor: theme.color.surfaceSecondary, borderRadius: 20 },
  thumb: { width: 80, height: 80, borderRadius: 20, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '500', color: theme.color.onSurface, textAlign: 'center' },
  meta: { fontSize: 13, color: theme.color.muted, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: theme.color.surfaceSecondary, borderRadius: 12 },
  rowLabel: { color: theme.color.muted, fontSize: 13 },
  rowValue: { color: theme.color.onSurface, fontSize: 15, fontWeight: '500' },
});
