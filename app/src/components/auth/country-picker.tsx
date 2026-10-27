import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LuCheck, LuChevronDown, LuSearch, LuX } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { COUNTRIES, type Country } from '@/lib/countries';

type Props = { value: Country; onChange: (c: Country) => void };

/** The "+91 IN" button inside the phone field, opening a searchable country list. */
export function CountryPicker({ value, onChange }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^\+/, '');
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase() === term || c.dial.startsWith(term),
    );
  }, [q]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country code ${value.name} +${value.dial}. Change`}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderRightColor: theme.border }]}>
        <Text style={[styles.code, { color: theme.textSecondary }]}>{value.code}</Text>
        <Text style={[styles.dial, { color: theme.text }]}>+{value.dial}</Text>
        <Icon icon={LuChevronDown} size={14} color={theme.textSecondary} />
      </Pressable>

      {open && (
        <Modal animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Country code</Text>
              <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={() => setOpen(false)} />
            </View>
            <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Icon icon={LuSearch} size={Size.iconSm} color={theme.textSecondary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                autoFocus
                placeholder="Search country or code"
                placeholderTextColor={theme.muted}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>
            <FlatList
              data={results}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              renderItem={({ item }) => {
                const selected = item.code === value.code;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                      setQ('');
                    }}
                    style={[styles.row, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.rowCode, { color: theme.textSecondary }]}>{item.code}</Text>
                    <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.rowDial, { color: theme.textSecondary }]}>+{item.dial}</Text>
                    {selected && <Icon icon={LuCheck} size={Size.iconSm} color={theme.text} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={[styles.empty, { color: theme.textSecondary }]}>No matching country.</Text>}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, borderRightWidth: 1, height: '60%' },
  code: { fontSize: Type.tiny, fontWeight: '700' },
  dial: { fontSize: Type.body, fontWeight: '600' },
  sheet: { flex: 1, paddingHorizontal: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: Type.title, fontWeight: '700' },
  search: {
    height: Size.control,
    borderRadius: Size.radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: '100%', fontSize: Type.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCode: { width: 28, fontSize: Type.tiny, fontWeight: '700' },
  rowName: { flex: 1, fontSize: Type.small + 1 },
  rowDial: { fontSize: Type.small + 1, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 24, fontSize: Type.small },
});
