import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function Manufacturing() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const [batches, prods] = await Promise.all([api<any[]>('/manufacturing'), api<any[]>('/products')]);
    setList(batches); setProducts(prods);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="manufacturing-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Manufacturing</Text>
        <Pressable onPress={() => setShowAdd(true)} testID="mfg-add-btn"><Ionicons name="add-circle" size={26} color={theme.color.brand} /></Pressable>
      </View>
      {loading ? <ActivityIndicator color={theme.color.brand} /> : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="hammer-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No production batches</Text><Pressable onPress={() => setShowAdd(true)}><Text style={styles.linkText}>Start first batch</Text></Pressable></View>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`mfg-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.batch_number}</Text>
                <Text style={styles.cardMeta}>{item.product_name} · Qty {item.quantity}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedText}>Cost/unit {inr(item.per_unit_cost)} · Wastage {item.wastage}</Text>
                  <Text style={styles.amount}>{inr(item.total_cost)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
      <AddBatch visible={showAdd} onClose={() => setShowAdd(false)} products={products} onSaved={load} />
    </SafeAreaView>
  );
}

function AddBatch({ visible, onClose, products, onSaved }: any) {
  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rawName, setRawName] = useState('');
  const [rawQty, setRawQty] = useState('');
  const [rawCost, setRawCost] = useState('');
  const [rawList, setRawList] = useState<{ name: string; quantity: number; unit: string; cost: number }[]>([]);
  const [labor, setLabor] = useState('');
  const [wastage, setWastage] = useState('');
  const [saving, setSaving] = useState(false);

  const addRaw = () => {
    if (!rawName || !rawQty) return;
    setRawList((p) => [...p, { name: rawName, quantity: parseFloat(rawQty), unit: 'pcs', cost: parseFloat(rawCost || '0') }]);
    setRawName(''); setRawQty(''); setRawCost('');
  };

  const save = async () => {
    if (!productName || !quantity) return;
    setSaving(true);
    try {
      await api('/manufacturing', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId, product_name: productName, quantity: parseFloat(quantity),
          raw_materials: rawList, labor_cost: parseFloat(labor || '0'), wastage: parseFloat(wastage || '0'),
        }),
      });
      setProductId(null); setProductName(''); setQuantity(''); setRawList([]); setLabor(''); setWastage('');
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Production Batch</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Product (link to inventory, optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => { setProductId(null); setProductName(''); }} style={[styles.chip, !productId && styles.chipSel]} testID="mfg-prod-none">
                <Text style={[styles.chipText, !productId && styles.chipTextSel]}>Ad-hoc</Text>
              </Pressable>
              {products.map((p: any) => (
                <Pressable key={p.id} onPress={() => { setProductId(p.id); setProductName(p.name); }} style={[styles.chip, productId === p.id && styles.chipSel]} testID={`mfg-prod-${p.id}`}>
                  <Text style={[styles.chipText, productId === p.id && styles.chipTextSel]}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Product Name *" value={productName} onChangeText={setProductName} tid="mfg-name" />
            <Field label="Quantity Produced *" value={quantity} onChangeText={setQuantity} keyboardType="numeric" tid="mfg-qty" />

            <Text style={styles.label}>Raw Materials</Text>
            {rawList.map((r, i) => (
              <View key={i} style={styles.rawRow}>
                <View style={{ flex: 1 }}><Text style={styles.itemName}>{r.name}</Text><Text style={styles.itemMeta}>{r.quantity} × {inr(r.cost)}</Text></View>
                <Pressable onPress={() => setRawList((p) => p.filter((_, idx) => idx !== i))}><Ionicons name="trash-outline" size={18} color={theme.color.error} /></Pressable>
              </View>
            ))}
            <View style={styles.row2}>
              <View style={{ flex: 2 }}><Field label="Material name" value={rawName} onChangeText={setRawName} tid="mfg-raw-name" /></View>
              <View style={{ flex: 1 }}><Field label="Qty" value={rawQty} onChangeText={setRawQty} keyboardType="numeric" tid="mfg-raw-qty" /></View>
              <View style={{ flex: 1 }}><Field label="Cost ₹" value={rawCost} onChangeText={setRawCost} keyboardType="numeric" tid="mfg-raw-cost" /></View>
            </View>
            <Pressable onPress={addRaw} style={styles.smallBtn} testID="mfg-add-raw"><Text style={styles.smallBtnText}>+ Add Material</Text></Pressable>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}><Field label="Labor Cost ₹" value={labor} onChangeText={setLabor} keyboardType="numeric" tid="mfg-labor" /></View>
              <View style={{ flex: 1 }}><Field label="Wastage (units)" value={wastage} onChangeText={setWastage} keyboardType="numeric" tid="mfg-wastage" /></View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="mfg-save-btn">
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Complete Batch</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' },
  mutedText: { fontSize: 11, color: theme.color.muted },
  amount: { fontSize: 15, color: theme.color.brand, fontWeight: '500' },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: theme.color.muted, fontSize: 14 },
  linkText: { color: theme.color.brand, fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSel: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSel: { color: '#FFF', fontWeight: '500' },
  row2: { flexDirection: 'row', gap: 8 },
  rawRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, gap: 8 },
  itemName: { fontSize: 14, color: theme.color.onSurface, fontWeight: '500' },
  itemMeta: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  smallBtn: { paddingVertical: 10, borderRadius: 10, borderWidth: 0.5, borderColor: theme.color.brand, alignItems: 'center' },
  smallBtnText: { color: theme.color.brand, fontWeight: '500' },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
});
