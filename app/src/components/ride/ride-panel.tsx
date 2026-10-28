/**
 * The group-ride panel: a persistent bottom sheet over the map with two detents. Collapsed shows the
 * summary, one-tap status and Invite/Leave; pulled up, the convoy list (front first), roles and the
 * ride actions. The summary row is the sheet header (draggable; tap toggles the detent), and the
 * floating controls outside ride on `position`.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LuChevronUp, LuLock, LuLockOpen, LuLogOut, LuMapPin, LuUserPlus } from 'react-icons/lu';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { BottomSheet } from '@/components/ui/sheet';
import { Size, TextStyles } from '@/constants/theme';
import { GAP_ALERT_M, type Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/lib/geo';
import type { RideMeta, RiderRole, RiderStatus } from '@/lib/types';

import { initials, STATUS_META, STOP_STATUSES } from './status';

type Props = {
  meta: RideMeta;
  riders: Rider[];
  myUid: string;
  myStatus: RiderStatus;
  myRole: RiderRole;
  gapM: number | null;
  trackingNote: string | null;
  /** Receives the sheet's live visible height every frame (UI thread). */
  position: SharedValue<number>;
  /** The visible height the sheet came to rest at (RN thread): for map padding and framing. */
  onSettle: (height: number) => void;
  onStatus: (s: RiderStatus) => void;
  onRole: (r: RiderRole) => void;
  onRiderPress: (uid: string) => void;
  onInvite: () => void;
  onToggleLock: () => void;
  onRegroupHere: () => void;
  onLeave: () => void;
};

/** The sheet's own grabber row above the header: paddingTop 8 + bar 5 + margin 8 (see ui/sheet). */
const GRAB_H = 21;
const GAP = 10;
/** The open panel stays at least this far from the top of the screen (status bar, pills, banners). */
const TOP_CLEARANCE = 96;

function riderLine(r: Rider) {
  const where = !r.loc
    ? 'Waiting for location'
    : r.stale && r.status !== 'arrived'
      ? 'No signal'
      : r.relativeM != null
        ? `${formatDistance(r.relativeM)} ${r.relativeM >= 0 ? 'ahead' : 'behind'}`
        : r.status === 'arrived'
          ? null
          : r.moving
            ? 'Moving'
            : 'Stopped';
  return [STATUS_META[r.status]?.tag, where, r.loc?.offRoute ? 'off route' : null].filter(Boolean).join(' · ');
}

export function RidePanel(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { position } = p;
  const [index, setIndex] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [quickH, setQuickH] = useState(0);
  const [bodyH, setBodyH] = useState(0);
  const active = p.riders.length;

  // Snap points are visible heights measured from the content, so they follow the text size.
  // Collapsed ends a bottom inset below Invite/Leave; what lies under that fold (the top of the
  // rider list) peeks out, as a sheet's content does. Expanded is the whole content, capped so the
  // panel never reaches the top of the screen. Until measured both are 0 and the panel rises in.
  const cap = windowH - insets.top - TOP_CLEARANCE;
  const measured = headerH > 0 && quickH > 0 && bodyH > 0;
  const collapsed = measured ? Math.min(GRAB_H + headerH + quickH + GAP + insets.bottom, cap) : 0;
  const expanded = measured ? Math.max(collapsed, Math.min(GRAB_H + headerH + bodyH, cap)) : 0;
  const listMax = Math.max(140, Math.min(220, Math.round(windowH * 0.3)));

  // The chevron turns with the sheet, 1:1 with the finger: "pull up" becomes "push down".
  const chevron = useAnimatedStyle(() => {
    const span = expanded - collapsed;
    const t = span > 0 ? Math.min(1, Math.max(0, (position.get() - collapsed) / span)) : 0;
    return { transform: [{ rotate: `${t * 180}deg` }] };
  });

  const header = (
    <Pressable
      onPress={() => setIndex((i) => (i === 0 ? 1 : 0))}
      onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      accessibilityRole="button"
      accessibilityLabel={index === 0 ? 'Expand ride panel' : 'Collapse ride panel'}
      style={styles.summary}>
      <View style={styles.flex}>
        <Text style={[TextStyles.bodyStrong, { color: theme.text }]} numberOfLines={1}>
          {p.meta.destination.name}
        </Text>
        <Text style={[TextStyles.small, { color: theme.textSecondary }]} numberOfLines={1}>
          {active} rider{active === 1 ? '' : 's'} · code {p.meta.code}
          {p.meta.locked ? ' · locked' : ''}
          {p.gapM != null ? ` · spread ${formatDistance(p.gapM)}` : ''}
        </Text>
      </View>
      <Animated.View style={chevron}>
        <Icon icon={LuChevronUp} size={Size.icon} color={theme.textSecondary} />
      </Animated.View>
    </Pressable>
  );

  return (
    <BottomSheet
      snapPoints={[collapsed, expanded]}
      index={index}
      onIndexChange={setIndex}
      position={position}
      onSettle={p.onSettle}
      glass
      header={header}>
      <View style={[styles.body, { paddingBottom: insets.bottom + GAP }]} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
        {/* Visible at the collapsed detent. */}
        <View style={styles.quick} onLayout={(e) => setQuickH(e.nativeEvent.layout.height)}>
          {p.trackingNote && <Text style={[TextStyles.small, { color: theme.textSecondary }]}>{p.trackingNote}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STOP_STATUSES.map((s) => {
              const m = STATUS_META[s]!;
              const on = p.myStatus === s;
              return <Chip key={s} label={m.label} icon={m.icon} selected={on} onPress={() => p.onStatus(on ? 'riding' : s)} />;
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Button label="Invite" icon={LuUserPlus} variant="inverse" size="sm" onPress={p.onInvite} style={styles.flex} />
            <Button label="Leave" icon={LuLogOut} size="sm" onPress={p.onLeave} style={styles.flex} />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <ScrollView style={{ maxHeight: listMax }}>
          {p.riders.map((r) => {
            const isMe = r.uid === p.myUid;
            const sos = r.status === 'sos';
            const bg = sos ? theme.danger : r.stale ? theme.stale : isMe ? theme.me : theme.rider;
            const ink = sos ? theme.onDanger : r.stale ? '#FFFFFF' : isMe ? theme.meInk : theme.riderInk;
            const line = riderLine(r);
            return (
              <PressableScale
                key={r.uid}
                accessibilityLabel={`${r.name}${isMe ? ', you' : ''}. ${line}`}
                onPress={() => p.onRiderPress(r.uid)}
                style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                  <Text style={[TextStyles.tiny, styles.avatarText, { color: ink }]}>{initials(r.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
                    {r.name}
                    {isMe ? ' (you)' : ''}
                    {r.role ? ` · ${r.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
                  </Text>
                  <Text style={[TextStyles.small, { color: sos ? theme.danger : theme.textSecondary }]} numberOfLines={1}>
                    {line}
                  </Text>
                </View>
                {STATUS_META[r.status] && (
                  <Icon icon={STATUS_META[r.status]!.icon} size={Size.iconSm} color={sos ? theme.danger : theme.textSecondary} />
                )}
              </PressableScale>
            );
          })}
        </ScrollView>

        <View style={styles.roleRow}>
          <Text style={[TextStyles.small, { color: theme.textSecondary }]}>My role</Text>
          {(['lead', 'sweep', null] as RiderRole[]).map((role) => (
            <Chip
              key={role ?? 'none'}
              label={role === 'lead' ? 'Lead' : role === 'sweep' ? 'Sweep' : 'Rider'}
              selected={p.myRole === role}
              onPress={() => p.onRole(role)}
            />
          ))}
        </View>
        {p.gapM == null && (
          <Text style={[TextStyles.tiny, { color: theme.textSecondary }]}>
            Set a Lead and a Sweep to get an alert when the group spreads over {formatDistance(GAP_ALERT_M)}.
          </Text>
        )}

        <View style={styles.actions}>
          <Button label="Regroup here" icon={LuMapPin} size="sm" onPress={p.onRegroupHere} style={styles.flex} />
          <Button
            label={p.meta.locked ? 'Unlock' : 'Lock'}
            icon={p.meta.locked ? LuLockOpen : LuLock}
            size="sm"
            onPress={p.onToggleLock}
            style={styles.flex}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: GAP },
  body: { paddingHorizontal: 14, gap: GAP },
  quick: { gap: GAP },
  chips: { gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 8 },
});
