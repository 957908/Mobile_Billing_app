import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

export default function Rolls() {
  const router = useRouter();
  const [rolls, setRolls] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [consumeFor, setConsumeFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([api<any[]>('/rolls'), api<any[]>('/parties?party_type=supplier')]);
    setRolls(r); setSuppliers(s);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="rolls-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Fabric Rolls</Text>
        <Pressable onPress={() => setShowAdd(true)} testID="roll-add-btn"><Ionicons name="add-circle" size={26} color={theme.color.brand} /></Pressable>
      </View>
      {loading ? <ActivityIndicator color={theme.color.brand} /> : (
        <FlatList
          data={rolls}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="reorder-four-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No fabric rolls</Text><Pressable onPress={() => setShowAdd(true)}><Text style={styles.linkText}>Add first roll</Text></Pressable></View>}
          renderItem={({ item }) => {
            const pct = item.total_length > 0 ? Math.max(0, Math.min(100, (item.remaining_length / item.total_length) * 100)) : 0;
            const low = item.remaining_length < item.total_length * 0.15;
            return (
              <View style={styles.card} testID={`roll-row-${item.id}`}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardMeta}>{item.roll_number} · {item.color || '—'} · {item.pattern || '—'}</Text>
                  </View>
                  <Pressable onPress={() => setConsumeFor(item)} style={styles.consumeBtn} testID={`roll-consume-${item.id}`}>
                    <Text style={styles.consumeText}>Consume</Text>
                  </Pressable>
                </View>
                <View style={styles.progressWrap}>
                  <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: low ? theme.color.error : theme.color.brand }]} />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedText}>Remaining {item.remaining_length}m / Total {item.total_length}m</Text>
                  <Text style={styles.amount}>{inr(item.cost_per_meter)}/m</Text>
                </View>
              </View>
            );
          }}
        />
      )}
      <AddRoll visible={showAdd} onClose={() => setShowAdd(false)} suppliers={suppliers} onSaved={load} />
      <ConsumeRoll roll={consumeFor} onClose={() => setConsumeFor(null)} onSaved={load} />
    </SafeAreaView>
  );
}

function AddRoll({ visible, onClose, suppliers, onSaved }: any) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [pattern, setPattern] = useState('');
  const [length, setLength] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name || !length) return;
    setSaving(true);
    try {
      await api('/rolls', {
        method: 'POST',
        body: JSON.stringify({
          name, color: color || undefined, pattern: pattern || undefined,
          total_length: parseFloat(length), cost_per_meter: parseFloat(cost || '0'),
          supplier_id: supplierId, supplier_name: supplierName || undefined,
        }),
      });
      setName(''); setColor(''); setPattern(''); setLength(''); setCost(''); setSupplierId(null); setSupplierName('');
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Fabric Roll</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Field label="Fabric Name *" value={name} onChangeText={setName} tid="roll-name" placeholder="e.g. Velvet Emerald" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}><Field label="Color" value={color} onChangeText={setColor} tid="roll-color" /></View>
              <View style={{ flex: 1 }}><Field label="Pattern" value={pattern} onChangeText={setPattern} tid="roll-pattern" /></View>
            </View>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}><Field label="Total Length (m) *" value={length} onChangeText={setLength} keyboardType="numeric" tid="roll-length" /></View>
              <View style={{ flex: 1 }}><Field label="Cost / Meter ₹" value={cost} onChangeText={setCost} keyboardType="numeric" tid="roll-cost" /></View>
            </View>
            <Text style={styles.label}>Supplier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => { setSupplierId(null); setSupplierName(''); }} style={[styles.chip, !supplierId && styles.chipSel]}>
                <Text style={[styles.chipText, !supplierId && styles.chipTextSel]}>None</Text>
              </Pressable>
              {suppliers.map((s: any) => (
                <Pressable key={s.id} onPress={() => { setSupplierId(s.id); setSupplierName(s.name); }} style={[styles.chip, supplierId === s.id && styles.chipSel]} testID={`roll-sup-${s.id}`}>
                  <Text style={[styles.chipText, supplierId === s.id && styles.chipTextSel]}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="roll-save-btn">
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save Roll</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ConsumeRoll({ roll, onClose, onSaved }: any) {
  const [length, setLength] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!length) return;
    setSaving(true); setError(null);
    try {
      await api(`/rolls/${roll.id}/consume`, { method: 'POST', body: JSON.stringify({ length: parseFloat(length), notes: notes || undefined }) });
      setLength(''); setNotes('');
      onSaved(); onClose();
    } catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (!roll) return null;

  return (
    <Modal visible={!!roll} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Consume from {roll.name}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <Text style={styles.mutedText}>Remaining {roll.remaining_length}m</Text>
          <View style={{ height: 12 }} />
          <Field label="Meters to consume *" value={length} onChangeText={setLength} keyboardType="numeric" tid="roll-consume-length" />
          <View style={{ height: 12 }} />
          <Field label="Notes (order/customer)" value={notes} onChangeText={setNotes} tid="roll-consume-notes" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="roll-consume-save">
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Consume</Text>}
          </Pressable>
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
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  consumeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.color.brandTertiary },
  consumeText: { color: theme.color.brand, fontWeight: '500', fontSize: 12 },
  progressWrap: { height: 8, backgroundColor: '#FFF', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 4 },
  mutedText: { fontSize: 11, color: theme.color.muted },
  amount: { fontSize: 13, color: theme.color.brand, fontWeight: '500' },
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
  row2: { flexDirection: 'row', gap: 12 },
  error: { color: theme.color.error, fontSize: 13, marginTop: 8 },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
});
