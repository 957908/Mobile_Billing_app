import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function Parties() {
  const router = useRouter();
  const [tab, setTab] = useState<'customer' | 'supplier'>('customer');
  const [q, setQ] = useState('');
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const p = await api<any[]>(`/parties?${new URLSearchParams({ party_type: tab, ...(q ? { q } : {}) })}`);
    setParties(p);
  }, [tab, q]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="parties-screen">
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Parties</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push({ pathname: '/party/new', params: { type: tab } })} testID="add-party-btn">
            <Ionicons name="add" size={22} color="#FFF" />
          </Pressable>
        </View>

        {/* Segmented */}
        <View style={styles.segment}>
          {(['customer', 'supplier'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segItemActive]} testID={`seg-${t}`}>
              <Text style={[styles.segText, tab === t && styles.segTextActive]}>{t === 'customer' ? 'Customers' : 'Suppliers'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.color.muted} />
          <TextInput
            testID="party-search-input"
            placeholder={`Search ${tab === 'customer' ? 'customers' : 'suppliers'}`}
            placeholderTextColor={theme.color.muted}
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>
      ) : (
        <FlatList
          data={parties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="people-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No {tab}s yet</Text><Pressable onPress={() => router.push({ pathname: '/party/new', params: { type: tab } })}><Text style={styles.linkText}>Add first {tab}</Text></Pressable></View>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`party-row-${item.id}`}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.phone || 'No phone'}{item.gstin ? ` · GST ${item.gstin.slice(0, 8)}…` : ''}</Text>
                <Text style={[styles.balance, { color: item.outstanding > 0 ? theme.color.error : theme.color.success }]}>
                  {item.outstanding > 0 ? 'Due ' : 'Advance '}{inr(Math.abs(item.outstanding))}
                </Text>
              </View>
              {item.phone ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${item.phone}`)} testID={`call-${item.id}`}>
                    <Ionicons name="call" size={16} color={theme.color.brand} />
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => Linking.openURL(`https://wa.me/91${item.phone.replace(/\D/g, '')}`)} testID={`whatsapp-${item.id}`}>
                    <Ionicons name="logo-whatsapp" size={16} color={theme.color.success} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: '#FFF', borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '500', color: theme.color.onSurface, letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, padding: 3, marginBottom: 12 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segItemActive: { backgroundColor: '#FFFFFF' },
  segText: { color: theme.color.muted, fontWeight: '500' },
  segTextActive: { color: theme.color.brand },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, color: theme.color.onSurface, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.color.brand, fontWeight: '500', fontSize: 16 },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  balance: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  action: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.color.border },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: theme.color.muted, fontSize: 14 },
  linkText: { color: theme.color.brand, fontWeight: '500' },
});
