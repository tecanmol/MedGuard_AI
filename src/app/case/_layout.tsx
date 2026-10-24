import { useTheme } from '@/hooks/use-theme';
import { Stack } from 'expo-router';

export default function CaseLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background || '#FFFFFF' },
        headerTintColor: theme.text || '#000000',
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="metadata" options={{ headerShown: false }} />
      <Stack.Screen name="capture" options={{ headerShown: false }} />
      <Stack.Screen 
        name="analysis" 
        options={{ 
          title: 'Analysis Processing', 
          gestureEnabled: false,
          headerBackVisible: false, 
        }} 
      />
      <Stack.Screen name="result" options={{ headerShown: false }} />
      <Stack.Screen name="agents" options={{ headerShown: false }} />
      <Stack.Screen name="guidance" options={{ title: 'Care Guidance' }} />
      <Stack.Screen name="referral" options={{ headerShown: false }} />
      <Stack.Screen name="summary" options={{ title: 'Case Summary' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}


