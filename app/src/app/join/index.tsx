import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { normalizeCode } from '@/lib/rides';

export default function JoinWithCode() {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const valid = normalizeCode(code).length === 6;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        Enter the 6-character code from your group&apos;s invite.
      </Text>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(normalizeCode(t).slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        placeholder="ABC234"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        onSubmitEditing={() => valid && router.replace({ pathname: '/join/[code]', params: { code } })}
      />
      <Pressable
        disabled={!valid}
        onPress={() => router.replace({ pathname: '/join/[code]', params: { code } })}
        style={[styles.button, { backgroundColor: theme.primary, opacity: valid ? 1 : 0.5 }]}>
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Join ride</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16 },
  label: { fontSize: 16 },
  input: {
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 18, fontWeight: '800' },
});
