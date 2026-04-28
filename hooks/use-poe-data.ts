import { useEffect, useState } from 'react';
import { CURRENT_LEAGUE, DivineHistoryPoint, fetchDivineChaosRate } from '@/services/poeApi';

export interface PoeData {
  league: string;
  divineChaosRate: number | null;
  divineChaosTrend24h: number | null;
  divineChaosHistory: DivineHistoryPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePoeData(league: string = CURRENT_LEAGUE): PoeData {
  const [divineChaosRate, setDivineChaosRate] = useState<number | null>(null);
  const [divineChaosTrend24h, setDivineChaosTrend24h] = useState<number | null>(null);
  const [divineChaosHistory, setDivineChaosHistory] = useState<DivineHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDivineChaosHistory([]);

    (async () => {
      try {
        const { rate, trend24h, history } = await fetchDivineChaosRate(league);
        if (cancelled) return;
        setDivineChaosRate(rate);
        setDivineChaosTrend24h(trend24h);
        setDivineChaosHistory(history);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load PoE data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [league, tick]);

  return {
    league,
    divineChaosRate,
    divineChaosTrend24h,
    divineChaosHistory,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
