import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LuSiren } from 'react-icons/lu';

import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';

const HOLD_MS = 2000;

type Props = { active: boolean; onTrigger: () => void; onClear: () => void };

/**
 * Must be held for 2 s to send, so a bump or glove tap doesn't alert the whole group.
 * When active, a single tap clears it.
 */
export function SosButton({ active, onTrigger, onClear }: Props) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  // The SOS write updates `active` locally before the finger lifts; don't let that release clear it.
  const justTriggered = useRef(false);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  useEffect(() => stop, []);

  const start = () => {
    if (active) return;
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stop();
        justTriggered.current = true;
        onTrigger();
      }
    }, 50);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Cancel SOS' : 'Hold for two seconds to send SOS'}
      onPressIn={start}
      onPressOut={stop}
      onPress={() => {
        if (justTriggered.current) {
          justTriggered.current = false;
          return;
        }
        if (active) onClear();
      }}
      style={[styles.btn, active && styles.active]}>
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      <Icon icon={LuSiren} size={Size.iconSm} color="#FFFFFF" />
      <Text style={styles.text}>{active ? 'SOS sent · tap if OK' : progress > 0 ? 'Hold…' : 'SOS'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: 6,
    minWidth: 72,
    height: Size.fab,
    paddingHorizontal: 14,
    borderRadius: Size.fab / 2,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  active: { backgroundColor: '#B3262B' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#8F1D21' },
  text: { color: '#FFFFFF', fontWeight: '800', fontSize: Type.small + 1, letterSpacing: 0.5 },
});
