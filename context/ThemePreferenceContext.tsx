'use no memo';

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextType = {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextType>({
  preference: 'system',
  setPreference: () => {
    // No-op default for safety before provider mounts.
  },
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system');

  const value = useMemo(
    () => ({
      preference,
      setPreference,
    }),
    [preference]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
