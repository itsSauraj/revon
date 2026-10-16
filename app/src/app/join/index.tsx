import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LuUserPlus } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Size, Type } from '@/constants/theme';

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
      <Button
        label="Join ride"
        icon={LuUserPlus}
        variant="accent"
        disabled={!valid}
        onPress={() => router.replace({ pathname: '/join/[code]', params: { code } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  label: { fontSize: Type.small + 1 },
  input: {
    height: 56,
    borderRadius: Size.radius,
    borderWidth: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
});
