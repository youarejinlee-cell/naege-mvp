import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, LetterPaperStyle } from "../types/domain";

export const STORAGE_KEY = "log-to-letter-native-v1";

export const defaultState: AppState = {
  entries: [],
  letters: [],
  theme: "green",
  energyColorMode: "soft",
  calendarEnergyMode: "last",
  letterPaperStyle: "plain",
  settings: {
    enabled: false,
    scheduleMode: "interval",
    startTime: "09:00",
    dndStart: "22:00",
    dndEnd: "08:00",
    intervalMinutes: 120,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    fixedTimes: ["10:00"]
  }
};

const letterPaperStyles: LetterPaperStyle[] = ["plain", "themeBorder", "clover", "cloudTitle"];

export function normalizeLetterPaperStyle(value: unknown): LetterPaperStyle {
  return letterPaperStyles.includes(value as LetterPaperStyle) ? (value as LetterPaperStyle) : "plain";
}

export async function loadAppState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;

  try {
    const saved = JSON.parse(raw) as Partial<AppState>;
    const state = {
      ...defaultState,
      ...saved,
      settings: {
        ...defaultState.settings,
        ...(saved.settings || {})
      },
      letterPaperStyle: normalizeLetterPaperStyle(saved.letterPaperStyle)
    };
    return state;
  } catch {
    return defaultState;
  }
}

export async function saveAppState(state: AppState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
