import { DrawerLayout } from '@/components/drawer/DrawerLayout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSemanticTheme } from '@/constants/semantic-theme';
import { Fonts } from '@/constants/theme';
import { useDrawer } from '@/context/DrawerContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Placement = 'none' | 'row' | 'column';
type Relationship = 'trusted' | 'neutral' | 'rival';
const MAX_COLUMNS = 4;
const BETRAYAL_MATRIX_STORAGE_KEY = 'betrayal-matrix-json';

interface PersistedBetrayalState {
  placements?: Record<string, Placement>;
  cellRelations?: Record<string, Relationship>;
}

const SYNDICATE_MEMBERS = [
  'Aisling',
  'Cameria',
  'Elreon',
  'Guff',
  'Gravicius',
  'Haku',
  'Hillock',
  'It That Fled',
  'Janus Perandus',
  'Jorgin',
  'Korell',
  'Leo',
  'Riker Maloney',
  'Rin Yuushu',
  'Tora',
  'Vagan',
  'Vorici',
] as const;

const INITIAL_PLACEMENTS: Record<string, Placement> = Object.fromEntries(
  SYNDICATE_MEMBERS.map((member) => [member, 'none']),
) as Record<string, Placement>;

export default function BetrayalScreen() {
  const theme = useColorScheme() ?? 'light';
  const semantic = getSemanticTheme(theme);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { toggleDrawer } = useDrawer();
  const [placements, setPlacements] = useState<Record<string, Placement>>(INITIAL_PLACEMENTS);
  const [cellRelations, setCellRelations] = useState<Record<string, Relationship>>({});
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const rowMembers = useMemo(
    () => SYNDICATE_MEMBERS.filter((member) => placements[member] === 'row'),
    [placements],
  );
  const columnMembers = useMemo(
    () => SYNDICATE_MEMBERS.filter((member) => placements[member] === 'column'),
    [placements],
  );
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return SYNDICATE_MEMBERS;
    }

    return SYNDICATE_MEMBERS.filter((member) => member.toLowerCase().includes(query));
  }, [memberSearch]);

  const assignPlacement = (member: string, placement: Placement) => {
    setPlacements((previous) => {
      const previousPlacement = previous[member];
      const selectedColumns = Object.values(previous).filter((value) => value === 'column').length;

      if (placement === 'column' && previousPlacement !== 'column' && selectedColumns >= MAX_COLUMNS) {
        return previous;
      }

      return {
        ...previous,
        [member]: placement,
      };
    });
  };

  const setCellRelation = (rowMember: string, columnMember: string, relation: Relationship) => {
    const key = `${rowMember}__${columnMember}`;
    setCellRelations((previous) => ({
      ...previous,
      [key]: relation,
    }));
  };

  const memberDrawerWidth = Math.max(280, Math.min(360, Math.round(windowWidth * 0.82)));

  const hasMatrixData = rowMembers.length > 0 && columnMembers.length > 0;

  const saveMatrixToJsonFile = async () => {
    const payload: PersistedBetrayalState = {
      placements,
      cellRelations,
    };
    const json = JSON.stringify(payload, null, 2);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(BETRAYAL_MATRIX_STORAGE_KEY, json);

          const blob = new Blob([json], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'betrayal-matrix.json';
          link.click();
          window.URL.revokeObjectURL(url);
        }

        setSaveStatus('Saved and downloaded matrix JSON.');
      } catch {
        setSaveStatus('Save failed.');
      }
      return;
    }

    try {
      await AsyncStorage.setItem(BETRAYAL_MATRIX_STORAGE_KEY, json);
      setSaveStatus('Saved matrix JSON.');
    } catch {
      setSaveStatus('Save failed.');
    }
  };

  const clearRelationships = () => {
    setCellRelations({});
    setSaveStatus('Relationships reset to Neutral.');
  };

  useEffect(() => {
    const loadPersistedState = async () => {
      if (Platform.OS === 'web') {
        try {
          if (typeof window === 'undefined') {
            return;
          }

          const raw = window.localStorage.getItem(BETRAYAL_MATRIX_STORAGE_KEY);
          if (!raw) {
            return;
          }

          const parsed = JSON.parse(raw) as PersistedBetrayalState;
          if (parsed.placements) {
            setPlacements((previous) => ({
              ...previous,
              ...parsed.placements,
            }));
          }

          if (parsed.cellRelations) {
            setCellRelations(parsed.cellRelations);
          }
        } catch {
          setSaveStatus('Could not load saved matrix JSON.');
        }
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(BETRAYAL_MATRIX_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as PersistedBetrayalState;

        if (parsed.placements) {
          setPlacements((previous) => ({
            ...previous,
            ...parsed.placements,
          }));
        }

        if (parsed.cellRelations) {
          setCellRelations(parsed.cellRelations);
        }
      } catch {
        setSaveStatus('Could not load saved matrix JSON.');
      }
    };

    loadPersistedState();
  }, []);

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
            <View style={[styles.menuLine, { backgroundColor: semantic.accent }]} />
            <View style={[styles.menuLine, { backgroundColor: semantic.accent }]} />
            <View style={[styles.menuLine, { backgroundColor: semantic.accent }]} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { fontFamily: Fonts.rounded }]} numberOfLines={1}>
            Syndicate Matrix
          </ThemedText>
          <TouchableOpacity
            onPress={() => setIsMemberDrawerOpen(true)}
            style={[styles.memberDrawerTrigger, { borderColor: semantic.border }]}
            accessibilityLabel="Open member selector"
            activeOpacity={0.7}
          >
            <MaterialIcons name="table-rows" size={17} color={semantic.accent} />
            <ThemedText style={[styles.memberDrawerTriggerText, { color: semantic.textPrimary }]}>Members</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedView style={[styles.content, { backgroundColor: semantic.background }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedView
              style={[
                styles.summaryCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText style={[styles.summaryTitle, { color: semantic.textPrimary }]}>Selection Summary</ThemedText>
              <ThemedText style={[styles.summaryText, { color: semantic.textMuted }]}>Rows: {rowMembers.length}</ThemedText>
              <ThemedText style={[styles.summaryText, { color: semantic.textMuted }]}>Col: {columnMembers.length}/{MAX_COLUMNS}</ThemedText>
              <ThemedText style={[styles.summaryText, { color: semantic.textMuted }]}>Use the Members drawer to assign each member to Row or Column.</ThemedText>
              <View style={styles.summaryActionsRow}>
                <TouchableOpacity
                  onPress={saveMatrixToJsonFile}
                  style={[
                    styles.summaryActionButton,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.background,
                    },
                  ]}
                >
                  <MaterialIcons name="save" size={16} color={semantic.accent} />
                  <ThemedText style={[styles.summaryActionButtonText, { color: semantic.textPrimary }]}>Save</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={clearRelationships}
                  style={[
                    styles.summaryActionButton,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.background,
                    },
                  ]}
                >
                  <MaterialIcons name="clear-all" size={16} color={semantic.textMuted} />
                  <ThemedText style={[styles.summaryActionButtonText, { color: semantic.textPrimary }]}>Clear Relationship</ThemedText>
                </TouchableOpacity>
              </View>
              {saveStatus ? (
                <ThemedText style={[styles.summaryStatus, { color: semantic.textMuted }]}>{saveStatus}</ThemedText>
              ) : null}
            </ThemedView>

            <ThemedView
              style={[
                styles.matrixCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText style={[styles.sectionTitle, { color: semantic.textPrimary }]}>Dynamic Matrix</ThemedText>

              {!hasMatrixData && (
                <ThemedText style={[styles.emptyState, { color: semantic.textMuted }]}>Pick at least one Row member and one Column member from the Members drawer.</ThemedText>
              )}

              {hasMatrixData && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matrixScrollContent}>
                  <View style={[styles.matrixTable, { borderColor: semantic.border }]}> 
                    <View style={[styles.matrixHeaderRow, { borderBottomColor: semantic.border }]}> 
                      <View style={[styles.cornerCell, { borderRightColor: semantic.border, backgroundColor: semantic.background }]} />
                      {columnMembers.map((member) => (
                        <View key={`col-${member}`} style={[styles.columnHeaderCell, { borderRightColor: semantic.border, backgroundColor: semantic.background }]}>
                          <ThemedText style={[styles.columnHeaderText, { color: semantic.textPrimary }]} numberOfLines={1}>{member}</ThemedText>
                        </View>
                      ))}
                    </View>

                    {rowMembers.map((rowMember, rowIndex) => (
                      <View
                        key={`row-${rowMember}`}
                        style={[
                          styles.matrixBodyRow,
                          { borderBottomColor: rowIndex === rowMembers.length - 1 ? 'transparent' : semantic.border },
                        ]}
                      >
                        <View style={[styles.rowHeaderCell, { borderRightColor: semantic.border, backgroundColor: semantic.background }]}>
                          <ThemedText style={[styles.rowHeaderText, { color: semantic.textPrimary }]} numberOfLines={1}>{rowMember}</ThemedText>
                        </View>
                        {columnMembers.map((columnMember) => {
                          const cellKey = `${rowMember}__${columnMember}`;
                          const relation = cellRelations[cellKey] ?? 'neutral';
                          const cellBackgroundColor = relation === 'trusted'
                            ? '#73C9912B'
                            : relation === 'rival'
                              ? '#F14C4C2B'
                              : semantic.background;

                          return (
                            <View
                              key={`${rowMember}-${columnMember}`}
                              style={[
                                styles.matrixCell,
                                {
                                  borderRightColor: semantic.border,
                                  backgroundColor: cellBackgroundColor,
                                },
                              ]}
                            >
                              <View style={[styles.matrixSegmentGroup, { borderColor: semantic.border }]}>
                                <TouchableOpacity
                                  onPress={() => setCellRelation(rowMember, columnMember, 'trusted')}
                                  style={[
                                    styles.matrixSegmentButton,
                                    relation === 'trusted' && { backgroundColor: '#73C99133' },
                                  ]}
                                >
                                  <ThemedText
                                    style={[
                                      styles.matrixSegmentLabel,
                                      { color: semantic.textMuted },
                                      relation === 'trusted' && { color: '#73C991', fontWeight: '700' },
                                    ]}
                                  >
                                    Trusted
                                  </ThemedText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => setCellRelation(rowMember, columnMember, 'neutral')}
                                  style={[
                                    styles.matrixSegmentButton,
                                    relation === 'neutral' && { backgroundColor: semantic.background },
                                  ]}
                                >
                                  <ThemedText
                                    style={[
                                      styles.matrixSegmentLabel,
                                      { color: semantic.textMuted },
                                      relation === 'neutral' && { color: semantic.textPrimary, fontWeight: '700' },
                                    ]}
                                  >
                                    Neutral
                                  </ThemedText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => setCellRelation(rowMember, columnMember, 'rival')}
                                  style={[
                                    styles.matrixSegmentButton,
                                    relation === 'rival' && { backgroundColor: '#F14C4C33' },
                                  ]}
                                >
                                  <ThemedText
                                    style={[
                                      styles.matrixSegmentLabel,
                                      { color: semantic.textMuted },
                                      relation === 'rival' && { color: '#F14C4C', fontWeight: '700' },
                                    ]}
                                  >
                                    Rival
                                  </ThemedText>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </ThemedView>
          </ScrollView>
        </ThemedView>

        {isMemberDrawerOpen && (
          <>
            <TouchableOpacity
              style={[styles.memberDrawerOverlay, { backgroundColor: semantic.overlay }]}
              onPress={() => setIsMemberDrawerOpen(false)}
              activeOpacity={1}
            />
            <View
              style={[
                styles.memberDrawer,
                {
                  width: memberDrawerWidth,
                  backgroundColor: semantic.sidebarBackground,
                  borderLeftColor: semantic.border,
                  paddingTop: insets.top + 10,
                  paddingBottom: insets.bottom + 10,
                },
              ]}
            >
              <View style={[styles.memberDrawerHeader, { borderBottomColor: semantic.border }]}> 
                <ThemedText style={[styles.memberDrawerTitle, { color: semantic.textPrimary }]}>Assign Members</ThemedText>
                <TouchableOpacity onPress={() => setIsMemberDrawerOpen(false)} accessibilityLabel="Close member selector">
                  <MaterialIcons name="close" size={22} color={semantic.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.memberDrawerList} showsVerticalScrollIndicator={false}>
                <View style={styles.memberSearchWrap}>
                  <TextInput
                    value={memberSearch}
                    onChangeText={setMemberSearch}
                    placeholder="Search members"
                    placeholderTextColor={semantic.textMuted}
                    style={[
                      styles.memberSearchInput,
                      {
                        borderColor: semantic.border,
                        backgroundColor: semantic.background,
                        color: semantic.textPrimary,
                      },
                    ]}
                  />
                </View>
                {filteredMembers.map((member) => {
                  const placement = placements[member];
                  const isColDisabled = placement !== 'column' && columnMembers.length >= MAX_COLUMNS;

                  return (
                    <View key={member} style={[styles.memberRow, { borderBottomColor: semantic.border }]}> 
                      <ThemedText style={[styles.memberName, { color: semantic.textPrimary }]} numberOfLines={1}>{member}</ThemedText>
                      <View style={styles.memberActionRow}> 
                        <TouchableOpacity
                          onPress={() => assignPlacement(member, 'row')}
                          style={[
                            styles.memberActionButton,
                            { borderColor: semantic.border },
                            placement === 'row' && { backgroundColor: semantic.accent + '26', borderColor: semantic.accent + '55' },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.memberActionLabel,
                              { color: semantic.textMuted },
                              placement === 'row' && { color: semantic.accent, fontWeight: '700' },
                            ]}
                          >
                            Row
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => assignPlacement(member, 'column')}
                          disabled={isColDisabled}
                          style={[
                            styles.memberActionButton,
                            { borderColor: semantic.border },
                            isColDisabled && { opacity: 0.45 },
                            placement === 'column' && { backgroundColor: '#4EC9B026', borderColor: '#4EC9B066' },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.memberActionLabel,
                              { color: semantic.textMuted },
                              placement === 'column' && { color: '#4EC9B0', fontWeight: '700' },
                            ]}
                          >
                            Col
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => assignPlacement(member, 'none')}
                          style={[
                            styles.memberActionButton,
                            { borderColor: semantic.border },
                            placement === 'none' && { backgroundColor: semantic.background },
                          ]}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={placement === 'none' ? semantic.textPrimary : semantic.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  memberDrawerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  memberDrawerTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  summaryActionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryStatus: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
  },
  matrixCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyState: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  matrixScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  matrixTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  matrixBodyRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cornerCell: {
    width: 134,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  columnHeaderCell: {
    width: 132,
    minHeight: 42,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  columnHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  rowHeaderCell: {
    width: 134,
    minHeight: 46,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  rowHeaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  matrixCell: {
    width: 132,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  matrixSegmentGroup: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  matrixSegmentButton: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixSegmentLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  memberDrawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 250,
  },
  memberDrawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    zIndex: 260,
    borderLeftWidth: 1,
  },
  memberDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  memberDrawerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  memberDrawerList: {
    flex: 1,
  },
  memberSearchWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  memberSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  memberRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  memberActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  memberActionButton: {
    minWidth: 46,
    height: 32,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
