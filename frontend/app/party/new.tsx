import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/client';
import { theme } from '@/src/theme/theme';

export default function NewParty() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>((type as any) === 'supplier' ? 'supplier' : 'customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await api('/parties', {
        method: 'POST',
        body: JSON.stringify({
          name, phone: phone || undefined, email: email || undefined,
          gstin: gstin || undefined, address: address || undefined,
          party_type: partyType, opening_balance: parseFloat(opening || '0'),
        }),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="new-party-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
          <Text style={styles.title}>New {partyType === 'customer' ? 'Customer' : 'Supplier'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={styles.segment}>
            {(['customer', 'supplier'] as const).map((t) => (
              <Pressable key={t} onPress={() => setPartyType(t)} style={[styles.segItem, partyType === t && styles.segItemActive]} testID={`type-${t}`}>
                <Text style={[styles.segText, partyType === t && styles.segTextActive]}>{t === 'customer' ? 'Customer' : 'Supplier'}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Name *" value={name} onChangeText={setName} tid="p-name" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" tid="p-phone" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" tid="p-email" />
          <Field label="GSTIN" value={gstin} onChangeText={setGstin} autoCapitalize="characters" tid="p-gstin" />
          <Field label="Address" value={address} onChangeText={setAddress} multiline tid="p-addr" />
          <Field label="Opening Balance ₹ (due from party)" value={opening} onChangeText={setOpening} keyboardType="numeric" tid="p-open" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={save} disabled={saving} testID="save-party-btn">
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save</Text>}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: theme.color.onSurface },
  segment: { flexDirection: 'row', backgroundColor: theme.color.surfaceSecondary, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segItemActive: { backgroundColor: '#FFFFFF' },
  segText: { color: theme.color.muted, fontWeight: '500' },
  segTextActive: { color: theme.color.brand },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  error: { color: theme.color.error, fontSize: 13 },
});
