import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { api } from '@/src/api/client';
import { theme } from '@/src/theme/theme';

const FLOW = ['Assigned', 'Out for Delivery', 'Delivered'] as const;

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { const doc = await api(`/deliveries/${id}`); setD(doc); }, [id]);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const changeStatus = async (s: string) => {
    setBusy(true);
    try { const u = await api(`/deliveries/${id}/status`, { method: 'PUT', body: JSON.stringify({ new_status: s }) }); setD(u); }
    finally { setBusy(false); }
  };

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) { flash('Camera denied — open Settings'); Linking.openSettings(); return; }
        return;
      }
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images }).catch(() => null);
    if (!res || res.canceled) {
      // fallback to library on web
      const lib = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (!lib.canceled) setPhoto(`data:image/jpeg;base64,${lib.assets[0].base64}`);
      return;
    }
    if (res.assets && res.assets[0].base64) setPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const confirmDelivery = async () => {
    setError(null);
    if (!otp) { setError('Enter 4-digit OTP'); return; }
    setBusy(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      if (Platform.OS !== 'web') {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
          if (loc) { lat = loc.coords.latitude; lng = loc.coords.longitude; }
        }
      }
      const u = await api(`/deliveries/${id}/confirm`, { method: 'POST', body: JSON.stringify({ otp, photo_base64: photo, latitude: lat, longitude: lng }) });
      setD(u);
      flash('Delivery confirmed!');
    } catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  if (!d) return <View style={styles.center}><ActivityIndicator color={theme.color.brand} /></View>;

  const done = d.status === 'Delivered';
  const failed = d.status === 'Failed' || d.status === 'Cancelled';
  const currentIdx = FLOW.indexOf(d.status as any);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="delivery-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>{d.delivery_number}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.hero}>
          <Text style={styles.customer}>{d.customer_name}</Text>
          {d.address ? <Text style={styles.subMuted}>{d.address}</Text> : null}
          {d.customer_phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${d.customer_phone}`)} style={styles.phoneRow}>
              <Ionicons name="call" size={14} color="#FFF" />
              <Text style={styles.phoneText}>{d.customer_phone}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status</Text>
          {FLOW.map((s, i) => (
            <Pressable key={s} onPress={() => !done && !failed && changeStatus(s)} style={styles.step} testID={`del-step-${s}`} disabled={busy || done || failed}>
              <View style={[styles.dot, i <= currentIdx && styles.dotDone, i === currentIdx && styles.dotActive]}>
                {i <= currentIdx ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
              </View>
              <Text style={[styles.stepLabel, i === currentIdx && { color: theme.color.brand, fontWeight: '500' }]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Driver / Vehicle</Text>
          <Text style={styles.value}>{d.driver_name || '—'} · {d.vehicle || '—'}</Text>
          {d.invoice_number ? <Text style={styles.subMuted}>Linked to {d.invoice_number}</Text> : null}
        </View>

        {!done ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Confirm Delivery</Text>
            <Text style={styles.subMuted}>Share OTP with customer: <Text style={styles.otpDisplay}>{d.otp}</Text></Text>
            <View style={{ height: 12 }} />
            <Text style={styles.label}>Enter customer OTP</Text>
            <TextInput testID="delivery-otp-input" style={styles.input} keyboardType="numeric" maxLength={4} value={otp} onChangeText={setOtp} placeholder="4-digit code" placeholderTextColor={theme.color.muted} />
            <View style={{ height: 12 }} />
            <Text style={styles.label}>Photo Proof</Text>
            <Pressable style={styles.photoBtn} onPress={pickPhoto} testID="del-photo-btn">
              {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <><Ionicons name="camera" size={20} color={theme.color.brand} /><Text style={styles.photoBtnText}>Take Photo / Pick from Library</Text></>}
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primaryBtn} onPress={confirmDelivery} disabled={busy} testID="confirm-delivery-btn">
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Confirm Delivery</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Proof of Delivery</Text>
            {d.photo_base64 ? <Image source={{ uri: d.photo_base64 }} style={styles.proofPhoto} /> : <Text style={styles.subMuted}>No photo attached</Text>}
            {d.latitude ? <Text style={styles.subMuted}>Location: {d.latitude.toFixed(5)}, {d.longitude?.toFixed(5)}</Text> : null}
            {d.delivered_at ? <Text style={styles.subMuted}>Delivered {new Date(d.delivered_at).toLocaleString()}</Text> : null}
          </View>
        )}
      </ScrollView>
      {toast ? <View style={styles.toast} testID="del-toast"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  hero: { backgroundColor: theme.color.brand, borderRadius: 20, padding: 20 },
  customer: { color: '#FFF', fontSize: 20, fontWeight: '500' },
  subMuted: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  phoneText: { color: '#FFF', fontSize: 13 },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 14 },
  sectionLabel: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  value: { fontSize: 15, color: theme.color.onSurface, fontWeight: '500' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: theme.color.brand },
  dotActive: { borderWidth: 3, borderColor: theme.color.brandTertiary },
  stepLabel: { color: theme.color.onSurface, fontSize: 14 },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 20, color: theme.color.onSurface, borderWidth: 0.5, borderColor: theme.color.border, textAlign: 'center', letterSpacing: 8 },
  otpDisplay: { color: theme.color.brand, fontWeight: '500', letterSpacing: 4 },
  photoBtn: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.color.brand, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row', minHeight: 100 },
  photoBtnText: { color: theme.color.brand, fontWeight: '500' },
  photo: { width: '100%', height: 160, borderRadius: 8, resizeMode: 'cover' },
  proofPhoto: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover', marginTop: 6 },
  error: { color: theme.color.error, marginTop: 8, fontSize: 13 },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  toast: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: theme.color.surfaceInverse, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toastText: { color: '#FFF', fontSize: 13 },
});
