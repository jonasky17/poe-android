import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from '@/context/ThemePreferenceContext';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  const { preference } = useThemePreference();
  const systemScheme = hasHydrated ? colorScheme ?? 'light' : 'light';

  if (preference === 'system') {
    return systemScheme;
  }

  return preference;
}
