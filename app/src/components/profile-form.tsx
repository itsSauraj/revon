import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/types';

type Props = { initial: Profile | null; submitLabel: string; onSubmit: (p: Profile) => void | Promise<void> };

export function ProfileForm({ initial, submitLabel, onSubmit }: Props) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [sharePhone, setSharePhone] = useState(initial?.sharePhone ?? false);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length >= 2;
  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Your name (shown to your group)</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Alex"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="words"
        maxLength={24}
        style={input}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>Phone number (optional)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+1 555 123 4567"
        placeholderTextColor={theme.textSecondary}
        keyboardType="phone-pad"
        maxLength={20}
        style={input}
      />
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: theme.text }]}>
          Let riders in my group call me
        </Text>
        <Switch value={sharePhone && phone.trim().length > 0} onValueChange={setSharePhone} disabled={!phone.trim()} />
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Your number is only shared with the people in a ride you join, and only while you are in it.
      </Text>

      <Pressable
        disabled={!valid || saving}
        onPress={async () => {
          setSaving(true);
          try {
            await onSubmit({ name: name.trim(), phone: phone.trim(), sharePhone: sharePhone && !!phone.trim() });
          } finally {
            setSaving(false);
          }
        }}
        style={[styles.button, { backgroundColor: theme.primary, opacity: valid && !saving ? 1 : 0.5 }]}>
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchText: { fontSize: 16, flex: 1 },
  hint: { fontSize: 13 },
  button: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { fontSize: 18, fontWeight: '800' },
});
