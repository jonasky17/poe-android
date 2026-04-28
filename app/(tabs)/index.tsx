import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DrawerLayout } from '@/components/drawer/DrawerLayout';
import { getSemanticTheme } from '@/constants/semantic-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';
import { usePoeData } from '@/hooks/use-poe-data';
import { CURRENT_LEAGUE } from '@/services/poeApi';
import { useDrawer } from '@/context/DrawerContext';

const PRESET_LEAGUES = [CURRENT_LEAGUE, 'Standard', 'Hardcore', `SSF ${CURRENT_LEAGUE}`];
const CHART_HEIGHT = 208;
const Y_AXIS_WIDTH = 38;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 18;
const CHART_DRAW_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
const GRID_ROWS = 5;

function formatCompactVolume(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return `${Math.round(value)}`;
}

function formatDayLabel(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useColorScheme() ?? 'light';
  const semantic = getSemanticTheme(theme);
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const [leagueInput, setLeagueInput] = useState(CURRENT_LEAGUE);
  const [selectedLeague, setSelectedLeague] = useState(CURRENT_LEAGUE);
  const { league, divineChaosRate, divineChaosTrend24h, divineChaosHistory, loading, error, refresh } = usePoeData(selectedLeague);
  const trendLabel = divineChaosTrend24h === null
    ? 'N/A'
    : `${divineChaosTrend24h > 0 ? '+' : ''}${divineChaosTrend24h.toFixed(1)}c`;
  const chartPoints = divineChaosHistory.slice(0, 14).reverse();
  const chartRates = chartPoints.map((point) => point.rate);
  const minRate = chartRates.length > 0 ? Math.min(...chartRates) : 0;
  const maxRate = chartRates.length > 0 ? Math.max(...chartRates) : 0;
  const rateSpread = Math.max(maxRate - minRate, 1);
  const chartWidth = Math.max(280, Math.min(windowWidth - 84, 460));
  const chartInnerWidth = chartWidth - Y_AXIS_WIDTH;
  const chartVolumes = chartPoints.map((point) => point.volumePrimaryValue ?? 0);
  const maxVolume = chartVolumes.length > 0 ? Math.max(...chartVolumes) : 1;
  const chartData = chartPoints.map((point, index) => {
    const x = chartPoints.length > 1
      ? Y_AXIS_WIDTH + (index / (chartPoints.length - 1)) * chartInnerWidth
      : Y_AXIS_WIDTH + chartInnerWidth / 2;
    const y = CHART_PADDING_TOP + (1 - ((point.rate - minRate) / rateSpread)) * CHART_DRAW_HEIGHT;
    const volumeHeight = maxVolume > 0 ? Math.max(10, (point.volumePrimaryValue ?? 0) / maxVolume * 34) : 10;
    const showXAxisLabel = index === 0 || index === chartPoints.length - 1 || index % 3 === 0;
    const showVolumeLabel = index === 0 || index === chartPoints.length - 1 || index === Math.floor(chartPoints.length / 2);

    return {
      x,
      y,
      label: formatDayLabel(point.timestamp),
      rateLabel: Math.round(point.rate),
      volumeLabel: formatCompactVolume(point.volumePrimaryValue ?? 0),
      volumeHeight,
      volumePrimaryValue: point.volumePrimaryValue ?? 0,
      showXAxisLabel,
      showVolumeLabel,
    };
  });
  const linePath = buildLinePath(chartData.map(({ x, y }) => ({ x, y })));
  const areaPath = chartData.length > 0
    ? `${linePath} L ${chartData[chartData.length - 1].x} ${CHART_HEIGHT - CHART_PADDING_BOTTOM} L ${chartData[0].x} ${CHART_HEIGHT - CHART_PADDING_BOTTOM} Z`
    : '';
  const yAxisTicks = Array.from({ length: GRID_ROWS + 1 }, (_, index) => {
    const ratio = index / GRID_ROWS;
    const value = maxRate - ratio * rateSpread;
    const y = CHART_PADDING_TOP + ratio * CHART_DRAW_HEIGHT;

    return {
      key: `tick-${index}`,
      value,
      y,
    };
  });

  return (
    <DrawerLayout>
      <View style={{ flex: 1 }}>
        <View
          style={[
            styles.appHeader,
            {
              paddingTop: insets.top + 8,
              backgroundColor: semantic.headerBackground,
              borderBottomColor: semantic.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={toggleDrawer}
            style={styles.headerHamburger}
            accessibilityLabel="Open menu"
            activeOpacity={0.7}
          >
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { fontFamily: Fonts.rounded }]} numberOfLines={1}>
            Atlas Currency Dashboard
          </ThemedText>
          <TouchableOpacity onPress={refresh} style={styles.refreshBtn} accessibilityLabel="Refresh live data">
            <MaterialIcons name="refresh" size={20} color={semantic.accent} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
        <ThemedView
          style={[
            styles.heroCard,
            {
              backgroundColor: semantic.panelBackground,
              borderColor: semantic.border,
            },
          ]}>
          <ThemedText style={[styles.heroSubtitle, { color: semantic.textMuted }]}>
            {loading ? 'Fetching league data…' : error ? 'Live data unavailable' : `League: ${league}`}
          </ThemedText>

          <View style={styles.leagueControlRow}>
            <TextInput
              value={leagueInput}
              onChangeText={setLeagueInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter league"
              placeholderTextColor={semantic.textMuted}
              style={[
                styles.leagueInput,
                {
                  backgroundColor: semantic.background,
                  borderColor: semantic.border,
                  color: semantic.textPrimary,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => setSelectedLeague(leagueInput.trim() || CURRENT_LEAGUE)}
              style={[styles.leagueApplyButton, { backgroundColor: semantic.accent }]}
              accessibilityLabel="Apply league">
              <ThemedText style={styles.leagueApplyButtonText}>Apply</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.presetLeagueRow}>
            {PRESET_LEAGUES.map((presetLeague) => {
              const isActive = selectedLeague === presetLeague;

              return (
                <TouchableOpacity
                  key={presetLeague}
                  onPress={() => {
                    setLeagueInput(presetLeague);
                    setSelectedLeague(presetLeague);
                  }}
                  style={[
                    styles.presetLeagueChip,
                    {
                      backgroundColor: isActive ? semantic.accent : semantic.background,
                      borderColor: isActive ? semantic.accent : semantic.border,
                    },
                  ]}
                  accessibilityLabel={`Use ${presetLeague} league`}>
                  <ThemedText
                    style={{ color: isActive ? '#FFFFFF' : semantic.textMuted }}>
                    {presetLeague}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statCard, { borderColor: semantic.border }]}> 
              <ThemedText style={[styles.statLabel, { color: semantic.textMuted }]}>1 Divine</ThemedText>
              {loading
                ? <ActivityIndicator size="small" color={semantic.accent} />
                : <ThemedText style={[styles.statValue, { color: semantic.accent }]}>
                    {divineChaosRate ? `${Math.round(divineChaosRate)}c` : 'N/A'}
                  </ThemedText>
              }
            </View>
            <View style={[styles.statCard, { borderColor: semantic.border }]}> 
              <ThemedText style={[styles.statLabel, { color: semantic.textMuted }]}>24h Trend</ThemedText>
              {loading
                ? <ActivityIndicator size="small" color={semantic.accent} />
                : <ThemedText
                    style={[
                      styles.statValue,
                      divineChaosTrend24h !== null
                        ? { color: divineChaosTrend24h >= 0 ? '#73C991' : '#F14C4C' }
                        : null,
                    ]}>
                    {trendLabel}
                  </ThemedText>
              }
            </View>
            <View style={[styles.statCard, { borderColor: semantic.border }]}> 
              <ThemedText style={[styles.statLabel, { color: semantic.textMuted }]}>Active League</ThemedText>
              <ThemedText numberOfLines={1} style={styles.statValue}>{league}</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView
          style={[
            styles.chartCard,
            {
              backgroundColor: semantic.panelBackground,
              borderColor: semantic.border,
            },
          ]}>
          <View style={styles.chartHeader}>
            <ThemedText type="subtitle">Divine to Chaos History</ThemedText>
            <ThemedText style={{ color: semantic.textMuted }}>Last {chartPoints.length} days</ThemedText>
          </View>

          {loading ? (
            <View style={styles.chartLoadingState}>
              <ActivityIndicator size="small" color={semantic.accent} />
            </View>
          ) : error ? (
            <ThemedText style={{ color: semantic.textMuted }}>{error}</ThemedText>
          ) : chartPoints.length === 0 ? (
            <ThemedText style={{ color: semantic.textMuted }}>No chart data available.</ThemedText>
          ) : (
            <>
              <View style={[styles.chartStage, { borderColor: semantic.border, backgroundColor: semantic.background }]}>
                {yAxisTicks.map((tick) => (
                  <View key={tick.key} style={[styles.gridRow, { top: tick.y }]}> 
                    <ThemedText style={[styles.yAxisLabel, { color: semantic.textMuted }]}>
                      {tick.value.toFixed(0)}
                    </ThemedText>
                    <View style={[styles.gridLine, { borderColor: semantic.border }]} />
                  </View>
                ))}

                {chartData.map((point) => (
                  <View key={`x-${point.label}-${point.x}`} style={[styles.xAxisTick, { left: point.x - 1 }]}> 
                    <View style={[styles.xAxisTickLine, { backgroundColor: semantic.border }]} />
                  </View>
                ))}

                <View style={[styles.chartSvgFrame, { height: CHART_HEIGHT }] }>
                  <Svg viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width="100%" height="100%">
                    <Defs>
                      <LinearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={semantic.accent} stopOpacity={0.28} />
                        <Stop offset="100%" stopColor={semantic.accent} stopOpacity={0.02} />
                      </LinearGradient>
                    </Defs>
                    <Path d={areaPath} fill="url(#priceFill)" />
                    <Path d={linePath} fill="none" stroke={semantic.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                    {chartData.map((point, index) => (
                      <G key={`dot-${point.label}-${index}`}>
                        <Circle cx={point.x} cy={point.y} r={4.5} fill={semantic.accent} />
                        <Circle cx={point.x} cy={point.y} r={8} fill={semantic.accent} fillOpacity={0.15} />
                      </G>
                    ))}
                  </Svg>
                </View>

                {chartData.map((point, index) => {
                  const isLatest = index === chartData.length - 1;
                  const isEmphasis = index === chartData.length - 1 || index === Math.floor(chartData.length / 2) || index === 0;

                  return (
                    <View key={`label-${point.label}-${index}`} style={[styles.pointLabelWrap, { left: point.x - 16, top: point.y + 10 }]}> 
                      {isEmphasis ? (
                        <ThemedText style={[styles.pointLabel, { color: isLatest ? semantic.accent : semantic.textMuted }]}>
                          {point.rateLabel}
                        </ThemedText>
                      ) : null}
                    </View>
                  );
                })}

                <View style={styles.volumeBand}>
                  {chartData.map((point, index) => {
                    const isLatest = index === chartData.length - 1;

                    return (
                      <View key={`volume-${point.label}-${index}`} style={styles.volumeSlot}>
                        {point.showVolumeLabel ? (
                          <ThemedText style={[styles.volumeLabel, { color: semantic.textMuted }]}>
                            {point.volumeLabel}
                          </ThemedText>
                        ) : <View style={styles.volumeLabelSpacer} />}
                        <View
                          style={[
                            styles.volumeBar,
                            {
                              height: point.volumeHeight,
                              backgroundColor: isLatest ? semantic.accent : '#128C8A',
                            },
                          ]}
                        />
                        {point.showXAxisLabel ? (
                          <ThemedText style={[styles.xAxisLabel, { color: semantic.textMuted }]}>
                            {point.label}
                          </ThemedText>
                        ) : <View style={styles.xAxisLabelSpacer} />}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.chartFooter}>
                <ThemedText style={{ color: semantic.textMuted }}>
                  Low {minRate.toFixed(1)}c
                </ThemedText>
                <ThemedText style={{ color: semantic.textMuted }}>
                  High {maxRate.toFixed(1)}c
                </ThemedText>
              </View>
            </>
          )}
        </ThemedView>
      </ScrollView>
      </View>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerHamburger: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    backgroundColor: '#569CD6',
    borderRadius: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 4,
  },
  leagueControlRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  leagueInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leagueApplyButton: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  leagueApplyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetLeagueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetLeagueChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartLoadingState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartStage: {
    borderWidth: 1,
    borderRadius: 14,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  gridRow: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  yAxisLabel: {
    width: Y_AXIS_WIDTH - 4,
    fontSize: 11,
  },
  gridLine: {
    flex: 1,
    borderTopWidth: 1,
    opacity: 0.75,
  },
  chartSvgFrame: {
    width: '100%',
    zIndex: 3,
  },
  xAxisTick: {
    position: 'absolute',
    top: CHART_PADDING_TOP,
    bottom: 58,
    width: 2,
    zIndex: 0,
  },
  xAxisTickLine: {
    flex: 1,
    width: 1,
    opacity: 0.25,
  },
  pointLabelWrap: {
    position: 'absolute',
    width: 32,
    alignItems: 'center',
    zIndex: 4,
  },
  pointLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  volumeBand: {
    marginTop: -10,
    minHeight: 82,
    flexDirection: 'row',
    gap: 4,
    paddingLeft: Y_AXIS_WIDTH,
    zIndex: 4,
  },
  volumeSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  volumeLabel: {
    fontSize: 9,
    lineHeight: 11,
  },
  volumeLabelSpacer: {
    height: 11,
  },
  volumeBar: {
    width: '56%',
    borderRadius: 999,
    minHeight: 10,
  },
  xAxisLabel: {
    fontSize: 9,
    lineHeight: 11,
  },
  xAxisLabelSpacer: {
    height: 11,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
});
