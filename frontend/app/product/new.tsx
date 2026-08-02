import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme } from '@/src/theme/theme';

const CATEGORIES = ['Mattress', 'Curtain', 'Sofa Fabric', 'Wallpaper', 'Carpet', 'Bedsheets', 'Cushions', 'Pillows', 'Home Decor', 'Accessories', 'General'];
const UNITS = ['pcs', 'mtr', 'set', 'roll', 'kg', 'box'];
const GST_RATES = [0, 5, 12, 18, 28];

export default function NewProduct() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Mattress');
  const [brand, setBrand] = useState('');
  const [hsn, setHsn] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [gstRate, setGstRate] = useState(5);
  const [stock, setStock] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name || !sellingPrice) { setError('Name and selling price are required'); return; }
    setSaving(true);
    try {
      await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          name, sku: sku || undefined, category, brand: brand || undefined, hsn: hsn || undefined,
          unit, purchase_price: parseFloat(purchasePrice || '0'), selling_price: parseFloat(sellingPrice),
          gst_rate: gstRate, stock: parseFloat(stock || '0'), color: color || undefined,
        }),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="new-product-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
          <Text style={styles.title}>New Product</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Product Name *" value={name} onChangeText={setName} tid="np-name" />
          <Field label="SKU (auto if empty)" value={sku} onChangeText={setSku} tid="np-sku" />
          <ChipRow label="Category" value={category} options={CATEGORIES} onChange={setCategory} tid="np-cat" />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="Brand" value={brand} onChangeText={setBrand} tid="np-brand" /></View>
            <View style={{ flex: 1 }}><Field label="Color" value={color} onChangeText={setColor} tid="np-color" /></View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="HSN" value={hsn} onChangeText={setHsn} keyboardType="numeric" tid="np-hsn" /></View>
            <View style={{ flex: 1 }}><ChipRow label="Unit" value={unit} options={UNITS} onChange={setUnit} tid="np-unit" /></View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="Purchase ₹" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" tid="np-pp" /></View>
            <View style={{ flex: 1 }}><Field label="Selling ₹ *" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="numeric" tid="np-sp" /></View>
          </View>
          <ChipRow label="GST Rate %" value={String(gstRate)} options={GST_RATES.map(String)} onChange={(v) => setGstRate(parseFloat(v))} tid="np-gst" />
          <Field label="Opening Stock" value={stock} onChangeText={setStock} keyboardType="numeric" tid="np-stock" />

          {error ? <Text style={styles.error} testID="np-error">{error}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="save-product-btn">
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save Product</Text>}
          </Pressable>
        </ScrollView>
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

function ChipRow({ label, value, options, onChange, tid }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o: string) => (
          <Pressable key={o} onPress={() => onChange(o)} testID={`${tid}-${o}`} style={[styles.chip, value === o && styles.chipSelected]}>
            <Text style={[styles.chipText, value === o && styles.chipTextSelected]}>{o}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface },
  row2: { flexDirection: 'row', gap: 12 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSelected: { color: '#FFF', fontWeight: '500' },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  error: { color: theme.color.error, fontSize: 13 },
});
