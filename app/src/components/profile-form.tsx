import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { LuUser } from 'react-icons/lu';

import { TextField } from '@/components/auth/text-field';
import { Button } from '@/components/ui/button';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/types';
import { normalizeName, validateName } from '@/lib/validation';

type Props = {
  initial: Profile | null;
  submitLabel: string;
  onSubmit: (p: { name: string; sharePhone: boolean }) => void | Promise<void>;
};

/** Editable rider details. The phone number is the verified one and isn't edited here. */
export function ProfileForm({ initial, submitLabel, onSubmit }: Props) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [sharePhone, setSharePhone] = useState(initial?.sharePhone ?? true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameError = validateName(name);

  return (
    <View style={styles.form}>
      <TextField
        label="Name shown to your group"
        icon={LuUser}
        value={name}
        onChangeText={setName}
        onBlur={() => setTouched(true)}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={40}
        error={touched ? nameError : null}
      />
      <View style={styles.switchRow}>
        <Text style={[styles.switchText, { color: theme.text }]}>Let riders in my group call me</Text>
        <Switch
          value={sharePhone}
          onValueChange={setSharePhone}
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
        disabled={Boolean(nameError)}
        loading={saving}
        style={styles.button}
        onPress={async () => {
          setTouched(true);
          if (nameError) return;
          setSaving(true);
          try {
            await onSubmit({ name: normalizeName(name), sharePhone });
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchText: { fontSize: Type.small + 1, flex: 1 },
  hint: { fontSize: Type.tiny + 1 },
  button: { marginTop: 8 },
});
