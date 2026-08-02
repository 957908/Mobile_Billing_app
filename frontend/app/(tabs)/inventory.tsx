import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function Inventory() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selected, setSelected] = useState('All');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [prods, cats] = await Promise.all([
      api<any[]>(`/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(selected !== 'All' ? { category: selected } : {}) })}`),
      api<string[]>('/products/categories'),
    ]);
    setProducts(prods);
    setCategories(['All', ...cats]);
  }, [q, selected]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="inventory-screen">
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Inventory</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/product/new')} testID="add-product-btn">
            <Ionicons name="add" size={22} color="#FFF" />
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.color.muted} />
          <TextInput
            testID="product-search-input"
            placeholder="Search products or SKU"
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {categories.map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelected(c)}
              testID={`cat-chip-${c}`}
              style={[styles.chip, selected === c && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected === c && styles.chipTextSelected]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="cube-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No products yet</Text><Pressable onPress={() => router.push('/product/new')}><Text style={styles.linkText}>Add your first product</Text></Pressable></View>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })} testID={`product-row-${item.id}`}>
              <View style={styles.thumb}>
                <Ionicons name="cube-outline" size={26} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.sku} · {item.category}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{inr(item.selling_price)}</Text>
                  <Text style={styles.slash}>/ {item.unit}</Text>
                </View>
              </View>
              <View style={styles.stockPill(item.stock <= (item.low_stock_alert || 5))}>
                <Text style={styles.stockText(item.stock <= (item.low_stock_alert || 5))}>{item.stock} {item.unit}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<any>({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#FFF', borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '500', color: theme.color.onSurface, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, color: theme.color.onSurface, fontSize: 15 },
  chipsRow: { gap: 8, paddingRight: 8, paddingVertical: 12 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSelected: { color: '#FFF', fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 12, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4, gap: 4 },
  price: { fontSize: 15, color: theme.color.brand, fontWeight: '500' },
  slash: { fontSize: 11, color: theme.color.muted },
  stockPill: (low: boolean) => ({ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: low ? '#FFE5E3' : '#E9F0EC' }),
  stockText: (low: boolean) => ({ fontSize: 12, color: low ? theme.color.error : theme.color.brand, fontWeight: '500' }),
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: theme.color.muted, fontSize: 14 },
  linkText: { color: theme.color.brand, fontWeight: '500' },
});
