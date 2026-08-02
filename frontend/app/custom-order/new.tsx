import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

const ORDER_TYPES = [
  { key: 'curtain_stitching', label: 'Curtain Stitching', fields: ['width', 'height', 'quantity'] },
  { key: 'mattress_custom', label: 'Mattress Custom', fields: ['width', 'length', 'thickness'] },
  { key: 'sofa_cutting', label: 'Sofa Fabric Cutting', fields: ['length', 'width'] },
  { key: 'other', label: 'Other', fields: ['notes'] },
] as const;

type Item = {
  product_name: string;
  order_type: 'curtain_stitching' | 'mattress_custom' | 'sofa_cutting' | 'other';
  measurements: Record<string, string>;
  price: number;
  notes?: string;
};

export default function NewCustomOrder() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [showCustomer, setShowCustomer] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [showItem, setShowItem] = useState(false);
  const [expected, setExpected] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<any[]>('/parties?party_type=customer').then(setCustomers).catch(() => {}); }, []);

  const total = items.reduce((s, i) => s + (i.price || 0), 0);

  const save = async () => {
    if (items.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError(null);
    try {
      const co = await api<any>('/custom-orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName,
          items: items.map((i) => ({ ...i, measurements: i.measurements || {} })),
          advance_paid: advance ? parseFloat(advance) : 0,
          expected_delivery: expected || undefined,
          notes: notes || undefined,
        }),
      });
      router.replace({ pathname: '/custom-order/[id]', params: { id: co.id } });
    } catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="new-custom-order-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
          <Text style={styles.title}>New Custom Order</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <Pressable style={styles.section} onPress={() => setShowCustomer(true)} testID="co-pick-customer">
            <Text style={styles.label}>Customer</Text>
            <View style={styles.rowBetween}><Text style={styles.value}>{customerName}</Text><Ionicons name="chevron-forward" size={18} color={theme.color.muted} /></View>
          </Pressable>

          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Items · {items.length}</Text>
              <Pressable onPress={() => setShowItem(true)} testID="co-add-item"><Text style={styles.linkText}>+ Add Item</Text></Pressable>
            </View>
            {items.length === 0 ? <Text style={styles.muted}>Tap +Add Item to add measurements</Text> : items.map((it, i) => (
              <View key={i} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.product_name}</Text>
                  <Text style={styles.itemMeta}>{ORDER_TYPES.find(t => t.key === it.order_type)?.label} · {Object.entries(it.measurements || {}).map(([k, v]) => `${k}:${v}`).join(' · ')}</Text>
                </View>
                <Text style={styles.amt}>{inr(it.price)}</Text>
                <Pressable onPress={() => setItems((p) => p.filter((_, idx) => idx !== i))} testID={`co-remove-item-${i}`}><Ionicons name="trash-outline" size={18} color={theme.color.error} /></Pressable>
              </View>
            ))}
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="Expected Delivery (YYYY-MM-DD)" value={expected} onChangeText={setExpected} tid="co-expected" placeholder="2026-02-20" /></View>
            <View style={{ flex: 1 }}><Field label="Advance ₹" value={advance} onChangeText={setAdvance} keyboardType="numeric" tid="co-advance" /></View>
          </View>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline tid="co-notes" />

          <View style={styles.totalCard}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.totalValue}>{inr(total)}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="co-save-btn">
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Create Order</Text>}
          </Pressable>
        </ScrollView>

        <CustomerPicker visible={showCustomer} customers={customers} onClose={() => setShowCustomer(false)} onPick={(c) => { setCustomerId(c.id === 'walk-in' ? null : c.id); setCustomerName(c.name); setShowCustomer(false); }} />
        <ItemPicker visible={showItem} onClose={() => setShowItem(false)} onAdd={(it) => { setItems((p) => [...p, it]); setShowItem(false); }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, tid, ...rest }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={tid} style={styles.input} placeholderTextColor={theme.color.muted} {...rest} />
    </View>
  );
}

function CustomerPicker({ visible, customers, onClose, onPick }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView>
            {[{ id: 'walk-in', name: 'Walk-in Customer' }, ...customers].map((c: any) => (
              <Pressable key={c.id} style={styles.pickRow} onPress={() => onPick(c)} testID={`co-cust-${c.id}`}>
                <Text style={styles.itemName}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ItemPicker({ visible, onClose, onAdd }: any) {
  const [orderType, setOrderType] = useState<typeof ORDER_TYPES[number]['key']>('curtain_stitching');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [m, setM] = useState<Record<string, string>>({});

  const fields = ORDER_TYPES.find(t => t.key === orderType)?.fields || [];

  const add = () => {
    if (!name || !price) return;
    onAdd({ product_name: name, order_type: orderType, measurements: m, price: parseFloat(price) });
    setName(''); setPrice(''); setM({});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Custom Item</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ORDER_TYPES.map((t) => (
                <Pressable key={t.key} onPress={() => { setOrderType(t.key); setM({}); }} style={[styles.chip, orderType === t.key && styles.chipSel]} testID={`co-type-${t.key}`}>
                  <Text style={[styles.chipText, orderType === t.key && styles.chipTextSel]}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Product / Description" value={name} onChangeText={setName} tid="co-item-name" placeholder="e.g. Bedroom curtain" />
            <View style={styles.row2}>
              {fields.slice(0, 2).map((f) => (
                <View key={f} style={{ flex: 1 }}>
                  <Field label={f} value={m[f] || ''} onChangeText={(v: string) => setM((p) => ({ ...p, [f]: v }))} tid={`co-m-${f}`} />
                </View>
              ))}
            </View>
            {fields.length > 2 && fields.slice(2).map((f) => (
              <Field key={f} label={f} value={m[f] || ''} onChangeText={(v: string) => setM((p) => ({ ...p, [f]: v }))} tid={`co-m-${f}`} />
            ))}
            <Field label="Price ₹" value={price} onChangeText={setPrice} keyboardType="numeric" tid="co-item-price" />
            <Pressable style={styles.primaryBtn} onPress={add} testID="co-item-add-btn"><Text style={styles.primaryBtnText}>Add to Order</Text></Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14 },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, color: theme.color.onSurface, marginTop: 4, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: theme.color.brand, fontWeight: '500' },
  muted: { color: theme.color.muted, marginTop: 8, fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 0.5, borderTopColor: theme.color.border },
  itemName: { color: theme.color.onSurface, fontWeight: '500', fontSize: 14 },
  itemMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  amt: { color: theme.color.brand, fontWeight: '500', fontSize: 14 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface, borderWidth: 0.5, borderColor: theme.color.border },
  row2: { flexDirection: 'row', gap: 12 },
  totalCard: { backgroundColor: theme.color.brand, padding: 16, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalValue: { color: '#FFF', fontSize: 24, fontWeight: '500' },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  error: { color: theme.color.error, fontSize: 13 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSel: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSel: { color: '#FFF', fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  pickRow: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: theme.color.border },
});
