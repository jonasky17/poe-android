'use no memo';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import 'react-native-reanimated';

import { Drawer } from '@/components/drawer/Drawer';
import { Colors } from '@/constants/theme';
import { DrawerProvider } from '@/context/DrawerContext';
import { ThemePreferenceProvider } from '@/context/ThemePreferenceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppShell() {
  const scheme = useColorScheme() ?? 'light';
  const appColors = Colors[scheme];

  const navigationTheme = scheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: appColors.background,
          card: appColors.panel,
          text: appColors.text,
          border: appColors.border,
          primary: appColors.tint,
          notification: appColors.tint,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: appColors.background,
          card: appColors.panel,
          text: appColors.text,
          border: appColors.border,
          primary: appColors.tint,
          notification: appColors.tint,
        },
      };

  return (
    <DrawerProvider>
      <ThemeProvider value={navigationTheme}>
        <View style={{ flex: 1, backgroundColor: appColors.background }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <Drawer />
        </View>
      </ThemeProvider>
    </DrawerProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <AppShell />
    </ThemePreferenceProvider>
  );
}
