import { DRAWER_WIDTH } from '@/components/drawer/constants';
import { getSemanticTheme } from '@/constants/semantic-theme';
import { Fonts } from '@/constants/theme';
import { useDrawer } from '@/context/DrawerContext';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Drawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const semantic = getSemanticTheme(colorScheme ?? 'light');
  const { preference, setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();

  const cycleTheme = () => {
    if (preference === 'system') {
      setPreference('light');
      return;
    }

    if (preference === 'light') {
      setPreference('dark');
      return;
    }

    setPreference('system');
  };

  const themeLabel = preference === 'system' ? 'System' : preference === 'light' ? 'Light' : 'Dark';
  const themeIcon = preference === 'system' ? 'settings-brightness' : preference === 'light' ? 'light-mode' : 'dark-mode';

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: semantic.overlay }]}
        onPress={closeDrawer}
        activeOpacity={1}
      />

      {/* Drawer */}
      <View
        style={[
          styles.drawer,
          {
            backgroundColor: semantic.sidebarBackground,
            borderRightColor: semantic.border,
          },
        ]}
      >
        <View
          style={[
            styles.drawerContent,
            {
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          <Text style={[styles.drawerTitle, { color: semantic.textPrimary, fontFamily: Fonts.sans }]}>Menu</Text>

          <ScrollView
            style={styles.menuList}
            contentContainerStyle={styles.menuListContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={[
                styles.drawerItem,
                { borderBottomColor: semantic.border },
                (pathname === '/' || pathname === '/index') && { backgroundColor: semantic.accent + '22' },
              ]}
              onPress={() => { router.push('/(tabs)'); closeDrawer(); }}
            >
              <Text style={[
                styles.drawerItemText,
                { color: semantic.textPrimary, fontFamily: Fonts.sans },
                (pathname === '/' || pathname === '/index') && { color: semantic.accent, fontWeight: '700' },
              ]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.drawerItem,
                { borderBottomColor: semantic.border },
                pathname === '/betrayal' && { backgroundColor: semantic.accent + '22' },
              ]}
              onPress={() => { router.push('/(tabs)/betrayal'); closeDrawer(); }}
            >
              <Text style={[
                styles.drawerItemText,
                { color: semantic.textPrimary, fontFamily: Fonts.sans },
                pathname === '/betrayal' && { color: semantic.accent, fontWeight: '700' },
              ]}>Betrayal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.drawerItem,
                { borderBottomColor: semantic.border },
                pathname === '/profit-calculator' && { backgroundColor: semantic.accent + '22' },
              ]}
              onPress={() => { router.push('/(tabs)/profit-calculator'); closeDrawer(); }}
            >
              <Text style={[
                styles.drawerItemText,
                { color: semantic.textPrimary, fontFamily: Fonts.sans },
                pathname === '/profit-calculator' && { color: semantic.accent, fontWeight: '700' },
              ]}>Profit Calculator</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.themeItem,
              {
                 borderTopColor: semantic.border,
              },
            ]}
            onPress={cycleTheme}
          >
            <View style={styles.themeRow}>
              <View style={styles.themeLabelRow}>
                <MaterialIcons name="palette" size={16} color={semantic.textMuted} />
                <Text style={[styles.themeLabel, { color: semantic.textMuted, fontFamily: Fonts.sans }]}>Theme</Text>
              </View>
              <View style={styles.themeValueRow}>
                <MaterialIcons name={themeIcon} size={18} color={semantic.accent} />
                <Text style={[styles.themeValue, { color: semantic.accent, fontFamily: Fonts.sans }]}>{themeLabel}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    zIndex: 100,
    borderRightWidth: 1,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 0,
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingBottom: 8,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  themeItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeLabel: {
    fontSize: 12,
  },
  themeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  drawerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
