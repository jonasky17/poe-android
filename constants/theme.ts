/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#005FB8';
const tintColorDark = '#007ACC';

export const Colors = {
  light: {
    text: '#1F1F1F',
    textMuted: '#5C5C5C',
    background: '#FFFFFF',
    panel: '#F3F3F3',
    sidebar: '#EDEDED',
    border: '#D4D4D4',
    tint: tintColorLight,
    icon: '#424242',
    tabIconDefault: '#424242',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#CCCCCC',
    textMuted: '#9D9D9D',
    background: '#1E1E1E',
    panel: '#252526',
    sidebar: '#333333',
    border: '#3C3C3C',
    tint: tintColorDark,
    icon: '#C5C5C5',
    tabIconDefault: '#C5C5C5',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Times New Roman',
    rounded: 'System',
    mono: 'Menlo',
  },
  android: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  web: {
    sans: "'Segoe UI', Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Segoe UI', Inter, sans-serif",
    mono: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, 'Courier New', monospace",
  },
});
