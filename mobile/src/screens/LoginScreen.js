import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { colors, mono } from '../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.kicker}>FIELD MONITOR</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.sub}>Device telemetry and alerts</Text>

        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
          onSubmitEditing={submit}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.header },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  kicker: { fontFamily: mono, color: colors.accent, letterSpacing: 3, fontSize: 12 },
  title: { color: '#fff', fontSize: 34, fontWeight: '700', marginTop: 6 },
  sub: { color: '#9AA1A6', marginBottom: 36, marginTop: 4 },
  label: { fontFamily: mono, color: '#9AA1A6', fontSize: 11, letterSpacing: 1.5, marginBottom: 6 },
  input: {
    backgroundColor: '#2E353B', color: '#fff', borderWidth: 1, borderColor: '#434B52',
    borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 18,
  },
  error: { color: '#FF8A80', marginBottom: 14 },
  button: { backgroundColor: colors.accent, borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  buttonBusy: { opacity: 0.7 },
  buttonText: { fontFamily: mono, color: '#fff', fontWeight: '700', letterSpacing: 2 },
});