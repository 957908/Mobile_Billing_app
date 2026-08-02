import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { api, pendingSyncCount, replayQueue } from '@/src/api/client';
import { useAuth } from '@/src/state/auth';
import { useI18n } from '@/src/i18n';
import { theme, inr } from '@/src/theme/theme';

type Dash = {
  today_sales: number; today_expense: number; today_profit: number;
  monthly_sales: number; monthly_purchase: number; monthly_expense: number; monthly_profit: number;
  inventory_value: number; low_stock_count: number; pending_receivable: number; total_products: number;
  top_products: { name: string; qty: number }[];
  sales_trend: { date: string; amount: number }[];
  recent_invoices: any[];
  business_health: number;
};

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api<Dash>('/dashboard');
      setData(d);
    } catch (e) {
      console.warn(e);
    }
    setPending(await pendingSyncCount());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      setOnline(!!s.isConnected);
      if (s.isConnected) replayQueue().then(() => pendingSyncCount().then(setPending));
    });
    NetInfo.fetch().then((s) => setOnline(!!s.isConnected));
    return () => sub();
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return <View style={styles.center} testID="dashboard-loading"><ActivityIndicator color={theme.color.brand} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="dashboard-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{`${t('hello')}, ${user?.name?.split(' ')[0] || 'there'}`}</Text>
            <Text style={styles.business}>{user?.business_name || 'My Business'}</Text>
          </View>
          {!online ? (
            <View style={styles.offlineBadge} testID="offline-badge">
              <Ionicons name="cloud-offline-outline" size={12} color={theme.color.warning} />
              <Text style={styles.offlineText}>{t('offline')}</Text>
            </View>
          ) : null}
          {pending > 0 ? (
            <Pressable style={styles.pendingBadge} onPress={() => replayQueue().then(() => pendingSyncCount().then(setPending))} testID="pending-sync-badge">
              <Ionicons name="sync" size={12} color="#FFF" />
              <Text style={styles.pendingText}>{pending}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.iconBtn} onPress={() => router.push('/more')} testID="more-button">
            <Ionicons name="grid-outline" size={22} color={theme.color.onSurface} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={signOut} testID="logout-button">
            <Ionicons name="log-out-outline" size={22} color={theme.color.onSurface} />
          </Pressable>
        </View>

        {/* Hero card */}
        <LinearGradient colors={['#274A3D', '#1B3529']} style={styles.hero} testID="today-sales-card">
          <Text style={styles.heroLabel}>{t('today_sales')}</Text>
          <Text style={styles.heroValue}>{inr(data?.today_sales)}</Text>
          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.heroSubLabel}>Profit</Text>
              <Text style={styles.heroSub}>{inr(data?.today_profit)}</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.heroSubLabel}>Expenses</Text>
              <Text style={styles.heroSub}>{inr(data?.today_expense)}</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.heroSubLabel}>Health</Text>
              <Text style={styles.heroSub}>{data?.business_health ?? 0}/100</Text>
            </View>
          </View>
        </LinearGradient>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard testID="kpi-monthly-sales" icon="trending-up" label="Monthly Sales" value={inr(data?.monthly_sales)} tint="#274A3D" />
          <KpiCard testID="kpi-monthly-profit" icon="cash-outline" label="Monthly Profit" value={inr(data?.monthly_profit)} tint="#34C759" />
          <KpiCard testID="kpi-inventory-value" icon="cube-outline" label="Inventory Value" value={inr(data?.inventory_value)} tint="#8E8E93" />
          <KpiCard testID="kpi-receivable" icon="arrow-down-circle-outline" label="Pending Recv." value={inr(data?.pending_receivable)} tint="#FF9500" />
          <KpiCard testID="kpi-low-stock" icon="alert-circle-outline" label="Low Stock" value={`${data?.low_stock_count ?? 0} items`} tint="#FF3B30" />
          <KpiCard testID="kpi-products" icon="pricetags-outline" label="Products" value={`${data?.total_products ?? 0}`} tint="#48484A" />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow}>
          <QuickAction icon="add-circle" label={t('new_bill')} onPress={() => router.push('/(tabs)/billing')} testID="qa-new-bill" />
          <QuickAction icon="cube" label={t('add_product')} onPress={() => router.push('/product/new')} testID="qa-add-product" />
          <QuickAction icon="person-add" label={t('add_party')} onPress={() => router.push('/party/new')} testID="qa-add-party" />
          <QuickAction icon="wallet" label={t('add_expense')} onPress={() => router.push('/expenses')} testID="qa-add-expense" />
          <QuickAction icon="construct" label={t('custom_orders')} onPress={() => router.push('/custom-orders')} testID="qa-custom-orders" />
          <QuickAction icon="hammer" label={t('manufacturing')} onPress={() => router.push('/manufacturing')} testID="qa-manufacturing" />
          <QuickAction icon="reorder-four" label={t('rolls')} onPress={() => router.push('/rolls')} testID="qa-rolls" />
          <QuickAction icon="bicycle" label={t('delivery')} onPress={() => router.push('/deliveries')} testID="qa-delivery" />
          <QuickAction icon="document-text" label={t('reports')} onPress={() => router.push('/reports')} testID="qa-reports" />
          <QuickAction icon="settings" label={t('settings')} onPress={() => router.push('/settings')} testID="qa-settings" />
        </ScrollView>

        {/* 7-day trend */}
        <Text style={styles.sectionTitle}>7-Day Sales Trend</Text>
        <View style={styles.trendCard}>
          <TrendChart data={data?.sales_trend || []} />
        </View>

        {/* Top products */}
        <Text style={styles.sectionTitle}>Top Products (Month)</Text>
        <View style={styles.listGroup} testID="top-products-list">
          {(data?.top_products || []).length === 0 ? (
            <View style={styles.emptyRow}><Text style={styles.mutedText}>No sales yet this month</Text></View>
          ) : (
            data!.top_products.map((p, i) => (
              <View key={p.name} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rank}><Text style={styles.rankText}>{i + 1}</Text></View>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowValue}>{p.qty} sold</Text>
              </View>
            ))
          )}
        </View>

        {/* Recent invoices */}
        <Text style={styles.sectionTitle}>Recent Invoices</Text>
        <View style={styles.listGroup} testID="recent-invoices-list">
          {(data?.recent_invoices || []).length === 0 ? (
            <View style={styles.emptyRow}><Text style={styles.mutedText}>No invoices yet</Text></View>
          ) : (
            data!.recent_invoices.map((inv: any, i: number) => (
              <View key={inv.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{inv.invoice_number}</Text>
                  <Text style={styles.mutedText}>{inv.customer_name} · {inv.kind === 'sale' ? 'Sale' : 'Purchase'}</Text>
                </View>
                <Text style={[styles.rowValue, { color: inv.kind === 'sale' ? theme.color.success : theme.color.error }]}>{inr(inv.total)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ icon, label, value, tint, testID }: any) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + '15' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: any) {
  return (
    <Pressable style={({ pressed }) => [styles.qa, pressed && { opacity: 0.7 }]} onPress={onPress} testID={testID}>
      <View style={styles.qaIcon}><Ionicons name={icon} size={22} color={theme.color.brand} /></View>
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

function TrendChart({ data }: { data: { date: string; amount: number }[] }) {
  const width = Dimensions.get('window').width - 64;
  const max = Math.max(...data.map(d => d.amount), 1);
  const barW = (width - (data.length - 1) * 8) / Math.max(data.length, 1);
  return (
    <View>
      <View style={styles.chartRow}>
        {data.map((d, i) => {
          const h = Math.max((d.amount / max) * 100, 4);
          return (
            <View key={d.date} style={{ width: barW, marginLeft: i === 0 ? 0 : 8, alignItems: 'center' }}>
              <View style={{ height: 100, justifyContent: 'flex-end' }}>
                <View style={[styles.bar, { height: h }]} />
              </View>
              <Text style={styles.chartLabel}>{d.date.slice(-2)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  hello: { fontSize: 22, color: theme.color.onSurface, fontWeight: '500' },
  business: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surfaceSecondary, marginLeft: 8 },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FFF3E0', marginRight: 6 },
  offlineText: { fontSize: 11, color: theme.color.warning, fontWeight: '500' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.color.brand, marginRight: 6 },
  pendingText: { fontSize: 11, color: '#FFF', fontWeight: '500' },
  hero: { marginHorizontal: 16, borderRadius: 20, padding: 20 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  heroValue: { color: '#FFF', fontSize: 34, fontWeight: '500', marginTop: 4, letterSpacing: -0.5 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 12 },
  heroSubLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  heroSub: { color: '#FFF', fontSize: 14, fontWeight: '500', marginTop: 2 },
  divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 16 },
  kpi: { width: '48%', backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14, marginHorizontal: '1%', marginBottom: 8 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 12, color: theme.color.muted },
  kpiValue: { fontSize: 18, color: theme.color.onSurface, fontWeight: '500', marginTop: 2 },
  sectionTitle: { fontSize: 16, color: theme.color.onSurface, fontWeight: '500', paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  actionsRow: { paddingHorizontal: 16, gap: 10, paddingRight: 24 },
  qa: { width: 88, alignItems: 'center', gap: 8, paddingVertical: 4 },
  qaIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, color: theme.color.onSurface, textAlign: 'center' },
  trendCard: { marginHorizontal: 16, backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: { width: '100%', backgroundColor: theme.color.brand, borderRadius: 4 },
  chartLabel: { fontSize: 10, color: theme.color.muted, marginTop: 6 },
  listGroup: { marginHorizontal: 16, backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderTopWidth: 0.5, borderTopColor: theme.color.border },
  rank: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: theme.color.brand, fontSize: 12, fontWeight: '500' },
  rowTitle: { flex: 1, fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
  rowValue: { fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
  mutedText: { color: theme.color.muted, fontSize: 12 },
  emptyRow: { padding: 20, alignItems: 'center' },
});
