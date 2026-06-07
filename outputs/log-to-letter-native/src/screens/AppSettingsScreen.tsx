import { Pressable, StyleSheet, Text, View } from "react-native";
import { CloverBadge } from "../components/CloverBadge";
import { Screen } from "../components/Screen";
import { energyPalettes } from "../lib/energyColors";
import { themePalettes } from "../lib/theme";
import { CalendarEnergyMode, ColorTheme, EnergyColorMode, LetterPaperStyle } from "../types/domain";

type Props = {
  theme: ColorTheme;
  energyColorMode: EnergyColorMode;
  calendarEnergyMode: CalendarEnergyMode;
  letterPaperStyle: LetterPaperStyle;
  onChangeTheme: (theme: ColorTheme) => void;
  onChangeEnergyColorMode: (mode: EnergyColorMode) => void;
  onChangeCalendarEnergyMode: (mode: CalendarEnergyMode) => void;
  onChangeLetterPaperStyle: (style: LetterPaperStyle) => void;
};

const calendarEnergyOptions: Array<{ key: CalendarEnergyMode; label: string }> = [
  { key: "first", label: "그날 처음으로 고른 에너지" },
  { key: "last", label: "그날 마지막으로 고른 에너지" },
  { key: "most", label: "그날 가장 많이 고른 에너지" }
];

const letterPaperOptions: Array<{ key: LetterPaperStyle; label: string; description: string }> = [
  { key: "plain", label: "무지", description: "가장 조용한 기본 편지지" },
  { key: "themeBorder", label: "편지지 테두리", description: "현재 테마색 테두리 편지지" },
  { key: "cloudTitle", label: "제목+내용 분리", description: "내용을 둥근 박스로 정리" },
  { key: "clover", label: "클로버 무늬", description: "세잎클로버 틈바구니에 숨어 있는 네잎클로버 하나" }
];

export function AppSettingsScreen({
  theme,
  energyColorMode,
  calendarEnergyMode,
  letterPaperStyle,
  onChangeTheme,
  onChangeEnergyColorMode,
  onChangeCalendarEnergyMode,
  onChangeLetterPaperStyle
}: Props) {
  return (
    <Screen eyebrow="Settings" title="설정" lead="앱의 색감을 고를 수 있어.">
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>컬러 테마</Text>
        <View style={styles.themeGrid}>
          {(Object.keys(themePalettes) as ColorTheme[]).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.themeButton,
                { borderColor: themePalettes[key].border, backgroundColor: themePalettes[key].soft },
                theme === key && { borderColor: themePalettes[key].tint, borderWidth: 2 }
              ]}
              onPress={() => onChangeTheme(key)}
            >
              <View style={[styles.themeSwatch, { backgroundColor: themePalettes[key].tint }]} />
              <Text style={styles.themeButtonText}>{themePalettes[key].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>에너지 팔레트</Text>
        <View style={styles.energyModeList}>
          {(Object.keys(energyPalettes) as EnergyColorMode[]).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.energyModeButton,
                { borderColor: themePalettes[theme].border, backgroundColor: "#fff" },
                energyColorMode === key && { borderColor: themePalettes[theme].tint, backgroundColor: themePalettes[theme].soft, borderWidth: 2 }
              ]}
              onPress={() => onChangeEnergyColorMode(key)}
            >
              <Text style={styles.energyModeLabel}>{energyPalettes[key].label}</Text>
              <View style={styles.energyChipRow}>
                {energyPalettes[key].levels.map((level) => (
                  <CloverBadge
                    key={level.value}
                    color={level.color}
                    glowColor={level.glow}
                    label={String(level.value)}
                    size={30}
                    textColor={level.textColor}
                    shadowOpacity={0.18}
                  />
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>캘린더에서 날짜 선택 시 에너지 표시</Text>
        <View style={styles.calendarEnergyList}>
          {calendarEnergyOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.calendarEnergyButton,
                { borderColor: themePalettes[theme].border, backgroundColor: "#fff" },
                calendarEnergyMode === option.key && { borderColor: themePalettes[theme].tint, backgroundColor: themePalettes[theme].soft, borderWidth: 2 }
              ]}
              onPress={() => onChangeCalendarEnergyMode(option.key)}
            >
              <Text style={styles.calendarEnergyText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>편지지 디자인</Text>
        <View style={styles.letterPaperList}>
          {letterPaperOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.letterPaperButton,
                { borderColor: themePalettes[theme].border, backgroundColor: "#fff" },
                letterPaperStyle === option.key && { borderColor: themePalettes[theme].tint, backgroundColor: themePalettes[theme].soft, borderWidth: 2 }
              ]}
              onPress={() => onChangeLetterPaperStyle(option.key)}
            >
              <View style={[styles.paperPreview, option.key !== "plain" && { borderColor: themePalettes[theme].tint }]}>
                {option.key === "clover" ? (
                  <>
                    <MiniClover color={themePalettes[theme].tint} style={styles.paperCloverTop} />
                    <MiniClover color={themePalettes[theme].tint} style={styles.paperCloverBottom} />
                  </>
                ) : null}
                {option.key === "cloudTitle" ? <View style={[styles.paperSplitPreview, { backgroundColor: themePalettes[theme].soft }]} /> : null}
              </View>
              <View style={styles.letterPaperTextWrap}>
                <Text style={styles.energyModeLabel}>{option.label}</Text>
                <Text style={styles.paperDescription}>{option.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

function MiniClover({ color, style, fourLeaf }: { color: string; style?: object; fourLeaf?: boolean }) {
  return (
    <View style={[styles.miniClover, style]}>
      <View style={[styles.miniCloverLeaf, styles.miniCloverTopLeaf, { backgroundColor: color }]} />
      <View style={[styles.miniCloverLeaf, styles.miniCloverLeftLeaf, { backgroundColor: color }]} />
      <View style={[styles.miniCloverLeaf, styles.miniCloverRightLeaf, { backgroundColor: color }]} />
      {fourLeaf ? <View style={[styles.miniCloverLeaf, styles.miniCloverBottomLeaf, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  sectionTitle: {
    color: "#18241b",
    fontSize: 16,
    fontWeight: "900"
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  themeButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8
  },
  themeSwatch: {
    width: 18,
    height: 18,
    borderRadius: 999
  },
  themeButtonText: {
    color: "#18241b",
    fontWeight: "900"
  },
  energyModeList: {
    gap: 10
  },
  energyModeButton: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8
  },
  energyModeLabel: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900"
  },
  energyChipRow: {
    flexDirection: "row",
    gap: 8
  },
  calendarEnergyList: {
    gap: 8
  },
  calendarEnergyButton: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8
  },
  calendarEnergyText: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20
  },
  letterPaperList: {
    gap: 8
  },
  letterPaperButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8
  },
  paperPreview: {
    position: "relative",
    width: 42,
    height: 54,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 6,
    backgroundColor: "#fff"
  },
  miniClover: {
    position: "absolute",
    width: 22,
    height: 20,
    opacity: 0.72
  },
  miniCloverLeaf: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 999
  },
  miniCloverTopLeaf: {
    top: 0,
    left: 5
  },
  miniCloverLeftLeaf: {
    top: 8,
    left: 1
  },
  miniCloverRightLeaf: {
    top: 8,
    right: 1
  },
  miniCloverBottomLeaf: {
    bottom: 0,
    left: 5
  },
  paperCloverTop: {
    top: 4,
    right: 4
  },
  paperCloverBottom: {
    bottom: 5,
    left: 4
  },
  paperSplitPreview: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 7,
    height: 25,
    borderRadius: 6
  },
  letterPaperTextWrap: {
    flex: 1,
    gap: 4
  },
  paperDescription: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "700"
  }
});
