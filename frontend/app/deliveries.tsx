import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme } from '@/src/theme/theme';

const STATUSES = ['All', 'Assigned', 'Out for Delivery', 'Delivered', 'Failed'] as const;

export default function Deliveries() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [status, setStatus] = useState<typeof STATUSES[number]>('All');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const q = status === 'All' ? '' : `?status_filter=${encodeURIComponent(status)}`;
    const [d, inv] = await Promise.all([api<any[]>(`/deliveries${q}`), api<any[]>('/invoices?kind=sale')]);
    setList(d); setInvoices(inv);
  }, [status]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="deliveries-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>Delivery</Text>
        <Pressable onPress={() => setShowAdd(true)} testID="del-add-btn"><Ionicons name="add-circle" size={26} color={theme.color.brand} /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {STATUSES.map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipSel]} testID={`del-status-${s}`}>
            <Text style={[styles.chipText, status === s && styles.chipTextSel]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={theme.color.brand} /> : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="bicycle-outline" size={40} color={theme.color.muted} /><Text style={styles.emptyText}>No deliveries scheduled</Text><Pressable onPress={() => setShowAdd(true)}><Text style={styles.linkText}>Schedule first delivery</Text></Pressable></View>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/delivery/[id]', params: { id: item.id } })} testID={`del-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{item.delivery_number}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.cardMeta}>{item.customer_name} · {item.driver_name || 'No driver'}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedText}>{item.address || 'No address'}</Text>
                  <Text style={styles.mutedText}>{item.invoice_number || ''}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
      <AddDelivery visible={showAdd} onClose={() => setShowAdd(false)} invoices={invoices} onSaved={load} />
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Assigned': theme.color.warning,
    'Out for Delivery': '#5856D6',
    'Delivered': theme.color.success,
    'Failed': theme.color.error,
    'Cancelled': theme.color.muted,
  };
  const c = colors[status] || theme.color.muted;
  return <View style={[styles.badge, { backgroundColor: c + '20' }]}><Text style={[styles.badgeText, { color: c }]}>{status}</Text></View>;
}

function AddDelivery({ visible, onClose, invoices, onSaved }: any) {
  const [invId, setInvId] = useState<string | null>(null);
  const [invNum, setInvNum] = useState<string>('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await api('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: invId, invoice_number: invNum || undefined,
          customer_name: customer, customer_phone: phone || undefined,
          address: address || undefined, driver_name: driver || undefined, vehicle: vehicle || undefined,
          scheduled_date: scheduled || undefined,
        }),
      });
      setInvId(null); setInvNum(''); setCustomer(''); setPhone(''); setAddress(''); setDriver(''); setVehicle(''); setScheduled('');
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule Delivery</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.color.onSurface} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Link Invoice (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => { setInvId(null); setInvNum(''); }} style={[styles.chip, !invId && styles.chipSel]}>
                <Text style={[styles.chipText, !invId && styles.chipTextSel]}>None</Text>
              </Pressable>
              {invoices.slice(0, 20).map((i: any) => (
                <Pressable key={i.id} onPress={() => { setInvId(i.id); setInvNum(i.invoice_number); setCustomer(i.customer_name || ''); }} style={[styles.chip, invId === i.id && styles.chipSel]} testID={`del-inv-${i.id}`}>
                  <Text style={[styles.chipText, invId === i.id && styles.chipTextSel]}>{i.invoice_number}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Customer Name *" value={customer} onChangeText={setCustomer} tid="del-customer" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}><Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" tid="del-phone" /></View>
              <View style={{ flex: 1 }}><Field label="Scheduled Date" value={scheduled} onChangeText={setScheduled} tid="del-scheduled" placeholder="2026-02-20" /></View>
            </View>
            <Field label="Address" value={address} onChangeText={setAddress} multiline tid="del-address" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}><Field label="Driver" value={driver} onChangeText={setDriver} tid="del-driver" /></View>
              <View style={{ flex: 1 }}><Field label="Vehicle" value={vehicle} onChangeText={setVehicle} tid="del-vehicle" placeholder="MH12AB1234" /></View>
            </View>
            <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="del-save-btn">
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Schedule</Text>}
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
  chipsRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: theme.color.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipSel: { backgroundColor: theme.color.brand },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  chipTextSel: { color: '#FFF', fontWeight: '500' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14, gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  cardMeta: { fontSize: 12, color: theme.color.muted },
  mutedText: { fontSize: 11, color: theme.color.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: theme.color.muted, fontSize: 14 },
  linkText: { color: theme.color.brand, fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface },
  row2: { flexDirection: 'row', gap: 12 },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
});
