'use no memo';

import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from '@/context/ThemePreferenceContext';

export function useColorScheme() {
	const systemScheme = useRNColorScheme() ?? 'light';
	const { preference } = useThemePreference();

	if (preference === 'system') {
		return systemScheme;
	}

	return preference;
}
