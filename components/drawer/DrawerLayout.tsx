import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useDrawer } from '@/context/DrawerContext';
import { DRAWER_WIDTH } from '@/components/drawer/constants';

interface DrawerLayoutProps {
  children: React.ReactNode;
}

export function DrawerLayout({ children }: DrawerLayoutProps) {
  const { isOpen } = useDrawer();
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
          transform: [{ translateX }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
