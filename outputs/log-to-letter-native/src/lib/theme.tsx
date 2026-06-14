import { createContext, PropsWithChildren, useContext } from "react";
import { ColorTheme } from "../types/domain";

export type AppTheme = {
  label: string;
  tint: string;
  soft: string;
  page: string;
  border: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  inverseText: string;
  isDark?: boolean;
};

export const themePalettes: Record<ColorTheme, AppTheme> = {
  red: { label: "빨강", tint: "#e4564f", soft: "#ffe8e5", page: "#fff7f6", border: "#f2c9c5", card: "#fff", cardAlt: "#fff7f6", text: "#18241b", muted: "#657064", inverseText: "#fff" },
  yellow: { label: "노랑", tint: "#d79b13", soft: "#fff4c7", page: "#fffaf0", border: "#ecdca4", card: "#fff", cardAlt: "#fffaf0", text: "#18241b", muted: "#657064", inverseText: "#fff" },
  green: { label: "초록", tint: "#2f8f54", soft: "#e7f6df", page: "#f5f8f1", border: "#dfe8da", card: "#fff", cardAlt: "#fbfdf8", text: "#18241b", muted: "#657064", inverseText: "#fff" },
  blue: { label: "파랑", tint: "#3478d4", soft: "#e4efff", page: "#f5f9ff", border: "#d6e3f5", card: "#fff", cardAlt: "#f5f9ff", text: "#18241b", muted: "#657064", inverseText: "#fff" },
  white: { label: "하양", tint: "#111111", soft: "#f2f2f2", page: "#ffffff", border: "#dedede", card: "#fff", cardAlt: "#f7f7f7", text: "#111111", muted: "#686868", inverseText: "#fff" },
  black: { label: "검정", tint: "#f5f5f5", soft: "#292929", page: "#101010", border: "#3a3a3a", card: "#181818", cardAlt: "#222222", text: "#f4f4f4", muted: "#b6b6b6", inverseText: "#111111", isDark: true }
};

const ThemeContext = createContext<AppTheme>(themePalettes.green);

export function AppThemeProvider({ theme, children }: PropsWithChildren<{ theme: AppTheme }>) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
