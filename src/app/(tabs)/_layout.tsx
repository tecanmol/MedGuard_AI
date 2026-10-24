import { t } from '@/constants/i18n';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const theme = useTheme();
  const { language, pendingSyncCount } = useApp();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { 
        backgroundColor: theme.background, 
        borderTopWidth: 0,
        borderTopColor: 'transparent',
        elevation: 0,
        shadowOpacity: 0,
        height: 60,
        paddingBottom: 8,
      },
      tabBarActiveTintColor: theme.primary,
      tabBarInactiveTintColor: theme.textTertiary,
    }}>
      <Tabs.Screen name="index" options={{
        title: t(language, 'tabs', 'dashboard') || 'Dashboard',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size || 24} color={color} />
      }} />
      <Tabs.Screen name="history" options={{
        title: t(language, 'tabs', 'history') || 'History',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="history" size={size || 24} color={color} />
      }} />
      <Tabs.Screen name="sync" options={{
        title: t(language, 'tabs', 'sync') || 'Sync',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="sync" size={size || 24} color={color} />,
        tabBarBadge: pendingSyncCount > 0 ? pendingSyncCount : undefined,
        tabBarBadgeStyle: { backgroundColor: theme.primary }
      }} />
      <Tabs.Screen name="settings" options={{
        title: t(language, 'tabs', 'settings') || 'Settings',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size || 24} color={color} />
      }} />
    </Tabs>
  );
}

