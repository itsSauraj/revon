import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Banner, dismissBanner, useBanners } from '@/lib/alerts';

const BG: Record<Banner['level'], string> = {
  danger: '#E5484D',
  warn: '#F76B15',
  info: '#1C1D20',
  quiet: '#3A3B40',
};

/** Stacked alerts at the top of the map. SOS banners stay until tapped. */
export function AlertBanners({ onPress }: { onPress?: (b: Banner) => void }) {
  const banners = useBanners();
  const insets = useSafeAreaInsets();
  if (!banners.length) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 64 }]} pointerEvents="box-none">
      {banners.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => {
            onPress?.(b);
            dismissBanner(b.id);
          }}
          style={[styles.banner, { backgroundColor: BG[b.level] }]}>
          <Text style={styles.text}>{b.text}</Text>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, gap: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  close: { color: '#fff', fontSize: 16, marginLeft: 12, opacity: 0.8 },
});
