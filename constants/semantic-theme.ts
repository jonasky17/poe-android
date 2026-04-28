import { Colors } from '@/constants/theme';

export type ThemeName = 'light' | 'dark';

export type SemanticTheme = {
  screenBackground: string;
  panelBackground: string;
  sidebarBackground: string;
  headerBackground: string;
  headerIcon: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  accent: string;
  overlay: string;
};

export function getSemanticTheme(theme: ThemeName): SemanticTheme {
  const palette = Colors[theme];

  return {
    screenBackground: palette.background,
    panelBackground: palette.panel,
    sidebarBackground: palette.sidebar,
    headerBackground: palette.panel,
    headerIcon: palette.icon,
    textPrimary: palette.text,
    textMuted: palette.textMuted,
    border: palette.border,
    accent: palette.tint,
    overlay: theme === 'dark' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.35)',
  };
}

export const semanticHeaderBackground = {
  light: getSemanticTheme('light').headerBackground,
  dark: getSemanticTheme('dark').headerBackground,
};
