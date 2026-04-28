import { Platform } from 'react-native';

const POE_NINJA_BASE = 'https://poe.ninja/poe1/api/economy/exchange';

// poe.ninja doesn't send CORS headers, so browser requests fail.
// On web we route through a proxy; on native fetch works directly.
const CORS_PROXY = 'https://corsproxy.io/?url=';

// Current league — update when a new league starts.
export const CURRENT_LEAGUE = 'Mirage';

function proxied(url: string): string {
  return Platform.OS === 'web' ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;
}

export interface CurrencyRate {
  currencyTypeName: string;
  chaosEquivalent?: number;
  pay?: { value: number };
  receive?: { value: number };
}

interface CurrencyHistoryPoint {
  timestamp: string;
  rate: number;
}

export interface DivineHistoryPoint {
  timestamp: string;
  rate: number;
  volumePrimaryValue?: number;
}

interface CurrencyPair {
  id: string;
  rate?: number;
  history?: CurrencyHistoryPoint[];
}

interface DivineDetailsResponse {
  pairs?: CurrencyPair[];
}

/** Returns the Divine Orb → Chaos Orb exchange rate for the current league */
export async function fetchDivineChaosRate(league: string): Promise<{
  rate: number;
  trend24h: number | null;
  history: DivineHistoryPoint[];
}> {
  const url = `${POE_NINJA_BASE}/current/details?league=${encodeURIComponent(league)}&type=Currency&id=divine-orb`;
  const res = await fetch(proxied(url));
  if (!res.ok) throw new Error(`poe.ninja currency: ${res.status}`);
  const data: DivineDetailsResponse = await res.json();
  const chaosPair = data.pairs?.find((pair) => pair.id === 'chaos');
  const rate = chaosPair?.rate ?? 0;
  const history = chaosPair?.history ?? [];
  const latestHistory = chaosPair?.history?.[0]?.rate;
  const previousHistory = chaosPair?.history?.[1]?.rate;
  const trend24h = latestHistory !== undefined && previousHistory !== undefined
    ? latestHistory - previousHistory
    : null;

  return { rate, trend24h, history };
}
