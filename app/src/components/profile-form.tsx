import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Size, Type } from '@/constants/theme';
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
        <Switch
          value={sharePhone && phone.trim().length > 0}
          onValueChange={setSharePhone}
          disabled={!phone.trim()}
          trackColor={{ true: theme.inverse, false: theme.border }}
          thumbColor={theme.surface}
          ios_backgroundColor={theme.border}
        />
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Your number is only shared with the people in a ride you join, and only while you are in it.
      </Text>

      <Button
        label={submitLabel}
        variant="accent"
        disabled={!valid}
        loading={saving}
        style={styles.button}
        onPress={async () => {
          setSaving(true);
          try {
            await onSubmit({ name: name.trim(), phone: phone.trim(), sharePhone: sharePhone && !!phone.trim() });
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  label: { fontSize: Type.small - 1, fontWeight: '600', marginTop: 6 },
  input: { height: Size.control, borderRadius: Size.radius, borderWidth: 1, paddingHorizontal: 12, fontSize: Type.body },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchText: { fontSize: Type.small + 1, flex: 1 },
  hint: { fontSize: Type.tiny + 1 },
  button: { marginTop: 12 },
});
