import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useColorScheme() ?? 'light';
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? [styles.default, { fontFamily: Fonts.sans }] : undefined,
        type === 'title' ? [styles.title, { fontFamily: Fonts.sans }] : undefined,
        type === 'defaultSemiBold' ? [styles.defaultSemiBold, { fontFamily: Fonts.sans }] : undefined,
        type === 'subtitle' ? [styles.subtitle, { fontFamily: Fonts.sans }] : undefined,
        type === 'link' ? [styles.link, { color: Colors[theme].tint, fontFamily: Fonts.sans }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
