import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/auth';
import { theme } from '@/src/theme/theme';

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!name || !email || !password) { setError('All fields are required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 chars'); return; }
    setLoading(true);
    try {
      await signUp({ name, business_name: business || undefined, email: email.trim().toLowerCase(), password });
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} testID="register-back-btn"><Ionicons name="chevron-back" size={26} color={theme.color.onSurface} /></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start managing your décor business</Text>

            <Field label="Your name" value={name} onChangeText={setName} placeholder="Rakesh Sharma" tid="reg-name-input" />
            <Field label="Business name" value={business} onChangeText={setBusiness} placeholder="LotusERP Demo Store" tid="reg-business-input" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@business.com" autoCapitalize="none" keyboardType="email-address" tid="reg-email-input" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry tid="reg-password-input" />

            {error ? <Text style={styles.error} testID="reg-error">{error}</Text> : null}

            <Pressable testID="register-submit-button" style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already registered? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable testID="go-to-login-link"><Text style={styles.link}>Sign in</Text></Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, tid, ...rest }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={tid} style={styles.input} placeholderTextColor={theme.color.muted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1 },
  headerRow: { padding: 16 },
  card: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '500', color: theme.color.onSurface },
  subtitle: { fontSize: 14, color: theme.color.muted, marginBottom: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, color: theme.color.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: theme.color.onSurface },
  primaryBtn: { backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  error: { color: theme.color.error, fontSize: 13 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { color: theme.color.muted },
  link: { color: theme.color.brand, fontWeight: '500' },
});
