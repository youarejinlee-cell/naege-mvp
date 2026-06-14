import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { themePalettes } from "../lib/theme";
import { ColorTheme, LetterPaperStyle, Mood } from "../types/domain";

type Props = {
  theme: ColorTheme;
  targetMoods: Mood[];
  letterPaperStyle: LetterPaperStyle;
  onChangeTheme: (theme: ColorTheme) => void;
  onChangeTargetMoods: (moods: Mood[]) => void;
  onChangeLetterPaperStyle: (style: LetterPaperStyle) => void;
};

const positiveMoodOptions: Array<{ key: Mood; label: string }> = [
  { key: "calm", label: "😌 차분함" },
  { key: "joy", label: "😊 좋음" },
  { key: "moved", label: "🥹 뭉클함" },
  { key: "recovered", label: "🌱 회복됨" },
  { key: "happy", label: "😄 행복함" },
  { key: "delight", label: "😁 기쁨" },
  { key: "excited", label: "💓 설렘" },
  { key: "fun", label: "😆 재밌음" },
  { key: "hopeful", label: "🌤️ 희망적임" },
  { key: "grateful", label: "🙏 고마움" },
  { key: "proud", label: "✨ 뿌듯함" },
  { key: "peaceful", label: "🕊️ 평화로움" },
  { key: "lucky", label: "🍀 행운" },
  { key: "selfEsteem", label: "💪 자존감상승" }
];

const letterPaperOptions: Array<{ key: LetterPaperStyle; label: string; description: string }> = [
  { key: "plain", label: "무지", description: "가장 조용한 기본 편지지" },
  { key: "themeBorder", label: "편지지 테두리", description: "현재 테마색 테두리 편지지" },
  { key: "cloudTitle", label: "제목+내용 분리", description: "내용을 둥근 박스로 정리" },
  { key: "clover", label: "클로버 무늬", description: "세잎클로버 틈바구니에 숨어 있는 네잎클로버 하나" }
];

export function AppSettingsScreen({
  theme,
  targetMoods,
  letterPaperStyle,
  onChangeTheme,
  onChangeTargetMoods,
  onChangeLetterPaperStyle
}: Props) {
  const currentTheme = themePalettes[theme];
  const toggleTargetMood = (mood: Mood) => {
    if (targetMoods.includes(mood)) {
      onChangeTargetMoods(targetMoods.filter((item) => item !== mood));
      return;
    }
    if (targetMoods.length >= 3) return;
    onChangeTargetMoods([...targetMoods, mood]);
  };

  return (
    <Screen eyebrow="Settings" title="설정">
      <View style={[styles.panel, { borderColor: currentTheme.border, backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>추구 감정</Text>
        <Text style={[styles.description, { color: currentTheme.muted }]}>네가 가장 느끼고 싶은 감정을 골라줘. 모아보기에서 가장 먼저 확인하게 해둘게</Text>
        <View style={styles.moodWrap}>
          {positiveMoodOptions.map((mood) => {
            const active = targetMoods.includes(mood.key);
            const disabled = !active && targetMoods.length >= 3;
            return (
              <Pressable
                key={mood.key}
                disabled={disabled}
                style={[
                  styles.moodChip,
                  { borderColor: currentTheme.border, backgroundColor: currentTheme.cardAlt },
                  active && { borderColor: currentTheme.tint, backgroundColor: currentTheme.soft, borderWidth: 2 },
                  disabled && styles.disabledChip
                ]}
                onPress={() => toggleTargetMood(mood.key)}
              >
                <Text style={[styles.moodText, { color: currentTheme.text }, active && { color: currentTheme.tint }, disabled && styles.disabledText]}>{mood.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.panel, { borderColor: currentTheme.border, backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>컬러 테마</Text>
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
              <View style={[styles.themeSwatch, { backgroundColor: themePalettes[key].tint, borderColor: themePalettes[key].border }]} />
              <Text style={[styles.themeButtonText, { color: key === "black" ? "#f4f4f4" : "#18241b" }]}>{themePalettes[key].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.panel, { borderColor: currentTheme.border, backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>편지지 디자인</Text>
        <View style={styles.letterPaperList}>
          {letterPaperOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.letterPaperButton,
                { borderColor: currentTheme.border, backgroundColor: currentTheme.cardAlt },
                letterPaperStyle === option.key && { borderColor: currentTheme.tint, backgroundColor: currentTheme.soft, borderWidth: 2 }
              ]}
              onPress={() => onChangeLetterPaperStyle(option.key)}
            >
              <View style={[styles.paperPreview, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }, option.key !== "plain" && { borderColor: currentTheme.tint }]}>
                {option.key === "clover" ? (
                  <>
                    <MiniClover color={currentTheme.tint} style={styles.paperCloverTop} />
                    <MiniClover color={currentTheme.tint} style={styles.paperCloverBottom} />
                  </>
                ) : null}
                {option.key === "cloudTitle" ? <View style={[styles.paperSplitPreview, { backgroundColor: currentTheme.soft }]} /> : null}
              </View>
              <View style={styles.letterPaperTextWrap}>
                <Text style={[styles.energyModeLabel, { color: currentTheme.text }]}>{option.label}</Text>
                <Text style={[styles.paperDescription, { color: currentTheme.muted }]}>{option.description}</Text>
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
  description: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  moodWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  moodChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999
  },
  moodText: {
    color: "#253027",
    fontSize: 12,
    fontWeight: "900"
  },
  disabledChip: {
    opacity: 0.4
  },
  disabledText: {
    color: "#9aa39a"
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
    borderWidth: 1,
    borderRadius: 999
  },
  themeButtonText: {
    color: "#18241b",
    fontWeight: "900"
  },
  energyModeLabel: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900"
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
