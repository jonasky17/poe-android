import React from 'react';
import { TouchableOpacity, StyleSheet, View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '@/context/DrawerContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DRAWER_WIDTH } from '@/components/drawer/constants';

export function HamburgerButton() {
  const { isOpen, toggleDrawer } = useDrawer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const translateX = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? DRAWER_WIDTH : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, translateX]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 12,
          transform: [{ translateX }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.tint,
          },
        ]}
        onPress={toggleDrawer}
        activeOpacity={0.7}
      >
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.line} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    width: 56,
    height: 56,
    zIndex: 101,
  },
  button: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  line: {
    width: 24,
    height: 2.5,
    backgroundColor: '#fff',
    marginVertical: 3.5,
    borderRadius: 1.5,
  },
});
