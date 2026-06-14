import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, ColorTheme, EntryCategory, LetterPaperStyle, Mood } from "../types/domain";
import { normalizeEnergyPercent } from "./energyColors";

export const STORAGE_KEY = "log-to-letter-native-v1";

export const defaultState: AppState = {
  entries: [],
  letters: [],
  theme: "green",
  energyColorMode: "soft",
  calendarEnergyMode: "last",
  targetMoods: [],
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
const validColorThemes: ColorTheme[] = ["red", "yellow", "green", "blue", "white", "black"];
const validMoods: Mood[] = [
  "calm", "joy", "moved", "recovered", "happy", "delight", "excited", "fun", "hopeful", "grateful", "proud", "peaceful", "lucky", "selfEsteem",
  "anxious", "soSo", "indifferent", "curious", "accepting", "reflective", "envious", "instructive", "difficult", "worried", "tired", "sad",
  "depressed", "angry", "irritated", "jealous", "prideHurt", "sensitive", "regret", "blank", "complex"
];
const validEntryCategories: EntryCategory[] = ["work", "relationships", "love", "family", "dream", "taste", "habit", "attitude", "health", "other"];

export function normalizeLetterPaperStyle(value: unknown): LetterPaperStyle {
  return letterPaperStyles.includes(value as LetterPaperStyle) ? (value as LetterPaperStyle) : "plain";
}

export function normalizeColorTheme(value: unknown): ColorTheme {
  return validColorThemes.includes(value as ColorTheme) ? (value as ColorTheme) : "green";
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
      entries: (saved.entries || []).map((entry) => ({
        ...entry,
        energy: normalizeEnergyPercent(entry.energy),
        category: validEntryCategories.includes(entry.category as EntryCategory) ? entry.category : undefined
      })),
      theme: normalizeColorTheme(saved.theme),
      targetMoods: (saved.targetMoods || []).filter((mood): mood is Mood => validMoods.includes(mood as Mood)).slice(0, 3),
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
