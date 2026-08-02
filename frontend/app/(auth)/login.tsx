import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/auth';
import { theme } from '@/src/theme/theme';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('admin@lotuserp.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Enter email and password'); return; }
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={['#274A3D', '#1B3529']} style={styles.hero}>
            <View style={styles.logoBadge}>
              <Ionicons name="leaf" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.brand}>LotusERP</Text>
            <Text style={styles.tagline}>Home Furnishing · Décor · Retail ERP</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to manage your business</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@business.com"
                placeholderTextColor={theme.color.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={theme.color.muted}
              />
            </View>

            {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

            <Pressable testID="login-submit-button" style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New here? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable testID="go-to-register-link"><Text style={styles.link}>Create account</Text></Pressable>
              </Link>
            </View>

            <View style={styles.hintBox}>
              <Ionicons name="information-circle" size={16} color={theme.color.brand} />
              <Text style={styles.hintText}>Demo: admin@lotuserp.com · admin123</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48, alignItems: 'flex-start', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoBadge: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brand: { color: '#FFF', fontSize: 30, fontWeight: '500', letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  card: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '500', color: theme.color.onSurface },
  subtitle: { fontSize: 14, color: theme.color.muted, marginBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: theme.color.onSurface },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  error: { color: theme.color.error, fontSize: 13 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: theme.color.muted },
  link: { color: theme.color.brand, fontWeight: '500' },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.color.brandTertiary, padding: 10, borderRadius: 10, marginTop: 8 },
  hintText: { color: theme.color.brand, fontSize: 12 },
});
