import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DrawerLayout } from "@/components/drawer/DrawerLayout";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getSemanticTheme } from "@/constants/semantic-theme";
import { Fonts } from "@/constants/theme";
import { useDrawer } from "@/context/DrawerContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePoeData } from "@/hooks/use-poe-data";
import { CURRENT_LEAGUE } from "@/services/poeApi";

type Currency = "divine" | "chaos";

type InvestmentEntry = {
  id: string;
  itemName: string;
  ratioItemAmount: string;
  ratioCostAmount: string;
  ratioCurrency: Currency;
  quantity: string;
};

type MapEntry = {
  id: string;
  mapName: string;
  completionMinutes: string;
  completionSeconds: string;
  quantity: string;
};

type ProfitCalculatorState = {
  additionalInvestmentChaos: string;
  sellValueChaos: string;
  feePercent: string;
  exchangeRateChaosPerDivine: string;
  useLiveRate: boolean;
  investments: InvestmentEntry[];
  loots: InvestmentEntry[];
  maps: MapEntry[];
};

type ComputedInvestmentRow = InvestmentEntry & {
  parsedRatioItemAmount: number;
  parsedRatioCostAmount: number;
  parsedQuantity: number;
  totalChaos: number;
  totalDiv: number;
};

type ComputedMapRow = MapEntry & {
  parsedCompletionMinutes: number;
  parsedCompletionSeconds: number;
  parsedQuantity: number;
  totalSeconds: number;
};

type SavedComputation = {
  id: string;
  name: string;
  savedAt: string;
  state: ProfitCalculatorState;
};

type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration: number;
};

const STORAGE_KEY = "profit-calculator-state-v1";
const COMPUTATIONS_FILE_URI = `${FileSystem.documentDirectory ?? ""}profit-calculator-computations.json`;

const INITIAL_STATE: ProfitCalculatorState = {
  additionalInvestmentChaos: "",
  sellValueChaos: "",
  feePercent: "0",
  exchangeRateChaosPerDivine: "",
  useLiveRate: true,
  investments: [],
  loots: [],
  maps: [],
};

const EMPTY_INVESTMENT_ENTRY: Omit<InvestmentEntry, "id"> = {
  itemName: "",
  ratioItemAmount: "1",
  ratioCostAmount: "",
  ratioCurrency: "divine",
  quantity: "",
};

const EMPTY_MAP_ENTRY: Omit<MapEntry, "id"> = {
  mapName: "",
  completionMinutes: "",
  completionSeconds: "",
  quantity: "",
};

function toNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatChaos(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toFixed(2)}c`;
}

function formatDiv(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded.toFixed(3)} div`;
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function formatHmsFromSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function formatSavedDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const datePart = date.toLocaleDateString();
  const timePart = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export default function ProfitCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const semantic = getSemanticTheme(colorScheme);
  const { toggleDrawer } = useDrawer();
  const {
    divineChaosRate,
    loading: isRateLoading,
    error: rateError,
  } = usePoeData(CURRENT_LEAGUE);

  const [state, setState] = useState<ProfitCalculatorState>(INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState("");
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isLootModalOpen, setIsLootModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [draftInvestment, setDraftInvestment] = useState<
    Omit<InvestmentEntry, "id">
  >(EMPTY_INVESTMENT_ENTRY);
  const [draftLoot, setDraftLoot] = useState<Omit<InvestmentEntry, "id">>(
    EMPTY_INVESTMENT_ENTRY,
  );
  const [draftMap, setDraftMap] =
    useState<Omit<MapEntry, "id">>(EMPTY_MAP_ENTRY);
  const [savedComputations, setSavedComputations] = useState<
    SavedComputation[]
  >([]);
  const [draftComputationName, setDraftComputationName] = useState("");
  const [currentComputationName, setCurrentComputationName] = useState("");
  const [currentComputationId, setCurrentComputationId] = useState<
    string | null
  >(null);
  const [isLoadPickerModalOpen, setIsLoadPickerModalOpen] = useState(false);
  const [isCreateNameModalOpen, setIsCreateNameModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameComputationId, setRenameComputationId] = useState<string | null>(
    null,
  );
  const [renameComputationName, setRenameComputationName] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const additionalInvestment = toNumber(state.additionalInvestmentChaos);
  const chaosPerDivine = Math.max(
    0,
    toNumber(state.exchangeRateChaosPerDivine),
  );

  const investmentRows = useMemo<ComputedInvestmentRow[]>(() => {
    return state.investments.map((entry) => {
      const parsedRatioItemAmount = Math.max(
        0,
        toNumber(entry.ratioItemAmount),
      );
      const parsedRatioCostAmount = Math.max(
        0,
        toNumber(entry.ratioCostAmount),
      );
      const parsedQuantity = Math.max(0, toNumber(entry.quantity));
      const totalInRatioCurrency =
        parsedRatioItemAmount > 0
          ? (parsedQuantity / parsedRatioItemAmount) * parsedRatioCostAmount
          : 0;
      const totalChaos =
        entry.ratioCurrency === "divine"
          ? totalInRatioCurrency * chaosPerDivine
          : totalInRatioCurrency;
      const totalDiv =
        entry.ratioCurrency === "divine"
          ? totalInRatioCurrency
          : chaosPerDivine > 0
            ? totalInRatioCurrency / chaosPerDivine
            : 0;

      return {
        ...entry,
        parsedRatioItemAmount,
        parsedRatioCostAmount,
        parsedQuantity,
        totalChaos,
        totalDiv,
      };
    });
  }, [chaosPerDivine, state.investments]);

  const tableTotals = useMemo(() => {
    const totalChaos = investmentRows.reduce(
      (sum, entry) => sum + entry.totalChaos,
      0,
    );
    const totalDiv = investmentRows.reduce(
      (sum, entry) => sum + entry.totalDiv,
      0,
    );
    const totalQuantity = investmentRows.reduce(
      (sum, entry) => sum + entry.parsedQuantity,
      0,
    );

    return {
      totalChaos,
      totalDiv,
      totalQuantity,
    };
  }, [investmentRows]);

  const lootRows = useMemo<ComputedInvestmentRow[]>(() => {
    return state.loots.map((entry) => {
      const parsedRatioItemAmount = Math.max(
        0,
        toNumber(entry.ratioItemAmount),
      );
      const parsedRatioCostAmount = Math.max(
        0,
        toNumber(entry.ratioCostAmount),
      );
      const parsedQuantity = Math.max(0, toNumber(entry.quantity));
      const totalInRatioCurrency =
        parsedRatioItemAmount > 0
          ? (parsedQuantity / parsedRatioItemAmount) * parsedRatioCostAmount
          : 0;
      const totalChaos =
        entry.ratioCurrency === "divine"
          ? totalInRatioCurrency * chaosPerDivine
          : totalInRatioCurrency;
      const totalDiv =
        entry.ratioCurrency === "divine"
          ? totalInRatioCurrency
          : chaosPerDivine > 0
            ? totalInRatioCurrency / chaosPerDivine
            : 0;

      return {
        ...entry,
        parsedRatioItemAmount,
        parsedRatioCostAmount,
        parsedQuantity,
        totalChaos,
        totalDiv,
      };
    });
  }, [chaosPerDivine, state.loots]);

  const lootTotals = useMemo(() => {
    const totalChaos = lootRows.reduce(
      (sum, entry) => sum + entry.totalChaos,
      0,
    );
    const totalDiv = lootRows.reduce((sum, entry) => sum + entry.totalDiv, 0);
    const totalQuantity = lootRows.reduce(
      (sum, entry) => sum + entry.parsedQuantity,
      0,
    );

    return {
      totalChaos,
      totalDiv,
      totalQuantity,
    };
  }, [lootRows]);

  const mapRows = useMemo<ComputedMapRow[]>(() => {
    return state.maps.map((entry) => {
      const parsedCompletionMinutes = Math.max(
        0,
        Math.floor(toNumber(entry.completionMinutes)),
      );
      const parsedCompletionSeconds = Math.min(
        59,
        Math.max(0, Math.floor(toNumber(entry.completionSeconds))),
      );
      const parsedQuantity = Math.max(0, toNumber(entry.quantity));
      const totalSeconds =
        (parsedCompletionMinutes * 60 + parsedCompletionSeconds) *
        parsedQuantity;

      return {
        ...entry,
        parsedCompletionMinutes,
        parsedCompletionSeconds,
        parsedQuantity,
        totalSeconds,
      };
    });
  }, [state.maps]);

  const mapTotals = useMemo(() => {
    const totalSeconds = mapRows.reduce(
      (sum, entry) => sum + entry.totalSeconds,
      0,
    );
    const totalQuantity = mapRows.reduce(
      (sum, entry) => sum + entry.parsedQuantity,
      0,
    );

    return {
      totalSeconds,
      totalQuantity,
    };
  }, [mapRows]);

  const totalInvestmentChaos = tableTotals.totalChaos + additionalInvestment;
  const totalInvestmentDiv =
    tableTotals.totalDiv +
    (chaosPerDivine > 0 ? additionalInvestment / chaosPerDivine : 0);

  const calc = useMemo(() => {
    const totalLootChaos = lootTotals.totalChaos;
    const totalLootDiv = lootTotals.totalDiv;
    const profit = totalLootChaos - totalInvestmentChaos;
    const roi =
      totalInvestmentChaos > 0 ? (profit / totalInvestmentChaos) * 100 : 0;
    const profitInDivines = chaosPerDivine > 0 ? profit / chaosPerDivine : 0;

    return {
      totalLootChaos,
      totalLootDiv,
      profit,
      roi,
      profitInDivines,
    };
  }, [
    lootTotals.totalChaos,
    lootTotals.totalDiv,
    totalInvestmentChaos,
    chaosPerDivine,
  ]);

  const hasMapData = mapRows.length > 0;
  const profitPerHourChaos =
    mapTotals.totalSeconds > 0
      ? (calc.profit * 3600) / mapTotals.totalSeconds
      : 0;
  const profitPerHourDiv =
    chaosPerDivine > 0 ? profitPerHourChaos / chaosPerDivine : 0;

  useEffect(() => {
    if (!state.useLiveRate) {
      return;
    }

    if (!divineChaosRate || !Number.isFinite(divineChaosRate)) {
      return;
    }

    const liveRate = (Math.round(divineChaosRate * 100) / 100).toString();
    setState((previous) => {
      if (previous.exchangeRateChaosPerDivine === liveRate) {
        return previous;
      }

      return {
        ...previous,
        exchangeRateChaosPerDivine: liveRate,
      };
    });
  }, [divineChaosRate, state.useLiveRate]);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<ProfitCalculatorState>;
        const parsedInvestments = Array.isArray(parsed.investments)
          ? parsed.investments
          : [];
        const parsedLoots = Array.isArray(parsed.loots) ? parsed.loots : [];
        const parsedMaps = Array.isArray(parsed.maps) ? parsed.maps : [];

        const normalizedInvestments: InvestmentEntry[] = parsedInvestments.map(
          (entry) => {
            const maybeLegacy = entry as Partial<InvestmentEntry> & {
              ratioPerItem?: string;
            };

            return {
              id: maybeLegacy.id ?? `${Date.now()}-${Math.random()}`,
              itemName: maybeLegacy.itemName ?? "",
              ratioItemAmount: maybeLegacy.ratioItemAmount ?? "1",
              ratioCostAmount:
                maybeLegacy.ratioCostAmount ?? maybeLegacy.ratioPerItem ?? "",
              ratioCurrency:
                maybeLegacy.ratioCurrency === "chaos" ? "chaos" : "divine",
              quantity: maybeLegacy.quantity ?? "",
            };
          },
        );

        const normalizedLoots: InvestmentEntry[] = parsedLoots.map((entry) => {
          const maybeLegacy = entry as Partial<InvestmentEntry> & {
            ratioPerItem?: string;
          };

          return {
            id: maybeLegacy.id ?? `${Date.now()}-${Math.random()}`,
            itemName: maybeLegacy.itemName ?? "",
            ratioItemAmount: maybeLegacy.ratioItemAmount ?? "1",
            ratioCostAmount:
              maybeLegacy.ratioCostAmount ?? maybeLegacy.ratioPerItem ?? "",
            ratioCurrency:
              maybeLegacy.ratioCurrency === "chaos" ? "chaos" : "divine",
            quantity: maybeLegacy.quantity ?? "",
          };
        });

        const normalizedMaps: MapEntry[] = parsedMaps.map((entry) => {
          const maybeLegacy = entry as Partial<MapEntry> & {
            timeMinutes?: string;
            timeSeconds?: string;
            mapOrFragmentName?: string;
          };

          const legacyMinutesRaw =
            maybeLegacy.completionMinutes ?? maybeLegacy.timeMinutes ?? "";
          const legacySecondsRaw =
            maybeLegacy.completionSeconds ?? maybeLegacy.timeSeconds ?? "";
          const hasExplicitSeconds =
            maybeLegacy.completionSeconds !== undefined ||
            maybeLegacy.timeSeconds !== undefined;

          let normalizedMinutes = "";
          let normalizedSeconds = "";

          if (legacyMinutesRaw !== "" || legacySecondsRaw !== "") {
            if (hasExplicitSeconds) {
              normalizedMinutes = `${Math.max(0, Math.floor(toNumber(legacyMinutesRaw)))}`;
              normalizedSeconds = `${Math.min(59, Math.max(0, Math.floor(toNumber(legacySecondsRaw))))}`;
            } else {
              const totalLegacySeconds = Math.max(
                0,
                Math.round(toNumber(legacyMinutesRaw) * 60),
              );
              normalizedMinutes = `${Math.floor(totalLegacySeconds / 60)}`;
              normalizedSeconds = `${totalLegacySeconds % 60}`;
            }
          }

          return {
            id: maybeLegacy.id ?? `${Date.now()}-${Math.random()}`,
            mapName: maybeLegacy.mapName ?? maybeLegacy.mapOrFragmentName ?? "",
            completionMinutes: normalizedMinutes,
            completionSeconds: normalizedSeconds,
            quantity: maybeLegacy.quantity ?? "",
          };
        });

        setState({
          additionalInvestmentChaos: parsed.additionalInvestmentChaos ?? "",
          sellValueChaos: parsed.sellValueChaos ?? "",
          feePercent: parsed.feePercent ?? "0",
          exchangeRateChaosPerDivine: parsed.exchangeRateChaosPerDivine ?? "",
          useLiveRate: parsed.useLiveRate ?? true,
          investments: normalizedInvestments,
          loots: normalizedLoots,
          maps: normalizedMaps,
        });
      } catch {
        setSaveStatus("Could not load saved values.");
      }
    };

    load();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus("Saved locally.");
      } catch {
        setSaveStatus("Save failed.");
      }
    };

    persist();
  }, [state]);

  useEffect(() => {
    const loadSavedComputations = async () => {
      try {
        if (!COMPUTATIONS_FILE_URI || !FileSystem.documentDirectory) {
          return;
        }

        const fileInfo = await FileSystem.getInfoAsync(COMPUTATIONS_FILE_URI);
        if (!fileInfo.exists) {
          return;
        }

        const raw = await FileSystem.readAsStringAsync(COMPUTATIONS_FILE_URI);
        const parsed = JSON.parse(raw) as SavedComputation[];
        if (!Array.isArray(parsed)) {
          return;
        }

        const normalized = parsed
          .filter(
            (entry) => entry && typeof entry.id === "string" && entry.state,
          )
          .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

        setSavedComputations(normalized);
      } catch {
        setSaveStatus("Could not load saved computations file.");
      }
    };

    loadSavedComputations();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, toast.duration);

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [toast]);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
    duration: number = 2500,
  ) => {
    setToast({
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
    });
  };

  const updateField = (key: keyof ProfitCalculatorState, value: string) => {
    setState((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateRate = (value: string) => {
    setState((previous) => ({
      ...previous,
      exchangeRateChaosPerDivine: value,
      useLiveRate: false,
    }));
  };

  const applyLiveRate = () => {
    if (!divineChaosRate || !Number.isFinite(divineChaosRate)) {
      return;
    }

    const liveRate = (Math.round(divineChaosRate * 100) / 100).toString();
    setState((previous) => ({
      ...previous,
      exchangeRateChaosPerDivine: liveRate,
      useLiveRate: true,
    }));
    setSaveStatus("Using live PoE Ninja rate.");
  };

  const writeSavedComputations = async (items: SavedComputation[]) => {
    if (!COMPUTATIONS_FILE_URI || !FileSystem.documentDirectory) {
      throw new Error("File system unavailable.");
    }

    await FileSystem.writeAsStringAsync(
      COMPUTATIONS_FILE_URI,
      JSON.stringify(items, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
  };

  const saveComputationToFile = async () => {
    try {
      if (!currentComputationName.trim()) {
        setIsCreateNameModalOpen(true);
        showToast("Create a computation name first", "info");
        return;
      }

      const name = currentComputationName.trim();
      const now = new Date().toISOString();

      let recordId: string;
      let isUpdate = false;

      if (currentComputationId) {
        recordId = currentComputationId;
        isUpdate = true;
      } else {
        const existingIndex = savedComputations.findIndex(
          (item) => item.name.toLowerCase() === name.toLowerCase(),
        );
        if (existingIndex >= 0) {
          showToast(
            "A saved computation with that name already exists",
            "error",
          );
          return;
        }

        recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      const record: SavedComputation = {
        id: recordId,
        name,
        savedAt: now,
        state,
      };

      const next = [...savedComputations];
      const existingIndex = next.findIndex((item) => item.id === recordId);

      if (existingIndex >= 0) {
        next[existingIndex] = record;
      } else {
        next.unshift(record);
      }

      next.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

      await writeSavedComputations(next);
      setSavedComputations(next);
      setCurrentComputationId(recordId);
      setCurrentComputationName(name);
      setIsCreateNameModalOpen(false);
      const message =
        isUpdate || existingIndex >= 0 ? `Updated: ${name}` : `Saved: ${name}`;
      setSaveStatus(message);
      showToast(message, "success");
    } catch {
      const errorMsg = "Failed to save computation";
      setSaveStatus(errorMsg);
      showToast(errorMsg, "error");
    }
  };

  const loadSavedComputation = (id: string) => {
    const selected = savedComputations.find((entry) => entry.id === id);
    if (!selected) {
      showToast("Computation not found", "error");
      return;
    }

    setState(selected.state);
    setCurrentComputationId(selected.id);
    setCurrentComputationName(selected.name);
    setIsLoadPickerModalOpen(false);
    const message = `Loaded: ${selected.name}`;
    setSaveStatus(message);
    showToast(message, "success");
  };

  const createNewComputation = () => {
    setDraftComputationName("");
    setIsCreateNameModalOpen(true);
  };

  const confirmCreateNewComputation = () => {
    const nextName = draftComputationName.trim();

    if (!nextName) {
      showToast("Please enter a computation name", "error");
      return;
    }

    if (
      savedComputations.some(
        (item) => item.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      showToast("A saved computation with that name already exists", "error");
      return;
    }

    setState(INITIAL_STATE);
    setDraftInvestment(EMPTY_INVESTMENT_ENTRY);
    setDraftLoot(EMPTY_INVESTMENT_ENTRY);
    setDraftMap(EMPTY_MAP_ENTRY);
    setIsInvestmentModalOpen(false);
    setIsLootModalOpen(false);
    setIsMapModalOpen(false);
    setCurrentComputationId(null);
    setCurrentComputationName(nextName);
    setDraftComputationName("");
    setIsCreateNameModalOpen(false);
    setSaveStatus(`Editing new computation: ${nextName}`);
    showToast(`Created new: ${nextName}`, "info");
  };

  const startRenameComputation = (id: string) => {
    const selected = savedComputations.find((item) => item.id === id);
    if (!selected) {
      showToast("Computation not found", "error");
      return;
    }

    setRenameComputationId(selected.id);
    setRenameComputationName(selected.name);
    setIsRenameModalOpen(true);
  };

  const confirmRenameComputation = async () => {
    const nextName = renameComputationName.trim();

    if (!renameComputationId) {
      showToast("Computation not found", "error");
      return;
    }

    if (!nextName) {
      showToast("Please enter a computation name", "error");
      return;
    }

    if (
      savedComputations.some(
        (item) =>
          item.id !== renameComputationId &&
          item.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      showToast("A saved computation with that name already exists", "error");
      return;
    }

    try {
      const next = savedComputations.map((item) =>
        item.id === renameComputationId
          ? {
              ...item,
              name: nextName,
            }
          : item,
      );

      await writeSavedComputations(next);
      setSavedComputations(next);

      if (currentComputationId === renameComputationId) {
        setCurrentComputationName(nextName);
      }

      setIsRenameModalOpen(false);
      setRenameComputationId(null);
      setRenameComputationName("");
      setSaveStatus(`Renamed to: ${nextName}`);
      showToast(`Renamed: ${nextName}`, "success");
    } catch {
      showToast("Failed to rename computation", "error");
    }
  };

  const confirmDeleteComputation = (id: string) => {
    const selected = savedComputations.find((item) => item.id === id);
    if (!selected) {
      showToast("Computation not found", "error");
      return;
    }

    Alert.alert(
      "Delete computation?",
      `Delete "${selected.name}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteComputation(id);
          },
        },
      ],
    );
  };

  const deleteComputation = async (id: string) => {
    try {
      const name =
        savedComputations.find((item) => item.id === id)?.name || "Unknown";
      const next = savedComputations.filter((item) => item.id !== id);
      await writeSavedComputations(next);
      setSavedComputations(next);
      if (currentComputationId === id) {
        setCurrentComputationId(null);
        setCurrentComputationName("");
        setSaveStatus("Active computation deleted.");
      }
      showToast(`Deleted: ${name}`, "success");
    } catch {
      showToast("Failed to delete computation", "error");
    }
  };

  const updateDraftInvestment = (
    key: keyof Omit<InvestmentEntry, "id">,
    value: string | Currency,
  ) => {
    setDraftInvestment((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateDraftLoot = (
    key: keyof Omit<InvestmentEntry, "id">,
    value: string | Currency,
  ) => {
    setDraftLoot((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateDraftMap = (key: keyof Omit<MapEntry, "id">, value: string) => {
    setDraftMap((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const addInvestment = () => {
    const itemName = draftInvestment.itemName.trim();
    const ratioItemAmount = toNumber(draftInvestment.ratioItemAmount);
    const ratioCostAmount = toNumber(draftInvestment.ratioCostAmount);
    const quantity = toNumber(draftInvestment.quantity);

    if (
      !itemName ||
      ratioItemAmount <= 0 ||
      ratioCostAmount <= 0 ||
      quantity <= 0
    ) {
      setSaveStatus("Enter item name, ratio values, and quantity above 0.");
      return;
    }

    const entry: InvestmentEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemName,
      ratioItemAmount: `${ratioItemAmount}`,
      ratioCostAmount: `${ratioCostAmount}`,
      ratioCurrency: draftInvestment.ratioCurrency,
      quantity: `${quantity}`,
    };

    setState((previous) => ({
      ...previous,
      investments: [entry, ...previous.investments],
    }));
    setDraftInvestment(EMPTY_INVESTMENT_ENTRY);
    setIsInvestmentModalOpen(false);
    setSaveStatus("Investment item added.");
  };

  const addLoot = () => {
    const itemName = draftLoot.itemName.trim();
    const ratioItemAmount = toNumber(draftLoot.ratioItemAmount);
    const ratioCostAmount = toNumber(draftLoot.ratioCostAmount);
    const quantity = toNumber(draftLoot.quantity);

    if (
      !itemName ||
      ratioItemAmount <= 0 ||
      ratioCostAmount <= 0 ||
      quantity <= 0
    ) {
      setSaveStatus("Enter item name, ratio values, and quantity above 0.");
      return;
    }

    const entry: InvestmentEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemName,
      ratioItemAmount: `${ratioItemAmount}`,
      ratioCostAmount: `${ratioCostAmount}`,
      ratioCurrency: draftLoot.ratioCurrency,
      quantity: `${quantity}`,
    };

    setState((previous) => ({
      ...previous,
      loots: [entry, ...previous.loots],
    }));
    setDraftLoot(EMPTY_INVESTMENT_ENTRY);
    setIsLootModalOpen(false);
    setSaveStatus("Loot item added.");
  };

  const addMap = () => {
    const mapName = draftMap.mapName.trim();
    const completionMinutes = Math.max(
      0,
      Math.floor(toNumber(draftMap.completionMinutes)),
    );
    const completionSeconds = Math.min(
      59,
      Math.max(0, Math.floor(toNumber(draftMap.completionSeconds))),
    );
    const quantity = toNumber(draftMap.quantity);

    if (
      !mapName ||
      (completionMinutes <= 0 && completionSeconds <= 0) ||
      quantity <= 0
    ) {
      setSaveStatus("Enter map name, completion time, and quantity above 0.");
      return;
    }

    const entry: MapEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mapName,
      completionMinutes: `${completionMinutes}`,
      completionSeconds: `${completionSeconds}`,
      quantity: `${quantity}`,
    };

    setState((previous) => ({
      ...previous,
      maps: [entry, ...previous.maps],
    }));
    setDraftMap(EMPTY_MAP_ENTRY);
    setIsMapModalOpen(false);
    setSaveStatus("Map item added.");
  };

  const updateInvestmentField = (
    id: string,
    key: keyof Omit<InvestmentEntry, "id">,
    value: string | Currency,
  ) => {
    setState((previous) => ({
      ...previous,
      investments: previous.investments.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [key]: value,
            }
          : entry,
      ),
    }));
  };

  const updateLootField = (
    id: string,
    key: keyof Omit<InvestmentEntry, "id">,
    value: string | Currency,
  ) => {
    setState((previous) => ({
      ...previous,
      loots: previous.loots.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [key]: value,
            }
          : entry,
      ),
    }));
  };

  const updateMapField = (
    id: string,
    key: keyof Omit<MapEntry, "id">,
    value: string,
  ) => {
    setState((previous) => ({
      ...previous,
      maps: previous.maps.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [key]: value,
            }
          : entry,
      ),
    }));
  };

  const removeInvestment = (id: string) => {
    setState((previous) => ({
      ...previous,
      investments: previous.investments.filter((entry) => entry.id !== id),
    }));
    setSaveStatus("Investment item removed.");
  };

  const removeLoot = (id: string) => {
    setState((previous) => ({
      ...previous,
      loots: previous.loots.filter((entry) => entry.id !== id),
    }));
    setSaveStatus("Loot item removed.");
  };

  const removeMap = (id: string) => {
    setState((previous) => ({
      ...previous,
      maps: previous.maps.filter((entry) => entry.id !== id),
    }));
    setSaveStatus("Map item removed.");
  };

  const profitTone =
    calc.profit > 0
      ? "#73C991"
      : calc.profit < 0
        ? "#F14C4C"
        : semantic.textPrimary;

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
            <View
              style={[styles.menuLine, { backgroundColor: semantic.accent }]}
            />
            <View
              style={[styles.menuLine, { backgroundColor: semantic.accent }]}
            />
            <View
              style={[styles.menuLine, { backgroundColor: semantic.accent }]}
            />
          </TouchableOpacity>

          <ThemedText
            style={[styles.headerTitle, { fontFamily: Fonts.rounded }]}
            numberOfLines={1}
          >
            Profit Calculator
          </ThemedText>

          <View style={styles.headerMetaArea}>
            <ThemedText
              style={[styles.headerCurrentName, { color: semantic.textMuted }]}
              numberOfLines={1}
            >
              {currentComputationName
                ? `${currentComputationId ? "File" : "Draft"}: ${currentComputationName}`
                : "No computation selected"}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.toolbar,
            {
              borderBottomColor: semantic.border,
              backgroundColor: semantic.screenBackground,
            },
          ]}
        >
          <View
            style={[
              styles.toolbarGroup,
              {
                borderColor: semantic.border,
                backgroundColor: semantic.panelBackground,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setIsLoadPickerModalOpen(true)}
              disabled={savedComputations.length === 0}
              style={[
                styles.toolbarListButton,
                {
                  borderColor: semantic.border,
                  backgroundColor:
                    savedComputations.length > 0
                      ? semantic.accent + "16"
                      : semantic.screenBackground,
                  opacity: savedComputations.length === 0 ? 0.5 : 1,
                },
              ]}
              accessibilityLabel={`View saved computations (${savedComputations.length})`}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="list-alt"
                size={17}
                color={semantic.accent}
              />
              <ThemedText
                style={[
                  styles.toolbarListButtonText,
                  { color: semantic.accent, fontFamily: Fonts.rounded },
                ]}
              >
                Files
              </ThemedText>
              <View
                style={[
                  styles.toolbarBadge,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.panelBackground,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.toolbarBadgeText,
                    { color: semantic.textPrimary },
                  ]}
                >
                  {savedComputations.length}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.toolbarGroup,
              {
                borderColor: semantic.border,
                backgroundColor: semantic.panelBackground,
              },
            ]}
          >
            <TouchableOpacity
              onPress={createNewComputation}
              style={[
                styles.toolbarActionButton,
                {
                  borderColor: semantic.border,
                  backgroundColor: semantic.screenBackground,
                },
              ]}
              accessibilityLabel="Create new computation"
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="add-circle-outline"
                size={16}
                color={semantic.accent}
              />
              <ThemedText
                style={[
                  styles.toolbarActionText,
                  { color: semantic.textPrimary, fontFamily: Fonts.rounded },
                ]}
              >
                New
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={saveComputationToFile}
              style={[
                styles.toolbarActionButton,
                {
                  borderColor: semantic.border,
                  backgroundColor: semantic.accent + "14",
                },
              ]}
              accessibilityLabel="Save computation"
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="save-alt"
                size={16}
                color={semantic.accent}
              />
              <ThemedText
                style={[
                  styles.toolbarActionText,
                  { color: semantic.textPrimary, fontFamily: Fonts.rounded },
                ]}
              >
                Save
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <View style={styles.rateHeaderRow}>
                <ThemedText type="subtitle">Divine to Chaos</ThemedText>
              </View>
              <ThemedText
                style={[styles.rateHint, { color: semantic.textMuted }]}
              >
                {isRateLoading
                  ? "Fetching live rate from PoE Ninja..."
                  : rateError
                    ? "Live rate unavailable. You can still enter a custom rate."
                    : `Live: 1 Divine = ${divineChaosRate ? Math.round(divineChaosRate) : "N/A"} Chaos (${CURRENT_LEAGUE})`}
              </ThemedText>
              <View style={styles.rateInputRow}>
                <TextInput
                  value={state.exchangeRateChaosPerDivine}
                  onChangeText={updateRate}
                  keyboardType="decimal-pad"
                  placeholder="Chaos per Divine"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.rateInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />
                <TouchableOpacity
                  onPress={applyLiveRate}
                  style={[
                    styles.useLiveButton,
                    {
                      borderColor: semantic.border,
                      backgroundColor: state.useLiveRate
                        ? semantic.accent + "22"
                        : "transparent",
                    },
                  ]}
                  accessibilityLabel="Apply live PoE Ninja rate"
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={[
                      styles.useLiveButtonText,
                      { color: semantic.accent },
                    ]}
                  >
                    Use Live
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHeaderRow}>
                <ThemedText
                  style={[styles.sectionTitle, { color: semantic.textPrimary }]}
                >
                  Investment
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setIsInvestmentModalOpen(true)}
                  style={[styles.addButton, { borderColor: semantic.border }]}
                  accessibilityLabel="Add investment entry"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={16} color={semantic.accent} />
                  <ThemedText
                    style={[styles.addButtonText, { color: semantic.accent }]}
                  >
                    Add Investment
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Extra Investment (Chaos)
              </ThemedText>
              <TextInput
                value={state.additionalInvestmentChaos}
                onChangeText={(value) =>
                  updateField("additionalInvestmentChaos", value)
                }
                keyboardType="decimal-pad"
                placeholder="Optional manual adjustment"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableContainer}
              >
                <View style={[styles.table, { borderColor: semantic.border }]}>
                  <View
                    style={[
                      styles.tableRow,
                      styles.tableHeaderRow,
                      { borderBottomColor: semantic.border },
                    ]}
                  >
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colItem]}
                    >
                      Item
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colRatio]}
                    >
                      Ratio
                    </ThemedText>
                    <ThemedText style={[styles.tableHeaderCell, styles.colQty]}>
                      Qty
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colTotalChaos]}
                    >
                      Total (Chaos)
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colTotalDiv]}
                    >
                      Total (Div)
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colActions]}
                    >
                      {" "}
                    </ThemedText>
                  </View>

                  {investmentRows.length === 0 ? (
                    <View
                      style={[
                        styles.tableRow,
                        { borderBottomColor: semantic.border },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tableCell,
                          { color: semantic.textMuted },
                        ]}
                      >
                        No investments yet.
                      </ThemedText>
                    </View>
                  ) : (
                    investmentRows.map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: semantic.border },
                        ]}
                      >
                        <TextInput
                          value={entry.itemName}
                          onChangeText={(value) =>
                            updateInvestmentField(entry.id, "itemName", value)
                          }
                          placeholder="Item"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.tableItemInput,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <View style={[styles.tableRatioRow, styles.colRatio]}>
                          <TextInput
                            value={entry.ratioItemAmount}
                            onChangeText={(value) =>
                              updateInvestmentField(
                                entry.id,
                                "ratioItemAmount",
                                value,
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="20"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.tableRatioInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                          <ThemedText
                            style={[
                              styles.tableCell,
                              { color: semantic.textMuted },
                            ]}
                          >
                            :
                          </ThemedText>
                          <TextInput
                            value={entry.ratioCostAmount}
                            onChangeText={(value) =>
                              updateInvestmentField(
                                entry.id,
                                "ratioCostAmount",
                                value,
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="1.5"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.tableRatioInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                          <TouchableOpacity
                            onPress={() =>
                              updateInvestmentField(
                                entry.id,
                                "ratioCurrency",
                                entry.ratioCurrency === "divine"
                                  ? "chaos"
                                  : "divine",
                              )
                            }
                            style={[
                              styles.tableCurrencyChip,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.accent + "18",
                              },
                            ]}
                            activeOpacity={0.7}
                            accessibilityLabel={`Toggle currency for ${entry.itemName || "investment"}`}
                          >
                            <ThemedText
                              style={[
                                styles.tableCurrencyChipText,
                                { color: semantic.accent },
                              ]}
                            >
                              {entry.ratioCurrency === "divine"
                                ? "Div"
                                : "Chaos"}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          value={entry.quantity}
                          onChangeText={(value) =>
                            updateInvestmentField(entry.id, "quantity", value)
                          }
                          keyboardType="decimal-pad"
                          placeholder="Qty"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.colQty,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <ThemedText
                          style={[styles.tableCell, styles.colTotalChaos]}
                          numberOfLines={1}
                        >
                          {formatChaos(entry.totalChaos)}
                        </ThemedText>
                        <ThemedText
                          style={[styles.tableCell, styles.colTotalDiv]}
                          numberOfLines={1}
                        >
                          {chaosPerDivine > 0 ||
                          entry.ratioCurrency === "divine"
                            ? formatDiv(entry.totalDiv)
                            : "Set rate"}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => removeInvestment(entry.id)}
                          style={styles.colActions}
                          accessibilityLabel={`Remove ${entry.itemName || "investment"}`}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={semantic.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <View style={[styles.tableRow, styles.tableFooterRow]}>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colItem]}
                    >
                      Totals
                    </ThemedText>
                    <View style={styles.colRatio} />
                    <View style={styles.colQty} />
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colTotalChaos]}
                    >
                      {formatChaos(tableTotals.totalChaos)}
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colTotalDiv]}
                    >
                      {chaosPerDivine > 0
                        ? formatDiv(tableTotals.totalDiv)
                        : "Set rate"}
                    </ThemedText>
                    <View style={styles.colActions} />
                  </View>
                </View>
              </ScrollView>

              <ThemedText
                style={[
                  styles.investmentSummary,
                  { color: semantic.textMuted },
                ]}
              >
                Total investment used in calculation:{" "}
                {formatChaos(totalInvestmentChaos)}
              </ThemedText>
            </ThemedView>

            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <ThemedText
                  style={[styles.sectionTitle, { color: semantic.textPrimary }]}
                >
                  Loot
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setIsLootModalOpen(true)}
                  style={[styles.addButton, { borderColor: semantic.border }]}
                  accessibilityLabel="Add loot entry"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={16} color={semantic.accent} />
                  <ThemedText
                    style={[styles.addButtonText, { color: semantic.accent }]}
                  >
                    Add Loot
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableContainer}
              >
                <View style={[styles.table, { borderColor: semantic.border }]}>
                  <View
                    style={[
                      styles.tableRow,
                      styles.tableHeaderRow,
                      { borderBottomColor: semantic.border },
                    ]}
                  >
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colItem]}
                    >
                      Item
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colRatio]}
                    >
                      Ratio
                    </ThemedText>
                    <ThemedText style={[styles.tableHeaderCell, styles.colQty]}>
                      Qty
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colTotalChaos]}
                    >
                      Total (Chaos)
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colTotalDiv]}
                    >
                      Total (Div)
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colActions]}
                    >
                      {" "}
                    </ThemedText>
                  </View>

                  {lootRows.length === 0 ? (
                    <View
                      style={[
                        styles.tableRow,
                        { borderBottomColor: semantic.border },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tableCell,
                          { color: semantic.textMuted },
                        ]}
                      >
                        No loot yet.
                      </ThemedText>
                    </View>
                  ) : (
                    lootRows.map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: semantic.border },
                        ]}
                      >
                        <TextInput
                          value={entry.itemName}
                          onChangeText={(value) =>
                            updateLootField(entry.id, "itemName", value)
                          }
                          placeholder="Item"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.tableItemInput,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <View style={[styles.tableRatioRow, styles.colRatio]}>
                          <TextInput
                            value={entry.ratioItemAmount}
                            onChangeText={(value) =>
                              updateLootField(
                                entry.id,
                                "ratioItemAmount",
                                value,
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="20"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.tableRatioInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                          <ThemedText
                            style={[
                              styles.tableCell,
                              { color: semantic.textMuted },
                            ]}
                          >
                            :
                          </ThemedText>
                          <TextInput
                            value={entry.ratioCostAmount}
                            onChangeText={(value) =>
                              updateLootField(
                                entry.id,
                                "ratioCostAmount",
                                value,
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="1.5"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.tableRatioInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                          <TouchableOpacity
                            onPress={() =>
                              updateLootField(
                                entry.id,
                                "ratioCurrency",
                                entry.ratioCurrency === "divine"
                                  ? "chaos"
                                  : "divine",
                              )
                            }
                            style={[
                              styles.tableCurrencyChip,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.accent + "18",
                              },
                            ]}
                            activeOpacity={0.7}
                            accessibilityLabel={`Toggle currency for ${entry.itemName || "loot"}`}
                          >
                            <ThemedText
                              style={[
                                styles.tableCurrencyChipText,
                                { color: semantic.accent },
                              ]}
                            >
                              {entry.ratioCurrency === "divine"
                                ? "Div"
                                : "Chaos"}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          value={entry.quantity}
                          onChangeText={(value) =>
                            updateLootField(entry.id, "quantity", value)
                          }
                          keyboardType="decimal-pad"
                          placeholder="Qty"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.colQty,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <ThemedText
                          style={[styles.tableCell, styles.colTotalChaos]}
                          numberOfLines={1}
                        >
                          {formatChaos(entry.totalChaos)}
                        </ThemedText>
                        <ThemedText
                          style={[styles.tableCell, styles.colTotalDiv]}
                          numberOfLines={1}
                        >
                          {chaosPerDivine > 0 ||
                          entry.ratioCurrency === "divine"
                            ? formatDiv(entry.totalDiv)
                            : "Set rate"}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => removeLoot(entry.id)}
                          style={styles.colActions}
                          accessibilityLabel={`Remove ${entry.itemName || "loot"}`}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={semantic.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <View style={[styles.tableRow, styles.tableFooterRow]}>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colItem]}
                    >
                      Totals
                    </ThemedText>
                    <View style={styles.colRatio} />
                    <View style={styles.colQty} />
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colTotalChaos]}
                    >
                      {formatChaos(lootTotals.totalChaos)}
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colTotalDiv]}
                    >
                      {chaosPerDivine > 0
                        ? formatDiv(lootTotals.totalDiv)
                        : "Set rate"}
                    </ThemedText>
                    <View style={styles.colActions} />
                  </View>
                </View>
              </ScrollView>

              <ThemedText
                style={[
                  styles.investmentSummary,
                  { color: semantic.textMuted },
                ]}
              >
                Total loot recorded: {formatChaos(lootTotals.totalChaos)}
              </ThemedText>
            </ThemedView>

            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <ThemedText
                  style={[styles.sectionTitle, { color: semantic.textPrimary }]}
                >
                  Maps
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setIsMapModalOpen(true)}
                  style={[styles.addButton, { borderColor: semantic.border }]}
                  accessibilityLabel="Add map entry"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={16} color={semantic.accent} />
                  <ThemedText
                    style={[styles.addButtonText, { color: semantic.accent }]}
                  >
                    Add Map
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tableContainer}
              >
                <View
                  style={[styles.mapTable, { borderColor: semantic.border }]}
                >
                  <View
                    style={[
                      styles.tableRow,
                      styles.tableHeaderRow,
                      { borderBottomColor: semantic.border },
                    ]}
                  >
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colMapName]}
                    >
                      Map / Fragment
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colMapTime]}
                    >
                      Time/Run (mm:ss)
                    </ThemedText>
                    <ThemedText style={[styles.tableHeaderCell, styles.colQty]}>
                      Qty
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colTotalMinutes]}
                    >
                      Total Time
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableHeaderCell, styles.colActions]}
                    >
                      {" "}
                    </ThemedText>
                  </View>

                  {mapRows.length === 0 ? (
                    <View
                      style={[
                        styles.tableRow,
                        { borderBottomColor: semantic.border },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tableCell,
                          { color: semantic.textMuted },
                        ]}
                      >
                        No maps yet.
                      </ThemedText>
                    </View>
                  ) : (
                    mapRows.map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: semantic.border },
                        ]}
                      >
                        <TextInput
                          value={entry.mapName}
                          onChangeText={(value) =>
                            updateMapField(entry.id, "mapName", value)
                          }
                          placeholder="Map or Fragment"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.colMapName,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <View style={[styles.mapTimeGroup, styles.colMapTime]}>
                          <TextInput
                            value={entry.completionMinutes}
                            onChangeText={(value) =>
                              updateMapField(
                                entry.id,
                                "completionMinutes",
                                value,
                              )
                            }
                            keyboardType="number-pad"
                            placeholder="7"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.mapTimeInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                          <ThemedText
                            style={[
                              styles.mapTimeColon,
                              { color: semantic.textMuted },
                            ]}
                          >
                            :
                          </ThemedText>
                          <TextInput
                            value={entry.completionSeconds}
                            onChangeText={(value) =>
                              updateMapField(
                                entry.id,
                                "completionSeconds",
                                value,
                              )
                            }
                            keyboardType="number-pad"
                            placeholder="30"
                            placeholderTextColor={semantic.textMuted}
                            style={[
                              styles.tableInput,
                              styles.mapTimeInput,
                              {
                                borderColor: semantic.border,
                                backgroundColor: semantic.screenBackground,
                                color: semantic.textPrimary,
                              },
                            ]}
                          />
                        </View>

                        <TextInput
                          value={entry.quantity}
                          onChangeText={(value) =>
                            updateMapField(entry.id, "quantity", value)
                          }
                          keyboardType="decimal-pad"
                          placeholder="Qty"
                          placeholderTextColor={semantic.textMuted}
                          style={[
                            styles.tableInput,
                            styles.colQty,
                            {
                              borderColor: semantic.border,
                              backgroundColor: semantic.screenBackground,
                              color: semantic.textPrimary,
                            },
                          ]}
                        />

                        <ThemedText
                          style={[styles.tableCell, styles.colTotalMinutes]}
                          numberOfLines={1}
                        >
                          {formatHmsFromSeconds(entry.totalSeconds)}
                        </ThemedText>

                        <TouchableOpacity
                          onPress={() => removeMap(entry.id)}
                          style={styles.colActions}
                          accessibilityLabel={`Remove ${entry.mapName || "map entry"}`}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={semantic.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <View style={[styles.tableRow, styles.tableFooterRow]}>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colMapName]}
                    >
                      Totals
                    </ThemedText>
                    <View style={styles.colMapTime} />
                    <ThemedText style={[styles.tableFooterCell, styles.colQty]}>
                      {Math.round(mapTotals.totalQuantity)}
                    </ThemedText>
                    <ThemedText
                      style={[styles.tableFooterCell, styles.colTotalMinutes]}
                    >
                      {formatHmsFromSeconds(mapTotals.totalSeconds)}
                    </ThemedText>
                    <View style={styles.colActions} />
                  </View>
                </View>
              </ScrollView>

              <ThemedText
                style={[
                  styles.investmentSummary,
                  { color: semantic.textMuted },
                ]}
              >
                Total map time recorded:{" "}
                {formatHmsFromSeconds(mapTotals.totalSeconds)}
              </ThemedText>
            </ThemedView>
          </ScrollView>

          <View
            style={[
              styles.fixedSummaryArea,
              { borderTopColor: semantic.border },
            ]}
          >
            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <View
                style={[
                  styles.summaryTableRow,
                  { borderBottomColor: semantic.border },
                ]}
              >
                <ThemedText
                  style={[styles.metricLabel, styles.summaryLabelCell]}
                >
                  Total Investment
                </ThemedText>
                <ThemedText
                  style={[styles.metricValue, styles.summaryValueCell]}
                >
                  {chaosPerDivine > 0
                    ? formatDiv(totalInvestmentDiv)
                    : "Set rate"}
                </ThemedText>
                <ThemedText
                  style={[styles.metricValue, styles.summaryValueCell]}
                >
                  {formatChaos(totalInvestmentChaos)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.summaryTableRow,
                  { borderBottomColor: semantic.border },
                ]}
              >
                <ThemedText
                  style={[styles.metricLabel, styles.summaryLabelCell]}
                >
                  Total Loot
                </ThemedText>
                <ThemedText
                  style={[styles.metricValue, styles.summaryValueCell]}
                >
                  {chaosPerDivine > 0
                    ? formatDiv(calc.totalLootDiv)
                    : "Set rate"}
                </ThemedText>
                <ThemedText
                  style={[styles.metricValue, styles.summaryValueCell]}
                >
                  {formatChaos(calc.totalLootChaos)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.summaryTableRow,
                  { borderBottomColor: semantic.border },
                ]}
              >
                <ThemedText
                  style={[styles.metricLabel, styles.summaryLabelCell]}
                >
                  Net Profit
                </ThemedText>
                <ThemedText
                  style={[
                    styles.metricValue,
                    styles.summaryValueCell,
                    { color: profitTone },
                  ]}
                >
                  {chaosPerDivine > 0
                    ? formatDiv(calc.profitInDivines)
                    : "Set rate"}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.metricValue,
                    styles.summaryValueCell,
                    { color: profitTone },
                  ]}
                >
                  {formatChaos(calc.profit)}
                </ThemedText>
              </View>

              {hasMapData ? (
                <>
                  <View
                    style={[
                      styles.summaryTableRow,
                      { borderBottomColor: semantic.border },
                    ]}
                  >
                    <ThemedText
                      style={[styles.metricLabel, styles.summaryLabelCell]}
                    >
                      Grand Total Map Time
                    </ThemedText>
                    <ThemedText
                      style={[styles.metricValue, styles.summaryValueCell]}
                    >
                      -
                    </ThemedText>
                    <ThemedText
                      style={[styles.metricValue, styles.summaryValueCell]}
                    >
                      {formatHmsFromSeconds(mapTotals.totalSeconds)}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.summaryTableRow,
                      { borderBottomColor: semantic.border },
                    ]}
                  >
                    <ThemedText
                      style={[styles.metricLabel, styles.summaryLabelCell]}
                    >
                      Profit / Hour
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.metricValue,
                        styles.summaryValueCell,
                        { color: profitTone },
                      ]}
                    >
                      {chaosPerDivine > 0
                        ? formatDiv(profitPerHourDiv)
                        : "Set rate"}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.metricValue,
                        styles.summaryValueCell,
                        { color: profitTone },
                      ]}
                    >
                      {formatChaos(profitPerHourChaos)}
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </ThemedView>

            <ThemedText
              style={[styles.statusText, { color: semantic.textMuted }]}
            >
              {saveStatus}
            </ThemedText>
          </View>
        </View>

        {toast && (
          <View
            style={[
              styles.toastContainer,
              {
                top: insets.top + 12,
                backgroundColor:
                  toast.type === "success"
                    ? "#10B981"
                    : toast.type === "error"
                      ? "#EF4444"
                      : semantic.accent,
              },
            ]}
          >
            <MaterialIcons
              name={
                toast.type === "success"
                  ? "check-circle"
                  : toast.type === "error"
                    ? "error"
                    : "info"
              }
              size={18}
              color="#FFFFFF"
            />
            <ThemedText style={styles.toastText}>{toast.message}</ThemedText>
          </View>
        )}

        <Modal
          visible={isInvestmentModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsInvestmentModalOpen(false)}
        >
          <View
            style={[styles.modalOverlay, { backgroundColor: semantic.overlay }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText type="subtitle">Add Investment</ThemedText>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Item Name
              </ThemedText>
              <TextInput
                value={draftInvestment.itemName}
                onChangeText={(value) =>
                  updateDraftInvestment("itemName", value)
                }
                placeholder="e.g. Black Barya"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Item : Cost Ratio
              </ThemedText>
              <View style={styles.modalRatioRow}>
                <TextInput
                  value={draftInvestment.ratioItemAmount}
                  onChangeText={(value) =>
                    updateDraftInvestment("ratioItemAmount", value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="e.g. 20"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalRatioLeftInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />

                <ThemedText
                  style={[styles.ratioSeparator, { color: semantic.textMuted }]}
                >
                  :
                </ThemedText>

                <TextInput
                  value={draftInvestment.ratioCostAmount}
                  onChangeText={(value) =>
                    updateDraftInvestment("ratioCostAmount", value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.5"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalRatioRightInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />

                <View style={styles.currencySwitchRow}>
                  <TouchableOpacity
                    onPress={() =>
                      updateDraftInvestment("ratioCurrency", "divine")
                    }
                    style={[
                      styles.currencyOption,
                      {
                        borderColor: semantic.border,
                        backgroundColor:
                          draftInvestment.ratioCurrency === "divine"
                            ? semantic.accent + "22"
                            : "transparent",
                      },
                    ]}
                  >
                    <ThemedText style={{ color: semantic.textPrimary }}>
                      Divine
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      updateDraftInvestment("ratioCurrency", "chaos")
                    }
                    style={[
                      styles.currencyOption,
                      {
                        borderColor: semantic.border,
                        backgroundColor:
                          draftInvestment.ratioCurrency === "chaos"
                            ? semantic.accent + "22"
                            : "transparent",
                      },
                    ]}
                  >
                    <ThemedText style={{ color: semantic.textPrimary }}>
                      Chaos
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Quantity
              </ThemedText>
              <TextInput
                value={draftInvestment.quantity}
                onChangeText={(value) =>
                  updateDraftInvestment("quantity", value)
                }
                keyboardType="number-pad"
                placeholder="e.g. 200"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => setIsInvestmentModalOpen(false)}
                  style={[
                    styles.modalSecondaryButton,
                    { borderColor: semantic.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: semantic.textMuted }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addInvestment}
                  style={[
                    styles.modalPrimaryButton,
                    { backgroundColor: semantic.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.modalPrimaryButtonText}>
                    Add
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isLootModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLootModalOpen(false)}
        >
          <View
            style={[styles.modalOverlay, { backgroundColor: semantic.overlay }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText type="subtitle">Add Loot</ThemedText>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Item Name
              </ThemedText>
              <TextInput
                value={draftLoot.itemName}
                onChangeText={(value) => updateDraftLoot("itemName", value)}
                placeholder="e.g. Divine Orb"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Item : Cost Ratio
              </ThemedText>
              <View style={styles.modalRatioRow}>
                <TextInput
                  value={draftLoot.ratioItemAmount}
                  onChangeText={(value) =>
                    updateDraftLoot("ratioItemAmount", value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="e.g. 20"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalRatioLeftInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />

                <ThemedText
                  style={[styles.ratioSeparator, { color: semantic.textMuted }]}
                >
                  :
                </ThemedText>

                <TextInput
                  value={draftLoot.ratioCostAmount}
                  onChangeText={(value) =>
                    updateDraftLoot("ratioCostAmount", value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.5"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalRatioRightInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />

                <View style={styles.currencySwitchRow}>
                  <TouchableOpacity
                    onPress={() => updateDraftLoot("ratioCurrency", "divine")}
                    style={[
                      styles.currencyOption,
                      {
                        borderColor: semantic.border,
                        backgroundColor:
                          draftLoot.ratioCurrency === "divine"
                            ? semantic.accent + "22"
                            : "transparent",
                      },
                    ]}
                  >
                    <ThemedText style={{ color: semantic.textPrimary }}>
                      Divine
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateDraftLoot("ratioCurrency", "chaos")}
                    style={[
                      styles.currencyOption,
                      {
                        borderColor: semantic.border,
                        backgroundColor:
                          draftLoot.ratioCurrency === "chaos"
                            ? semantic.accent + "22"
                            : "transparent",
                      },
                    ]}
                  >
                    <ThemedText style={{ color: semantic.textPrimary }}>
                      Chaos
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Quantity
              </ThemedText>
              <TextInput
                value={draftLoot.quantity}
                onChangeText={(value) => updateDraftLoot("quantity", value)}
                keyboardType="number-pad"
                placeholder="e.g. 200"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => setIsLootModalOpen(false)}
                  style={[
                    styles.modalSecondaryButton,
                    { borderColor: semantic.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: semantic.textMuted }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addLoot}
                  style={[
                    styles.modalPrimaryButton,
                    { backgroundColor: semantic.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.modalPrimaryButtonText}>
                    Add
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isMapModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMapModalOpen(false)}
        >
          <View
            style={[styles.modalOverlay, { backgroundColor: semantic.overlay }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText type="subtitle">Add Map</ThemedText>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Map / Fragment Name
              </ThemedText>
              <TextInput
                value={draftMap.mapName}
                onChangeText={(value) => updateDraftMap("mapName", value)}
                placeholder="e.g. Dunes Map"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Time To Complete (min:sec)
              </ThemedText>
              <View style={styles.modalTimeRow}>
                <TextInput
                  value={draftMap.completionMinutes}
                  onChangeText={(value) =>
                    updateDraftMap("completionMinutes", value)
                  }
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalTimeInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />
                <ThemedText
                  style={[styles.ratioSeparator, { color: semantic.textMuted }]}
                >
                  :
                </ThemedText>
                <TextInput
                  value={draftMap.completionSeconds}
                  onChangeText={(value) =>
                    updateDraftMap("completionSeconds", value)
                  }
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={semantic.textMuted}
                  style={[
                    styles.input,
                    styles.modalTimeInput,
                    {
                      borderColor: semantic.border,
                      backgroundColor: semantic.screenBackground,
                      color: semantic.textPrimary,
                    },
                  ]}
                />
              </View>

              <ThemedText style={[styles.label, { color: semantic.textMuted }]}>
                Quantity
              </ThemedText>
              <TextInput
                value={draftMap.quantity}
                onChangeText={(value) => updateDraftMap("quantity", value)}
                keyboardType="number-pad"
                placeholder="e.g. 20"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => setIsMapModalOpen(false)}
                  style={[
                    styles.modalSecondaryButton,
                    { borderColor: semantic.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: semantic.textMuted }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addMap}
                  style={[
                    styles.modalPrimaryButton,
                    { backgroundColor: semantic.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.modalPrimaryButtonText}>
                    Add
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isCreateNameModalOpen} animationType="fade" transparent>
          <View
            style={[styles.modalOverlay, { backgroundColor: semantic.overlay }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText type="subtitle">Create New Computation</ThemedText>

              <ThemedText
                style={[
                  styles.label,
                  { color: semantic.textMuted, marginTop: 12 },
                ]}
              >
                Computation Name
              </ThemedText>
              <TextInput
                value={draftComputationName}
                onChangeText={setDraftComputationName}
                placeholder="Enter computation name"
                placeholderTextColor={semantic.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    setIsCreateNameModalOpen(false);
                    setDraftComputationName("");
                  }}
                  style={[
                    styles.modalSecondaryButton,
                    { borderColor: semantic.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: semantic.textMuted }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    confirmCreateNewComputation();
                  }}
                  style={[
                    styles.modalPrimaryButton,
                    { backgroundColor: semantic.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.modalPrimaryButtonText}>
                    Create
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isLoadPickerModalOpen}
          animationType="slide"
          transparent
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: semantic.overlay,
              },
            ]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                  flex: 1,
                  maxHeight: "85%",
                },
              ]}
            >
              <View style={styles.savedPickerHeader}>
                <ThemedText
                  style={[styles.modalTitle, { color: semantic.textPrimary }]}
                >
                  Saved Computations
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setIsLoadPickerModalOpen(false)}
                  accessibilityLabel="Close saved computations modal"
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="close"
                    size={24}
                    color={semantic.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              {savedComputations.length === 0 ? (
                <ThemedText
                  style={[
                    styles.savedPickerEmpty,
                    { color: semantic.textMuted },
                  ]}
                >
                  No saved computations.
                </ThemedText>
              ) : (
                <FlatList
                  data={savedComputations}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isActive = item.id === currentComputationId;
                    return (
                      <View
                        style={[
                          styles.savedPickerItem,
                          {
                            backgroundColor: isActive
                              ? semantic.accent + "15"
                              : semantic.screenBackground,
                            borderColor: semantic.border,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.savedPickerContent}
                          onPress={() => loadSavedComputation(item.id)}
                          activeOpacity={0.7}
                        >
                          <ThemedText
                            style={[
                              styles.savedPickerName,
                              { color: semantic.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </ThemedText>
                          <ThemedText
                            style={[
                              styles.savedPickerMeta,
                              { color: semantic.textMuted },
                            ]}
                            numberOfLines={1}
                          >
                            {formatSavedDate(item.savedAt)}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => startRenameComputation(item.id)}
                          style={styles.savedPickerActionBtn}
                          accessibilityLabel={`Rename ${item.name}`}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="edit"
                            size={20}
                            color={semantic.textMuted}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDeleteComputation(item.id)}
                          style={styles.savedPickerActionBtn}
                          accessibilityLabel={`Delete ${item.name}`}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="delete"
                            size={20}
                            color={semantic.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  contentContainerStyle={styles.savedPickerList}
                  scrollEnabled
                />
              )}

              <TouchableOpacity
                onPress={() => setIsLoadPickerModalOpen(false)}
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: semantic.accent },
                ]}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.modalPrimaryButtonText}>
                  Done
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={isRenameModalOpen} animationType="fade" transparent>
          <View
            style={[styles.modalOverlay, { backgroundColor: semantic.overlay }]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: semantic.panelBackground,
                  borderColor: semantic.border,
                },
              ]}
            >
              <ThemedText type="subtitle">Rename Computation</ThemedText>

              <ThemedText
                style={[
                  styles.label,
                  { color: semantic.textMuted, marginTop: 12 },
                ]}
              >
                New Name
              </ThemedText>
              <TextInput
                value={renameComputationName}
                onChangeText={setRenameComputationName}
                placeholder="Enter computation name"
                placeholderTextColor={semantic.textMuted}
                autoFocus
                style={[
                  styles.input,
                  {
                    borderColor: semantic.border,
                    backgroundColor: semantic.screenBackground,
                    color: semantic.textPrimary,
                  },
                ]}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    setIsRenameModalOpen(false);
                    setRenameComputationId(null);
                    setRenameComputationName("");
                  }}
                  style={[
                    styles.modalSecondaryButton,
                    { borderColor: semantic.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={{ color: semantic.textMuted }}>
                    Cancel
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    void confirmRenameComputation();
                  }}
                  style={[
                    styles.modalPrimaryButton,
                    { backgroundColor: semantic.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.modalPrimaryButtonText}>
                    Rename
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  appHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerHamburger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
  },
  headerMetaArea: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 8,
  },
  headerCurrentName: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
    maxWidth: 140,
  },
  toolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toolbarGroup: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  toolbarListButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarListButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  toolbarBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  toolbarBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  toolbarActionButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolbarActionText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  contentArea: {
    flex: 1,
  },
  fixedSummaryArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rateHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rateHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  rateInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    ...Platform.select({
      android: {
        minHeight: 44,
        textAlignVertical: "center" as const,
      },
    }),
  },
  rateInput: {
    flex: 1,
    marginBottom: 0,
  },
  useLiveButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  useLiveButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  savedSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  savedControlsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  savedNameInput: {
    flex: 1,
    marginBottom: 0,
  },
  saveComputationButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedHint: {
    marginTop: 8,
    fontSize: 12,
  },
  savedListRow: {
    marginTop: 8,
    gap: 8,
    paddingRight: 8,
  },
  savedChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 180,
  },
  savedChipTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  savedChipMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  viewSavedButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  viewSavedButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  savedPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  savedPickerEmpty: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 40,
  },
  savedPickerList: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  savedPickerItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savedPickerContent: {
    flex: 1,
    justifyContent: "center",
  },
  savedPickerName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  savedPickerMeta: {
    fontSize: 12,
  },
  savedPickerActionBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 50,
    elevation: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  tableContainer: {
    paddingBottom: 8,
  },
  table: {
    minWidth: 890,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },
  mapTable: {
    minWidth: 680,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    gap: 8,
  },
  tableHeaderRow: {
    minHeight: 40,
  },
  tableFooterRow: {
    borderBottomWidth: 0,
    minHeight: 44,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableCell: {
    fontSize: 13,
  },
  tableInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    marginBottom: 0,
    ...Platform.select({
      android: {
        height: 34,
        paddingVertical: 0,
        textAlignVertical: "center" as const,
      },
    }),
  },
  tableItemInput: {
    width: 170,
  },
  tableRatioRow: {
    width: 250,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tableRatioInput: {
    width: 58,
  },
  tableCurrencyChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableCurrencyChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableFooterCell: {
    fontSize: 13,
    fontWeight: "700",
  },
  colItem: {
    width: 170,
  },
  colRatio: {
    width: 250,
  },
  colQty: {
    width: 74,
  },
  colTotalDiv: {
    width: 130,
  },
  colTotalChaos: {
    width: 130,
  },
  colActions: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  colMapName: {
    width: 250,
  },
  colMapTime: {
    width: 150,
  },
  colTotalMinutes: {
    width: 130,
  },
  mapTimeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapTimeInput: {
    width: 60,
  },
  mapTimeColon: {
    fontSize: 14,
    fontWeight: "700",
  },
  investmentSummary: {
    fontSize: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#99999955",
    paddingVertical: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  metricLabel: {
    fontSize: 15,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusText: {
    fontSize: 12,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  modalRatioRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  modalRatioLeftInput: {
    width: 88,
    marginBottom: 0,
  },
  modalRatioRightInput: {
    width: 96,
    marginBottom: 0,
  },
  modalTimeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  modalTimeInput: {
    width: 96,
    marginBottom: 0,
  },
  ratioSeparator: {
    fontSize: 20,
    fontWeight: "700",
  },
  summaryTableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  summaryLabelCell: {
    flex: 1,
  },
  summaryValueCell: {
    width: 120,
    textAlign: "right",
  },
  currencySwitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  currencyOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  modalSecondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalPrimaryButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
