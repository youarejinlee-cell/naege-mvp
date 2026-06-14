import { useRef, useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Screen } from "../components/Screen";
import { normalizeEnergyPercent } from "../lib/energyColors";
import { AppTheme, useAppTheme } from "../lib/theme";
import { Entry, Letter, LetterPaperStyle, Mood } from "../types/domain";

declare const require: <T = unknown>(moduleName: string) => T;

type Props = {
  entries: Entry[];
  letters: Letter[];
  letterPaperStyle: LetterPaperStyle;
  onSavePostscript: (letterId: string, postscript: string) => void;
};

const moodLabels: Record<Mood, string> = {
  calm: "😌 차분함",
  joy: "😊 좋음",
  moved: "🥹 뭉클함",
  recovered: "🌱 회복됨",
  happy: "😄 행복함",
  delight: "😁 기쁨",
  excited: "💓 설렘",
  fun: "😆 재밌음",
  hopeful: "🌤️ 희망적임",
  grateful: "🙏 고마움",
  proud: "✨ 뿌듯함",
  peaceful: "🕊️ 평화로움",
  lucky: "🍀 행운",
  selfEsteem: "💪 자존감상승",
  soSo: "😐 그저 그럼",
  indifferent: "😶 무덤덤함",
  curious: "🧐 궁금함",
  accepting: "🤲 받아들임",
  reflective: "🪞 반성함",
  envious: "🫧 부러움",
  instructive: "📌 교훈적임",
  difficult: "🧩 어려움",
  anxious: "😟 불안함",
  worried: "😥 걱정됨",
  tired: "😮‍💨 피곤함",
  sad: "😔 가라앉음",
  depressed: "🌧️ 우울함",
  angry: "😤 날카로움",
  irritated: "😒 짜증남",
  jealous: "🫣 질투",
  prideHurt: "😣 자존심상함",
  sensitive: "🫨 예민함",
  regret: "😞 후회됨",
  blank: "🫠 멍함",
  complex: "🤔 복잡함"
};

const positiveMoods = new Set<Mood>([
  "calm",
  "joy",
  "moved",
  "recovered",
  "happy",
  "delight",
  "excited",
  "fun",
  "hopeful",
  "grateful",
  "proud",
  "peaceful",
  "lucky",
  "selfEsteem"
]);

const negativeMoods = new Set<Mood>([
  "anxious",
  "worried",
  "tired",
  "sad",
  "depressed",
  "angry",
  "irritated",
  "jealous",
  "prideHurt",
  "sensitive",
  "regret"
]);

type MoodCategory = "positive" | "neutral" | "negative";

function moodCategory(mood: Mood): MoodCategory {
  if (positiveMoods.has(mood)) return "positive";
  if (negativeMoods.has(mood)) return "negative";
  return "neutral";
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getMoodCategoryColors(theme: AppTheme) {
  return {
    positive: theme.tint,
    neutral: rgba(theme.tint, 0.52),
    negative: rgba(theme.tint, 0.2)
  };
}

function dateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = dateKey(value).split("-");
  return `${Number(year)}년 ${Number(month)}월`;
}

function truncateArchiveTitle(value: string) {
  return value.length > 9 ? `${value.slice(0, 9)}...` : value;
}

function archiveTitle(letter: Letter) {
  if (letter.id === "letter-2026-06-08") return "작게 해낸 날들";
  return truncateArchiveTitle(letter.keyword);
}

function formatDateLabel(value: string) {
  const [year, month, day] = dateKey(value).split("-");
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatTimeLabel(value: string) {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 || 12;
  return `${period} ${displayHour}시 ${String(minutes).padStart(2, "0")}분`;
}

function formatPeriodLabel(value: string) {
  return value
    .split("~")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(formatDateLabel)
    .join(" ~ ");
}

function splitPeriod(value: string) {
  const [start, end] = value.split("~").map((part) => part.trim());
  return { start, end };
}

function entriesForLetterPeriod(entries: Entry[], letter: Letter) {
  const { start, end } = splitPeriod(letter.periodLabel);
  return entries.filter((entry) => {
    const key = dateKey(entry.createdAt);
    return key >= start && key <= end;
  });
}

function getDayEnergyStats(entries: Entry[]) {
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = dateKey(entry.createdAt);
    acc[key] = [...(acc[key] || []), entry];
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, dayEntries]) => {
    const energies = dayEntries.map((entry) => normalizeEnergyPercent(entry.energy));
    return {
      date,
      average: energies.reduce((sum, energy) => sum + energy, 0) / energies.length,
      max: Math.max(...energies),
      min: Math.min(...energies)
    };
  });
}

function getMoodRanking(entries: Entry[]) {
  const ranking = entries.reduce<Record<Mood, { count: number; latest: number }>>((acc, entry) => {
    const latest = new Date(entry.createdAt).getTime();
    const current = acc[entry.mood];
    acc[entry.mood] = {
      count: (current?.count || 0) + 1,
      latest: Math.max(current?.latest || 0, latest)
    };
    return acc;
  }, {} as Record<Mood, { count: number; latest: number }>);

  return Object.entries(ranking)
    .sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest)
    .slice(0, 3)
    .map(([mood, value]) => ({
      mood: mood as Mood,
      count: value.count
    }));
}

function summarize(entries: Entry[]) {
  const moodRanking = getMoodRanking(entries);
  const dayStats = getDayEnergyStats(entries);

  if (!entries.length) {
    return {
      count: "0개",
      average: "-",
      best: "-",
      lowest: "-",
      moodRanking
    };
  }

  const average = entries.reduce((sum, entry) => sum + normalizeEnergyPercent(entry.energy), 0) / entries.length;
  const bestDay = [...dayStats].sort((a, b) => b.average - a.average || b.max - a.max)[0];
  const lowestDay = [...dayStats].sort((a, b) => a.average - b.average || a.min - b.min)[0];
  return {
    count: `${entries.length}개`,
    average: `${average.toFixed(1)}%`,
    best: bestDay ? `${formatDateLabel(bestDay.date)} · 평균 ${bestDay.average.toFixed(1)}%` : "-",
    lowest: lowestDay ? `${formatDateLabel(lowestDay.date)} · 평균 ${lowestDay.average.toFixed(1)}%` : "-",
    moodRanking
  };
}

function energyMoodInsights(entries: Entry[]) {
  if (!entries.length) {
    return {
      highPositive: 0,
      highNeutralNegative: 0,
      range: "-"
    };
  }

  const energies = entries.map((entry) => normalizeEnergyPercent(entry.energy));
  const highEnergyEntries = entries.filter((entry) => normalizeEnergyPercent(entry.energy) >= 70);
  return {
    highPositive: highEnergyEntries.filter((entry) => moodCategory(entry.mood) === "positive").length,
    highNeutralNegative: highEnergyEntries.filter((entry) => moodCategory(entry.mood) !== "positive").length,
    range: `${Math.min(...energies)}~${Math.max(...energies)}%`
  };
}

function EnergyMoodChart({ entries }: { entries: Entry[] }) {
  const theme = useAppTheme();
  const moodCategoryColors = getMoodCategoryColors(theme);
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const [selectedId, setSelectedId] = useState(sorted[0]?.id || "");
  const selected = sorted.find((entry) => entry.id === selectedId) || sorted[0];
  const insights = energyMoodInsights(sorted);
  const categoryRows: MoodCategory[] = ["positive", "neutral", "negative"];
  const categoryLabels: Record<MoodCategory, string> = {
    positive: "긍정",
    neutral: "중간",
    negative: "부정"
  };

  return (
    <View style={styles.energyMoodBox}>
      <View style={styles.energyMoodHeader}>
        <Text style={styles.summaryLabel}>감정-에너지 분포</Text>
        <View style={styles.energyMoodLegend}>
          <LegendDot color={moodCategoryColors.positive} label="긍정" />
          <LegendDot color={moodCategoryColors.neutral} label="중간" />
          <LegendDot color={moodCategoryColors.negative} label="부정" />
        </View>
      </View>
      <View style={styles.chartWrap}>
        <View style={styles.chartLabels}>
          {categoryRows.map((category) => (
            <Text key={category} style={styles.chartLabel}>{categoryLabels[category]}</Text>
          ))}
        </View>
        <View style={styles.chartArea}>
          {[0, 1, 2].map((line) => (
            <View key={line} style={[styles.chartGridLine, { top: `${line * 33.333}%` }]} />
          ))}
          {sorted.length ? sorted.map((entry, index) => {
            const category = moodCategory(entry.mood);
            const energy = normalizeEnergyPercent(entry.energy);
            const sameSpotIndex = sorted.slice(0, index).filter((item) => normalizeEnergyPercent(item.energy) === energy && moodCategory(item.mood) === category).length;
            const x = energy;
            const y = category === "positive" ? 16.666 : category === "neutral" ? 50 : 83.333;
            const offsetX = ((sameSpotIndex % 3) - 1) * 4;
            const offsetY = (Math.floor(sameSpotIndex / 3) % 3 - 1) * 4;
            const isSelected = selected?.id === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => setSelectedId(entry.id)}
                style={[
                  styles.chartDot,
                  isSelected && styles.chartDotSelected,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: [{ translateX: offsetX }, { translateY: offsetY }],
                    backgroundColor: moodCategoryColors[category]
                  }
                ]}
              />
            );
          }) : (
            <Text style={styles.chartEmpty}>기록이 없어</Text>
          )}
          <View style={styles.chartXAxis}>
            {[0, 50, 100].map((energy) => (
              <Text key={energy} style={styles.chartAxisNumber}>{energy}</Text>
            ))}
          </View>
        </View>
      </View>
      {selected ? (
        <View style={styles.chartSelectedCard}>
          <View style={styles.chartSelectedMeta}>
            <Text style={styles.chartSelectedMood}>{moodLabels[selected.mood]}</Text>
            <Text style={styles.chartSelectedTime}>{formatDateLabel(selected.createdAt)} · {formatTimeLabel(selected.createdAt)}</Text>
          </View>
          <Text style={styles.chartSelectedEnergy}>쓴 에너지 {normalizeEnergyPercent(selected.energy)}%</Text>
          <Text style={styles.chartSelectedText}>{selected.text}</Text>
        </View>
      ) : null}
      <View style={styles.energyMoodInsightRow}>
        <Text style={styles.energyMoodInsight}>높은 에너지+긍정 {insights.highPositive}개</Text>
        <Text style={styles.energyMoodInsight}>높은 에너지+중간/부정 {insights.highNeutralNegative}개</Text>
        <Text style={styles.energyMoodInsight}>에너지 폭 {insights.range}</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function splitSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .match(/[^.!?。！？…]+[.!?。！？…]+["'”’)]*|[^.!?。！？…]+$/g)
    ?.map((part) => part.trim())
    .filter(Boolean) || [];
}

function splitLongSentence(sentence: string, maxLength: number) {
  if (sentence.length <= maxLength) return [sentence];
  const chunks: string[] = [];
  let rest = sentence;

  while (rest.length > maxLength) {
    const slice = rest.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(","), slice.lastIndexOf("，"), slice.lastIndexOf("、"));
    const index = breakAt > maxLength * 0.45 ? breakAt + 1 : maxLength;
    chunks.push(rest.slice(0, index).trim());
    rest = rest.slice(index).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}

function normalizeLetterParagraphs(body: string) {
  const rawParagraphs = body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const source = rawParagraphs.length > 1 ? rawParagraphs : splitSentences(body);
  const paragraphs: string[] = [];
  let current = "";

  source.forEach((part) => {
    const next = current ? `${current} ${part}` : part;
    if (next.length <= 170 || !current) {
      current = next;
      return;
    }
    paragraphs.push(current);
    current = part;
  });

  if (current) paragraphs.push(current);
  return paragraphs.length ? paragraphs : [body.trim()].filter(Boolean);
}

function splitLetterBody(body: string) {
  const maxLength = 300;
  const paragraphs = normalizeLetterParagraphs(body);
  const pages: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    const candidates = splitLongSentence(paragraph, maxLength);
    candidates.forEach((candidate) => {
      if (!current) {
        current = candidate;
        return;
      }
      if (`${current}\n\n${candidate}`.length <= maxLength) {
        current = `${current}\n\n${candidate}`;
        return;
      }
      pages.push(current);
      current = candidate;
    });
  });

  if (current) pages.push(current);
  return pages.length ? pages : [body];
}

function splitParagraphs(body: string) {
  return body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
}

function letterThemes(letter: Letter) {
  const themes = (letter.themes || []).map((item) => item.trim()).filter(Boolean);
  return themes.length ? themes.slice(0, 3) : [letter.keyword].filter(Boolean);
}

const fallbackSuggestions = [
  "산책 10분 하기",
  "좋아하는 노래 한 곡 듣기",
  "햇볕 15분 쬐기",
  "건강한 음식 한 끼 먹기",
  "가벼운 스트레칭 하기",
  "생각나는 가족이나 친구에게 전화하기"
];

function letterRecommendations(letter: Letter) {
  const recommendations = (letter.recommendations || []).map((item) => item.trim()).filter(Boolean);
  if (recommendations.length) return recommendations.slice(0, 2);
  const seed = Array.from(letter.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [fallbackSuggestions[seed % fallbackSuggestions.length]];
}

function DecorClover({ color, style, opacity, fourLeaf }: { color: string; style?: object; opacity: number; fourLeaf?: boolean }) {
  return (
    <Image
      source={fourLeaf ? require("../../assets/four-leaf-clover-pattern-symbol.png") : require("../../assets/clover-pattern-symbol.png")}
      style={[styles.decorClover, style, { opacity, tintColor: color }]}
      resizeMode="contain"
    />
  );
}

function ArchiveLetterSymbol() {
  return (
    <Image
      source={require("../../assets/letter-archive-icon-3d.png")}
      style={styles.archiveIcon}
      resizeMode="contain"
    />
  );
}

export function InboxScreen({ entries, letters, letterPaperStyle, onSavePostscript }: Props) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<Letter | null>(null);
  const [postscript, setPostscript] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const pageRefs = useRef<Array<View | null>>([]);
  const sorted = [...letters].sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
  const groups = sorted.reduce<Record<string, Letter[]>>((acc, letter) => {
    const key = monthLabel(letter.deliveredAt);
    acc[key] = [...(acc[key] || []), letter];
    return acc;
  }, {});

  if (selected) {
    const pages = splitLetterBody(selected.body);
    const savePage = async (index: number) => {
      const target = pageRefs.current[index];
      if (!target) return false;
      const { captureRef } = require<typeof import("react-native-view-shot")>("react-native-view-shot");
      const MediaLibrary = require<typeof import("expo-media-library")>("expo-media-library");
      const uri = await captureRef(target, {
        format: "png",
        quality: 1,
        result: "tmpfile"
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    };
    const saveLetterImages = async (mode: "current" | "all") => {
      setSavingImage(true);
      setSaveMessage(null);
      try {
        const MediaLibrary = require<typeof import("expo-media-library")>("expo-media-library");
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          setSaveMessage("사진 저장 권한이 필요해.");
          return;
        }
        const indexes = mode === "current" ? [pageIndex] : pages.map((_, index) => index);
        let savedCount = 0;
        for (const index of indexes) {
          if (await savePage(index)) savedCount += 1;
        }
        setSaveMessage(`${savedCount}장의 편지 이미지를 저장했어.`);
      } catch (error) {
        console.warn("Letter image save failed", error);
        setSaveMessage("이미지 저장에 실패했어.");
      } finally {
        setSavingImage(false);
      }
    };

    return (
      <Screen eyebrow="LETTER" title="편지보관함">
        <Pressable style={styles.back} onPress={() => setSelected(null)}>
          <Text style={[styles.backText, { color: theme.tint }]}>← 목록으로</Text>
        </Pressable>
        <>
            <View style={styles.sliderWrap}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const width = event.nativeEvent.layoutMeasurement.width || 1;
                  setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
                }}
              >
                {pages.map((body, index) => (
                  <View key={`${selected.id}-${index}`} style={[styles.slide, { width }]}>
                    <View
                      ref={(node) => {
                        pageRefs.current[index] = node;
                      }}
                      collapsable={false}
                      style={[
                        styles.paper,
                        letterPaperStyle === "themeBorder" && { borderColor: theme.tint, borderWidth: 2 },
                        letterPaperStyle === "clover" && { borderColor: theme.border },
                        letterPaperStyle === "cloudTitle" && { borderColor: theme.border }
                      ]}
                    >
                      {letterPaperStyle === "clover" ? (
                        <>
                          <DecorClover color={theme.tint} style={styles.decorCloverTop} opacity={0.5} />
                          <DecorClover color={theme.tint} style={styles.decorCloverBottom} opacity={0.46} />
                          <DecorClover color={theme.tint} style={styles.decorCloverLeftMid} opacity={0.34} />
                          <DecorClover color={theme.tint} style={styles.decorCloverRightMid} opacity={0.36} />
                          <DecorClover color={theme.tint} style={styles.decorCloverLowerRight} opacity={0.3} />
                          <DecorClover color={theme.tint} style={styles.decorFourLeafHidden} opacity={0.48} fourLeaf />
                        </>
                      ) : null}
                      <View style={styles.titleWrap}>
                        <View style={styles.titleWrap}>
                          <Text
                            style={[styles.letterTitle, { color: theme.tint }]}
                            textBreakStrategy="balanced"
                            lineBreakStrategyIOS="hangul-word"
                          >
                            {selected.title}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.letterMeta}>
                        <Text style={[styles.letterMetaText, { color: theme.muted }]}>받은 날짜 {formatDateLabel(selected.deliveredAt)}</Text>
                        <Text style={[styles.letterMetaText, { color: theme.muted }]}>기록 기간 {formatPeriodLabel(selected.periodLabel)}</Text>
                      </View>
                      <View style={[styles.letterContentArea, letterPaperStyle === "cloudTitle" && { backgroundColor: theme.soft, padding: 16, borderRadius: 8 }]}>
                        <View style={styles.bodyWrap}>
                          {splitParagraphs(body).map((paragraph, paragraphIndex) => (
                            <Text key={`${index}-${paragraphIndex}`} style={styles.body}>{paragraph}</Text>
                          ))}
                        </View>
                        {pages.length > 1 ? (
                          <Text style={[styles.pageCount, { color: theme.tint }]}>{index + 1} / {pages.length}</Text>
                        ) : null}
                        {letterPaperStyle !== "cloudTitle" ? (
                          <View style={styles.letterBrand}>
                            <Image source={require("../../assets/app-icon.png")} style={styles.letterBrandIcon} />
                            <Text style={styles.letterBrandText}>Log to Letter</Text>
                          </View>
                        ) : null}
                      </View>
                      {letterPaperStyle === "cloudTitle" ? (
                        <View style={styles.letterBrand}>
                          <Image source={require("../../assets/app-icon.png")} style={styles.letterBrandIcon} />
                          <Text style={styles.letterBrandText}>Log to Letter</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
              {pages.length > 1 ? (
                <View style={styles.dots}>
                  {pages.map((_, index) => (
                    <View key={index} style={[styles.dot, pageIndex === index && { backgroundColor: theme.tint }]} />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.postscript}>
              <Text style={styles.sectionTitle}>추신</Text>
              <TextInput
                multiline
                value={postscript || selected.postscript || ""}
                onChangeText={setPostscript}
                placeholder="이 편지를 읽고 지금의 내가 남기고 싶은 말을 적어봐."
                style={styles.postscriptInput}
                textAlignVertical="top"
              />
              <Pressable
                style={[styles.save, { backgroundColor: theme.tint }]}
                onPress={() => {
                  onSavePostscript(selected.id, postscript);
                  setSelected({ ...selected, postscript });
                }}
              >
                <Text style={styles.saveText}>저장하기</Text>
              </Pressable>
            </View>
            <View style={styles.shareActions}>
              <Pressable
                disabled={savingImage}
                style={[styles.share, { borderColor: theme.border, backgroundColor: theme.soft }, savingImage && styles.disabledButton]}
                onPress={() => saveLetterImages("all")}
              >
                <Text style={[styles.shareText, { color: theme.tint }]}>{savingImage ? "저장 중" : "편지 내용 이미지로 저장"}</Text>
              </Pressable>
            </View>
            {saveMessage ? <Text style={[styles.saveMessage, { color: theme.tint }]}>{saveMessage}</Text> : null}
        </>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="LETTER" title="편지보관함" lead="지난 날의 네가 보낸 편지를 확인해봐.">
      {sorted.length ? (
        Object.entries(groups).map(([label, items]) => (
          <View key={label} style={styles.group}>
            <Text style={[styles.month, { color: theme.text }]}>{label}</Text>
            <View style={styles.grid}>
              {items.map((letter) => (
                <Pressable key={letter.id} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => {
                  setPostscript(letter.postscript || "");
                  setSelected(letter);
                  setPageIndex(0);
                  setSaveMessage(null);
                }}>
                  <View style={styles.iconFrame}>
                    <ArchiveLetterSymbol />
                  </View>
                  <Text style={[styles.keyword, { color: theme.text }]}>{archiveTitle(letter)}</Text>
                  <Text style={[styles.date, { color: theme.muted }]}>{dateKey(letter.deliveredAt)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={[styles.empty, { color: theme.muted }]}>아직 도착한 편지가 없어.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  backText: {
    color: "#2f8f54",
    fontWeight: "900"
  },
  group: {
    gap: 12
  },
  month: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  card: {
    width: "48%",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  iconFrame: {
    width: 118,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  archiveIcon: {
    width: 112,
    height: 82
  },
  keyword: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    textAlign: "center"
  },
  date: {
    color: "#2f8f54",
    fontSize: 13,
    fontWeight: "900"
  },
  empty: {
    color: "#657064",
    fontSize: 15
  },
  sliderWrap: {
    gap: 10,
    marginHorizontal: -20
  },
  slide: {
    paddingHorizontal: 20
  },
  paper: {
    position: "relative",
    minHeight: 520,
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  titleWrap: {
    position: "relative",
    alignSelf: "flex-start",
    alignItems: "flex-start",
    maxWidth: "100%",
    paddingBottom: 3
  },
  splitTitleArea: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#fff"
  },
  letterContentArea: {
    flex: 1,
    gap: 14,
    padding: 0
  },
  letterTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 29,
    textAlign: "left",
    zIndex: 1
  },
  letterMeta: {
    alignItems: "flex-end",
    gap: 3
  },
  letterMetaText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  body: {
    color: "#253027",
    fontSize: 15,
    lineHeight: 24
  },
  bodyWrap: {
    gap: 10
  },
  summaryBox: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#f1f7ec"
  },
  summaryTop: {
    gap: 6
  },
  analysisTitle: {
    color: "#18241b",
    fontSize: 16,
    fontWeight: "900"
  },
  summaryStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  summaryItem: {
    width: "48%",
    gap: 3,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  summaryItemWide: {
    width: "100%",
    gap: 5,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10
  },
  summaryCell: {
    flex: 1,
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(24, 36, 27, 0.08)"
  },
  summaryLabel: {
    color: "#18241b",
    fontSize: 12,
    fontWeight: "900"
  },
  summaryValue: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  summaryValueSmall: {
    color: "#253027",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800"
  },
  moodRankRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  moodRankChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f4f7ef"
  },
  moodRankText: {
    color: "#253027",
    fontSize: 12,
    fontWeight: "900"
  },
  energyMoodBox: {
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  energyMoodHeader: {
    gap: 8
  },
  energyMoodLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "800"
  },
  chartWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8
  },
  chartLabels: {
    width: 28,
    height: 140,
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  chartLabel: {
    color: "#657064",
    fontSize: 10,
    fontWeight: "900"
  },
  chartArea: {
    flex: 1,
    height: 140,
    position: "relative",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#dfe8da",
    backgroundColor: "#fbfdf8",
    borderRadius: 6,
    overflow: "hidden"
  },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(101, 112, 100, 0.14)"
  },
  chartDot: {
    position: "absolute",
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff"
  },
  chartDotSelected: {
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: "#18241b"
  },
  chartXAxis: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4
  },
  chartAxisNumber: {
    color: "rgba(101, 112, 100, 0.72)",
    fontSize: 9,
    fontWeight: "900"
  },
  chartEmpty: {
    alignSelf: "center",
    marginTop: 52,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800"
  },
  chartSelectedCard: {
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fbfdf8"
  },
  chartSelectedMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  chartSelectedMood: {
    flexShrink: 0,
    color: "#18241b",
    fontSize: 12,
    fontWeight: "900"
  },
  chartSelectedTime: {
    flex: 1,
    color: "#657064",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right"
  },
  chartSelectedEnergy: {
    color: "#2f8f54",
    fontSize: 12,
    fontWeight: "900"
  },
  chartSelectedText: {
    color: "#253027",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  energyMoodInsightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  energyMoodInsight: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f4f7ef",
    color: "#253027",
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden"
  },
  keywordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  keywordPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: "#fff",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden"
  },
  recommendationList: {
    gap: 4
  },
  recommendationText: {
    color: "#253027",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  pageCount: {
    marginTop: "auto",
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "900"
  },
  letterBrand: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8
  },
  letterBrandIcon: {
    width: 18,
    height: 18,
    borderRadius: 4
  },
  letterBrandText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  decorClover: {
    position: "absolute",
    width: 66,
    height: 66
  },
  decorCloverTop: {
    top: 18,
    right: 20,
    transform: [{ rotate: "-7deg" }]
  },
  decorCloverBottom: {
    bottom: 18,
    left: 18,
    transform: [{ rotate: "10deg" }]
  },
  decorCloverLeftMid: {
    top: 164,
    left: -12,
    transform: [{ scale: 0.72 }, { rotate: "14deg" }]
  },
  decorCloverRightMid: {
    top: 270,
    right: -8,
    transform: [{ scale: 0.62 }, { rotate: "-12deg" }]
  },
  decorCloverLowerRight: {
    bottom: 92,
    right: 46,
    transform: [{ scale: 0.5 }, { rotate: "8deg" }]
  },
  decorFourLeafHidden: {
    top: 352,
    left: 72,
    transform: [{ scale: 0.58 }, { rotate: "-10deg" }]
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#dfe8da"
  },
  postscript: {
    gap: 10,
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
  postscriptInput: {
    minHeight: 96,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8
  },
  save: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: "#18241b"
  },
  saveText: {
    color: "#fff",
    fontWeight: "900"
  },
  shareActions: {
    gap: 8
  },
  share: {
    alignItems: "center",
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  shareText: {
    color: "#18241b",
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  saveMessage: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  }
});
