import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, getToken } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function Reports() {
  const router = useRouter();
  const [gst, setGst] = useState<any>(null);
  const [pnl, setPnl] = useState<any>(null);
  const [salesReg, setSalesReg] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api('/reports/gst'), api('/reports/pnl'), api<any[]>('/reports/sales-register'),
    ]).then(([g, p, s]) => { setGst(g); setPnl(p); setSalesReg(s); }).finally(() => setLoading(false));
  }, []);

  const handleExport = async (type: 'pnl' | 'gst' | 'sales-register') => {
    setExporting(type);
    try {
      const token = await getToken();
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/api/reports/${type}/export`;
      const filename = `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web') {
        const res = await fetch(url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.status !== 200) throw new Error('Export failed');
        await Sharing.shareAsync(res.uri, { mimeType: 'text/csv', dialogTitle: `Share ${filename}` });
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        alert(e.message || 'Export failed');
      } else {
        Alert.alert('Error', e.message || 'Export failed');
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="reports-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* P&L */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Profit & Loss</Text>
          <Pressable onPress={() => handleExport('pnl')} disabled={exporting !== null} style={styles.exportBtn} testID="export-pnl-btn">
            {exporting === 'pnl' ? <ActivityIndicator size={12} color={theme.color.brand} /> : <Ionicons name="download-outline" size={14} color={theme.color.brand} />}
            <Text style={styles.exportText}>Export</Text>
          </Pressable>
        </View>
        <View style={styles.card} testID="pnl-card">
          <Row label="Total Sales" value={inr(pnl?.total_sales)} />
          <Row label="Total Purchases" value={inr(pnl?.total_purchases)} />
          <Row label="Total Expenses" value={inr(pnl?.total_expenses)} />
          <Row label="Gross Profit" value={inr(pnl?.gross_profit)} bold />
          <Row label="Net Profit" value={inr(pnl?.net_profit)} bold highlight={pnl?.net_profit < 0} last />
        </View>

        {/* GST */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>GST Summary</Text>
          <Pressable onPress={() => handleExport('gst')} disabled={exporting !== null} style={styles.exportBtn} testID="export-gst-btn">
            {exporting === 'gst' ? <ActivityIndicator size={12} color={theme.color.brand} /> : <Ionicons name="download-outline" size={14} color={theme.color.brand} />}
            <Text style={styles.exportText}>Export</Text>
          </Pressable>
        </View>
        <View style={styles.card} testID="gst-card">
          {(gst?.summary || []).length === 0 ? (
            <Text style={styles.emptyText}>No taxable sales yet</Text>
          ) : (
            <>
              {gst.summary.map((r: any, i: number) => (
                <View key={r.rate} style={[styles.gstRow, i > 0 && styles.rowBorder]}>
                  <Text style={styles.rate}>{r.rate}%</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gstLabel}>Taxable {inr(r.taxable)}</Text>
                    <Text style={styles.gstMeta}>CGST {inr(r.cgst)} · SGST {inr(r.sgst)}</Text>
                  </View>
                  <Text style={styles.gstTotal}>{inr(r.total_tax)}</Text>
                </View>
              ))}
              <View style={[styles.gstRow, styles.rowBorder]}>
                <Text style={styles.rate}>Σ</Text>
                <Text style={[styles.gstLabel, { flex: 1 }]}>Total Tax Collected</Text>
                <Text style={[styles.gstTotal, { color: theme.color.brand }]}>{inr(gst.total_tax)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Expenses by category */}
        <Text style={styles.sectionTitle}>Expenses by Category</Text>
        <View style={styles.card}>
          {(pnl?.expenses_by_category || []).length === 0 ? (
            <Text style={styles.emptyText}>No expenses yet</Text>
          ) : pnl.expenses_by_category.map((r: any, i: number) => (
            <View key={r.category} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{r.category}</Text>
              <Text style={styles.rowValue}>{inr(r.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Sales Register */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Sales Register</Text>
          <Pressable onPress={() => handleExport('sales-register')} disabled={exporting !== null} style={styles.exportBtn} testID="export-sales-register-btn">
            {exporting === 'sales-register' ? <ActivityIndicator size={12} color={theme.color.brand} /> : <Ionicons name="download-outline" size={14} color={theme.color.brand} />}
            <Text style={styles.exportText}>Export</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {salesReg.length === 0 ? <Text style={styles.emptyText}>No sales yet</Text> : salesReg.slice(0, 20).map((s, i) => (
            <Pressable key={s.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: s.id } })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{s.invoice_number} · {s.customer_name}</Text>
                <Text style={styles.rowMeta}>{s.created_at?.slice(0, 10)}</Text>
              </View>
              <Text style={styles.rowValue}>{inr(s.total)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, highlight, last }: any) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={[styles.rowLabel, bold && { color: theme.color.onSurface, fontWeight: '500' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: 16 }, highlight && { color: theme.color.error }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  sectionTitle: { fontSize: 13, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  exportText: { fontSize: 12, color: theme.color.brand, fontWeight: '500' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  rowBorder: { borderTopWidth: 0.5, borderTopColor: theme.color.border },
  rowLabel: { color: theme.color.muted, fontSize: 13 },
  rowMeta: { color: theme.color.muted, fontSize: 11, marginTop: 2 },
  rowValue: { color: theme.color.onSurface, fontSize: 14, fontWeight: '500' },
  emptyText: { color: theme.color.muted, padding: 20, textAlign: 'center' },
  gstRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rate: { width: 40, textAlign: 'center', color: theme.color.brand, fontWeight: '500', backgroundColor: theme.color.brandTertiary, borderRadius: 8, paddingVertical: 6 },
  gstLabel: { color: theme.color.onSurface, fontSize: 13, fontWeight: '500' },
  gstMeta: { color: theme.color.muted, fontSize: 11, marginTop: 2 },
  gstTotal: { color: theme.color.onSurface, fontWeight: '500', fontSize: 14 },
});
