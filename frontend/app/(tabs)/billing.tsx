import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';
import { BarcodeScannerModal } from '@/src/components/BarcodeScannerModal';

type Line = { product_id: string; name: string; quantity: number; price: number; gst_rate: number; discount: number };
type Party = { id: string; name: string };

export default function Billing() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [items, setItems] = useState<Line[]>([]);
  const [payment, setPayment] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit'>('Cash');
  const [amountPaid, setAmountPaid] = useState('');

  const [customers, setCustomers] = useState<Party[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showProduct, setShowProduct] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([api<Party[]>('/parties?party_type=customer'), api<any[]>('/products')]);
    setCustomers(c);
    setProducts(p);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    items.forEach((it) => {
      const line = it.price * it.quantity - (it.discount || 0);
      subtotal += line;
      tax += line * (it.gst_rate || 0) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  const addProduct = (p: any) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      if (existing) return prev.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, price: p.selling_price, gst_rate: p.gst_rate, discount: 0 }];
    });
    setShowProduct(false);
    setProductQuery('');
  };

  const onScan = async (code: string) => {
    setShowScanner(false);
    try {
      const p = await api<any>(`/products/by-barcode/${encodeURIComponent(code)}`);
      addProduct(p);
      setToast(`Added ${p.name}`);
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast(`No product for code ${code}`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { setItems((p) => p.filter((x) => x.product_id !== id)); return; }
    setItems((p) => p.map((x) => x.product_id === id ? { ...x, quantity: qty } : x));
  };

  const generate = async () => {
    if (items.length === 0) { setToast('Add items first'); return; }
    setSubmitting(true);
    try {
      const paid = amountPaid ? parseFloat(amountPaid) : (payment === 'Credit' ? 0 : totals.total);
      const inv = await api<any>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName,
          items,
          payment_method: payment,
          amount_paid: paid,
          kind: 'sale',
        }),
      });
      setToast(`${inv.invoice_number} created`);
      setItems([]);
      setAmountPaid('');
      setCustomerId(null);
      setCustomerName('Walk-in');
      setTimeout(() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } }), 400);
    } catch (e: any) {
      setToast(e?.message || 'Failed to create invoice');
    } finally { setSubmitting(false); setTimeout(() => setToast(null), 2500); }
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productQuery.toLowerCase()) || (p.sku || '').toLowerCase().includes(productQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="billing-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>New Invoice</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>GST</Text></View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* Customer */}
          <Pressable style={styles.section} onPress={() => setShowCustomer(true)} testID="customer-picker">
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionLabel}>Customer</Text>
                <Text style={styles.sectionValue}>{customerName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.color.muted} />
            </View>
          </Pressable>

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>Line Items · {items.length}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setShowScanner(true)} testID="scan-item-btn"><Ionicons name="qr-code-outline" size={18} color={theme.color.brand} /></Pressable>
                <Pressable onPress={() => setShowProduct(true)} testID="add-item-btn"><Text style={styles.linkText}>+ Add</Text></Pressable>
              </View>
            </View>
            {items.length === 0 ? (
              <Text style={styles.mutedCenter}>Tap +Add to add products</Text>
            ) : (
              items.map((it, i) => (
                <View key={it.product_id} style={[styles.itemRow, i > 0 && styles.rowBorder]} testID={`line-${it.product_id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.itemMeta}>{inr(it.price)} · GST {it.gst_rate}%</Text>
                  </View>
                  <View style={styles.qtyBox}>
                    <Pressable onPress={() => updateQty(it.product_id, it.quantity - 1)} style={styles.qtyBtn} testID={`dec-${it.product_id}`}><Ionicons name="remove" size={16} color={theme.color.brand} /></Pressable>
                    <Text style={styles.qtyText}>{it.quantity}</Text>
                    <Pressable onPress={() => updateQty(it.product_id, it.quantity + 1)} style={styles.qtyBtn} testID={`inc-${it.product_id}`}><Ionicons name="add" size={16} color={theme.color.brand} /></Pressable>
                  </View>
                  <Text style={styles.itemTotal}>{inr(it.price * it.quantity)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Payment */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
              {(['Cash', 'UPI', 'Card', 'Bank', 'Credit'] as const).map((m) => (
                <Pressable key={m} onPress={() => setPayment(m)} testID={`pay-${m}`} style={[styles.chip, payment === m && styles.chipSelected]}>
                  <Text style={[styles.chipText, payment === m && styles.chipTextSelected]}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subLabel}>Amount Received (optional)</Text>
              <TextInput
                testID="amount-paid-input"
                style={styles.input}
                keyboardType="numeric"
                value={amountPaid}
                onChangeText={setAmountPaid}
                placeholder={`Default: ${inr(totals.total)}`}
                placeholderTextColor={theme.color.muted}
              />
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom bar */}
        <View style={styles.stickyBar}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyInner}>
            <View style={{ flex: 1 }}>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{inr(totals.subtotal)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>GST</Text><Text style={styles.totalValue}>{inr(totals.tax)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{inr(totals.total)}</Text></View>
            </View>
            <Pressable style={[styles.generateBtn, submitting && { opacity: 0.7 }]} onPress={generate} disabled={submitting} testID="generate-invoice-btn">
              {submitting ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="receipt" size={18} color="#FFF" />
                  <Text style={styles.generateText}>Generate</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {toast ? <View style={styles.toast} testID="billing-toast"><Text style={styles.toastText}>{toast}</Text></View> : null}
      </KeyboardAvoidingView>

      {/* Product picker */}
      <Modal visible={showProduct} animationType="slide" onRequestClose={() => setShowProduct(false)} transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <Pressable onPress={() => setShowProduct(false)} testID="close-product-modal"><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.color.muted} />
              <TextInput testID="modal-product-search" placeholder="Search products" placeholderTextColor={theme.color.muted} value={productQuery} onChangeText={setProductQuery} style={styles.searchInput} />
            </View>
            <FlatList
              data={filteredProducts}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => addProduct(item)} testID={`pick-product-${item.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{item.sku} · Stock {item.stock} · GST {item.gst_rate}%</Text>
                  </View>
                  <Text style={styles.price}>{inr(item.selling_price)}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Customer picker */}
      <Modal visible={showCustomer} animationType="slide" onRequestClose={() => setShowCustomer(false)} transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <Pressable onPress={() => setShowCustomer(false)} testID="close-customer-modal"><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
            </View>
            <FlatList
              data={[{ id: 'walk-in', name: 'Walk-in Customer' }, ...customers]}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => { setCustomerId(item.id === 'walk-in' ? null : item.id); setCustomerName(item.name); setShowCustomer(false); }} testID={`pick-customer-${item.id}`}>
                  <Text style={styles.itemName}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal visible={showScanner} onClose={() => setShowScanner(false)} onScan={onScan} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '500', color: theme.color.onSurface, letterSpacing: -0.5 },
  badge: { backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: theme.color.brand, fontSize: 11, fontWeight: '500' },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14 },
  sectionLabel: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionValue: { fontSize: 16, color: theme.color.onSurface, marginTop: 4, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { color: theme.color.brand, fontWeight: '500' },
  mutedCenter: { textAlign: 'center', color: theme.color.muted, marginTop: 10, fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowBorder: { borderTopWidth: 0.5, borderTopColor: theme.color.border },
  itemName: { fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
  itemMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, borderWidth: 0.5, borderColor: theme.color.border },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText: { width: 24, textAlign: 'center', fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
  itemTotal: { fontSize: 14, color: theme.color.onSurface, fontWeight: '500', minWidth: 70, textAlign: 'right' },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.color.border },
  chipSelected: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSelected: { color: '#FFF', fontWeight: '500' },
  subLabel: { fontSize: 12, color: theme.color.muted, marginBottom: 6 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface, borderWidth: 0.5, borderColor: theme.color.border },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', borderTopWidth: 0.5, borderTopColor: theme.color.border, backgroundColor: 'rgba(255,255,255,0.85)' },
  stickyInner: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12, color: theme.color.muted },
  totalValue: { fontSize: 12, color: theme.color.onSurface },
  grandLabel: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500', marginTop: 4 },
  grandValue: { fontSize: 18, color: theme.color.brand, fontWeight: '500', marginTop: 4 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.color.brand, paddingHorizontal: 20, borderRadius: 14, alignSelf: 'center' },
  generateText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  toast: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: theme.color.surfaceInverse, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toastText: { color: '#FFF', fontSize: 13 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, color: theme.color.onSurface, fontSize: 14 },
  modalRow: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: theme.color.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 14, color: theme.color.brand, fontWeight: '500' },
});
