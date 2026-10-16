import { Tabs } from 'expo-router';
import { LuMap, LuSettings } from 'react-icons/lu';

import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * JS tabs on every platform so the tab icons come from the same icon set as the rest of the app
 * (native tabs only accept system symbols).
 */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontSize: Type.tiny, fontWeight: '600' },
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Map', tabBarIcon: ({ color }) => <Icon icon={LuMap} size={20} color={color as string} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <Icon icon={LuSettings} size={20} color={color as string} /> }}
      />
    </Tabs>
  );
}
