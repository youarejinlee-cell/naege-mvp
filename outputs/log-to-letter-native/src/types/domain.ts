export type Mood =
  | "calm"
  | "joy"
  | "moved"
  | "recovered"
  | "happy"
  | "delight"
  | "excited"
  | "fun"
  | "hopeful"
  | "grateful"
  | "proud"
  | "peaceful"
  | "lucky"
  | "selfEsteem"
  | "anxious"
  | "soSo"
  | "indifferent"
  | "curious"
  | "accepting"
  | "reflective"
  | "envious"
  | "instructive"
  | "difficult"
  | "worried"
  | "tired"
  | "sad"
  | "depressed"
  | "angry"
  | "irritated"
  | "jealous"
  | "prideHurt"
  | "sensitive"
  | "regret"
  | "blank"
  | "complex";

export type EntryCategory =
  | "work"
  | "relationships"
  | "love"
  | "family"
  | "dream"
  | "taste"
  | "habit"
  | "attitude"
  | "health"
  | "other";

export type Entry = {
  id: string;
  text: string;
  mood: Mood;
  energy: number;
  createdAt: string;
  category?: EntryCategory;
};

export type Letter = {
  id: string;
  title: string;
  body: string;
  periodLabel: string;
  deliveredAt: string;
  keyword: string;
  postscript?: string;
  model?: string;
  promptVersion?: string;
  themes?: string[];
  recommendations?: string[];
};

export type NotificationSettings = {
  enabled: boolean;
  scheduleMode: "interval" | "fixed";
  startTime: string;
  dndStart: string;
  dndEnd: string;
  intervalMinutes: number;
  weekdays: number[];
  fixedTimes: string[];
};

export type ColorTheme = "red" | "yellow" | "green" | "blue" | "white" | "black";
export type CalendarEnergyMode = "first" | "last" | "most";
export type EnergyColorMode = "soft" | "vivid";
export type LetterPaperStyle = "plain" | "themeBorder" | "clover" | "cloudTitle";

export type AppState = {
  entries: Entry[];
  letters: Letter[];
  settings: NotificationSettings;
  theme: ColorTheme;
  energyColorMode: EnergyColorMode;
  calendarEnergyMode: CalendarEnergyMode;
  targetMoods: Mood[];
  letterPaperStyle: LetterPaperStyle;
  testToday?: string;
};
