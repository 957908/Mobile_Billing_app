import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/src/i18n';
import { useAuth } from '@/src/state/auth';
import { theme } from '@/src/theme/theme';
import { useEffect, useState } from 'react';
import { pendingSyncCount, replayQueue } from '@/src/api/client';

export default function Settings() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => setPending(await pendingSyncCount());
  useEffect(() => { refresh(); }, []);

  const sync = async () => {
    setSyncing(true);
    try { await replayQueue(); } finally { await refresh(); setSyncing(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="settings-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
        <Text style={styles.title}>{t('settings')}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('language')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {(['en', 'hi'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.langChip, lang === l && styles.langChipSel]} testID={`lang-${l}`}>
                <Text style={[styles.langChipText, lang === l && styles.langChipTextSel]}>{l === 'en' ? t('english') : t('hindi')}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('pending_sync')}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.value}>{pending} operation{pending === 1 ? '' : 's'} queued</Text>
            <Pressable style={styles.smallBtn} onPress={sync} disabled={syncing || pending === 0} testID="sync-now-btn">
              {syncing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.smallBtnText}>{t('sync_now')}</Text>}
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={{ marginTop: 6 }}>
            <Text style={styles.value}>{user?.name}</Text>
            <Text style={styles.mutedText}>{user?.email} · {user?.role}</Text>
            <Text style={styles.mutedText}>{user?.business_name}</Text>
          </View>
        </View>

        <Pressable style={styles.dangerBtn} onPress={signOut} testID="settings-logout-btn">
          <Ionicons name="log-out-outline" size={18} color={theme.color.error} />
          <Text style={styles.dangerText}>{t('logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '500', color: theme.color.onSurface },
  section: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, color: theme.color.onSurface, marginTop: 4, fontWeight: '500' },
  mutedText: { color: theme.color.muted, fontSize: 12, marginTop: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  langChip: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#FFF', borderWidth: 0.5, borderColor: theme.color.border },
  langChipSel: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  langChipText: { color: theme.color.onSurface, fontSize: 14 },
  langChipTextSel: { color: '#FFF', fontWeight: '500' },
  smallBtn: { backgroundColor: theme.color.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  smallBtnText: { color: '#FFF', fontWeight: '500', fontSize: 13 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFE5E3', paddingVertical: 14, borderRadius: 14 },
  dangerText: { color: theme.color.error, fontWeight: '500', fontSize: 15 },
});
