import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, FlatList, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme, inr } from '@/src/theme/theme';

const CATEGORIES = ['Fuel', 'Tea/Coffee', 'Snacks', 'Electricity', 'Internet', 'Salary', 'Rent', 'Packaging', 'Transport', 'Courier', 'Marketing', 'Repair', 'Maintenance', 'Cleaning', 'Office', 'Travel', 'Loading/Unloading', 'Miscellaneous'];
const METHODS = ['Cash', 'UPI', 'Card', 'Bank'] as const;

export default function Expenses() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => { const list = await api<any[]>('/expenses'); setExpenses(list); }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const monthTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="expenses-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Expenses</Text>
        <Pressable onPress={() => setShowAdd(true)} testID="add-expense-btn"><Ionicons name="add-circle" size={26} color={theme.color.brand} /></Pressable>
      </View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total Expenses</Text>
        <Text style={styles.summaryValue}>{inr(monthTotal)}</Text>
      </View>
      {loading ? <ActivityIndicator color={theme.color.brand} /> : (
        <FlatList
          data={expenses}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.empty}>No expenses yet. Tap + to add.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`exp-row-${item.id}`}>
              <View style={styles.iconWrap}><Ionicons name="wallet-outline" size={20} color={theme.color.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.category}</Text>
                <Text style={styles.cardMeta}>{item.payment_method} · {item.date}</Text>
              </View>
              <Text style={styles.amount}>{inr(item.amount)}</Text>
            </View>
          )}
        />
      )}
      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
    </SafeAreaView>
  );
}

function AddExpenseModal({ visible, onClose, onSaved }: any) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank'>('Cash');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount) return;
    setSaving(true);
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ category, amount: parseFloat(amount), notes: notes || undefined, payment_method: method }),
      });
      setAmount(''); setNotes('');
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <Pressable onPress={onClose} testID="close-exp-modal"><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipSelected]} testID={`exp-cat-${c}`}>
                  <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Amount ₹</Text>
            <TextInput testID="exp-amount-input" style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={theme.color.muted} />
            <Text style={styles.label}>Payment Method</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {METHODS.map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, method === m && styles.chipSelected, { flex: 1 }]} testID={`exp-pay-${m}`}>
                  <Text style={[styles.chipText, method === m && styles.chipTextSelected]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput testID="exp-notes-input" style={[styles.input, { height: 60 }]} multiline value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={theme.color.muted} />
            <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="save-expense-btn">
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save Expense</Text>}
            </Pressable>
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
  summary: { paddingHorizontal: 16, paddingBottom: 12 },
  summaryLabel: { color: theme.color.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 32, color: theme.color.onSurface, fontWeight: '500', marginTop: 4 },
  empty: { textAlign: 'center', color: theme.color.muted, marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: theme.color.surfaceSecondary, borderRadius: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: theme.color.onSurface, fontWeight: '500', fontSize: 15 },
  cardMeta: { color: theme.color.muted, fontSize: 12, marginTop: 2 },
  amount: { color: theme.color.error, fontSize: 15, fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSelected: { color: '#FFF', fontWeight: '500' },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
});
