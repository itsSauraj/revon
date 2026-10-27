import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconType } from 'react-icons';
import { LuBell, LuInfo, LuSiren, LuTriangleAlert, LuX } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Banner, dismissBanner, useBanners } from '@/lib/alerts';

const LEVEL_ICON: Record<Banner['level'], IconType> = {
  danger: LuSiren,
  warn: LuTriangleAlert,
  info: LuInfo,
  quiet: LuBell,
};

/** Stacked alerts at the top of the map. SOS banners are red and stay until tapped. */
export function AlertBanners({ onPress, top, right }: { onPress?: (b: Banner) => void; top?: number; right?: number }) {
  const theme = useTheme();
  const banners = useBanners();
  const insets = useSafeAreaInsets();
  if (!banners.length) return null;
  return (
    <View style={[styles.wrap, { top: top ?? insets.top + 56, right: right ?? 12 }]} pointerEvents="box-none">
      {banners.map((b) => {
        const danger = b.level === 'danger';
        const fg = danger ? theme.onDanger : theme.text;
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              onPress?.(b);
              dismissBanner(b.id);
            }}
            style={[styles.banner, danger && { backgroundColor: theme.danger, borderColor: theme.danger }]}>
            {/* SOS stays solid red; everything else is glass. */}
            {!danger && <Glass style={[StyleSheet.absoluteFill, { borderRadius: Size.radius }]} />}
            <Icon icon={LEVEL_ICON[b.level]} size={Size.iconSm} color={fg} />
            <Text style={[styles.text, { color: fg }]} numberOfLines={2}>
              {b.text}
            </Text>
            <Icon icon={LuX} size={14} color={fg} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, gap: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Size.radius,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, fontSize: Type.small + 1, fontWeight: '600' },
});
