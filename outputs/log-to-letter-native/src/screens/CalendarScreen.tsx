import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { CloverBadge } from "../components/CloverBadge";
import { Screen } from "../components/Screen";
import { categoryForEntry, entryCategoryLabels, entryCategoryOptions } from "../lib/entryCategories";
import { getEnergyLevel, normalizeEnergyPercent } from "../lib/energyColors";
import { AppTheme, useAppTheme } from "../lib/theme";
import { MoodCollectionContent } from "./MoodCollectionScreen";
import { CalendarEnergyMode, EnergyColorMode, Entry, EntryCategory, Mood } from "../types/domain";

type Props = {
  entries: Entry[];
  energyColorMode: EnergyColorMode;
  calendarMode: CalendarEnergyMode;
  targetMoods: Mood[];
  focusDate?: string;
  onDeleteEntries: (entryIds: string[]) => void;
  analysisOnly?: boolean;
};

type ViewMode = "calendar" | "collection";
type SortDirection = "desc" | "asc";
type AnalysisMode = "summary" | "category" | "energy" | "suggestion";
type SummaryFilter =
  | { type: "category"; label: string }
  | { type: "date"; role: "high" | "low"; date: string }
  | { type: "mood"; mood: Mood };

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
type EnergyBin = "low" | "mid" | "high";

function moodCategory(mood: Mood): MoodCategory {
  if (positiveMoods.has(mood)) return "positive";
  if (negativeMoods.has(mood)) return "negative";
  return "neutral";
}

function energyBin(energy: number): EnergyBin {
  if (energy < 30) return "low";
  if (energy < 70) return "mid";
  return "high";
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
  if (theme.isDark) {
    return {
      positive: "#111111",
      neutral: "#555555",
      negative: "#cfcfcf",
      selectedBackground: "rgba(17, 17, 17, 0.1)",
      selectedBorder: "rgba(17, 17, 17, 0.32)"
    };
  }

  return {
    positive: theme.tint,
    neutral: rgba(theme.tint, 0.52),
    negative: rgba(theme.tint, 0.2),
    selectedBackground: rgba(theme.tint, 0.1),
    selectedBorder: rgba(theme.tint, 0.3)
  };
}

function dateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatMonthDayLabel(key: string) {
  const [, month, day] = key.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function formatTimeLabel(value: string) {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 || 12;
  return `${period} ${displayHour}시 ${String(minutes).padStart(2, "0")}분`;
}

function getMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dayItems = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1)
  ];
  const endOffset = (7 - (dayItems.length % 7)) % 7;
  return [
    ...dayItems,
    ...Array.from({ length: endOffset }, () => null)
  ];
}

function entriesByDate(entries: Entry[]) {
  return entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = dateKey(entry.createdAt);
    acc[key] = [...(acc[key] || []), entry];
    return acc;
  }, {});
}

function dayEnergy(entries: Entry[], mode: CalendarEnergyMode) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (mode === "first") return normalizeEnergyPercent(sorted[0].energy);
  if (mode === "last") return normalizeEnergyPercent(sorted[sorted.length - 1].energy);

  const counts = entries.reduce<Record<number, number>>((acc, entry) => {
    const energy = normalizeEnergyPercent(entry.energy);
    acc[energy] = (acc[energy] || 0) + 1;
    return acc;
  }, {});
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0]);
}

function summarize(entries: Entry[]) {
  const moodRanking = getMoodRanking(entries);
  const moodRatio = getMoodCategoryRatio(entries);
  const dayStats = getDayEnergyStats(entries);

  if (!entries.length) {
    return {
      count: "0개",
      average: "-",
      best: "-",
      bestDate: null,
      lowest: "-",
      lowestDate: null,
      moodRanking,
      moodRatio
    };
  }

  const average = entries.reduce((sum, entry) => sum + normalizeEnergyPercent(entry.energy), 0) / entries.length;
  const bestDay = [...dayStats].sort((a, b) => b.average - a.average || b.max - a.max)[0];
  const lowestDay = [...dayStats].sort((a, b) => a.average - b.average || a.min - b.min)[0];
  return {
    count: `${entries.length}개`,
    average: `${average.toFixed(1)}%`,
    best: bestDay ? `${formatMonthDayLabel(bestDay.date)} · 평균 ${bestDay.average.toFixed(1)}%` : "-",
    bestDate: bestDay?.date || null,
    lowest: lowestDay ? `${formatMonthDayLabel(lowestDay.date)} · 평균 ${lowestDay.average.toFixed(1)}%` : "-",
    lowestDate: lowestDay?.date || null,
    moodRanking,
    moodRatio
  };
}

function getMoodCategoryRatio(entries: Entry[]) {
  const counts = entries.reduce<Record<MoodCategory, number>>((acc, entry) => {
    const category = moodCategory(entry.mood);
    acc[category] += 1;
    return acc;
  }, { positive: 0, neutral: 0, negative: 0 });

  return {
    positive: counts.positive,
    neutral: counts.neutral,
    negative: counts.negative,
    total: entries.length
  };
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

function categoryRanking(entries: Entry[]) {
  const counts = entries.reduce<Record<EntryCategory, { count: number; latest: number }>>((acc, entry) => {
    const category = categoryForEntry(entry);
    if (!category) return acc;
    const latest = new Date(entry.createdAt).getTime();
    const current = acc[category] || { count: 0, latest: 0 };
    acc[category] = {
      count: current.count + 1,
      latest: Math.max(current.latest, latest)
    };
    return acc;
  }, {} as Record<EntryCategory, { count: number; latest: number }>);

  return entryCategoryOptions
    .map((option) => ({
      label: entryCategoryLabels[option.key],
      count: counts[option.key]?.count || 0,
      latest: counts[option.key]?.latest || 0
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .slice(0, 3)
    .map((item) => item.label);
}

function sameSummaryFilter(left: SummaryFilter | null, right: SummaryFilter) {
  if (!left || left.type !== right.type) return false;
  if (left.type === "category" && right.type === "category") return left.label === right.label;
  if (left.type === "date" && right.type === "date") return left.role === right.role && left.date === right.date;
  if (left.type === "mood" && right.type === "mood") return left.mood === right.mood;
  return false;
}

function summaryFilterTitle(filter: SummaryFilter | null) {
  if (!filter) return "";
  if (filter.type === "category") return `${filter.label} 기록`;
  if (filter.type === "date") return filter.role === "high" ? "에너지를 많이 소진한 날의 기록" : "에너지를 아낀 날의 기록";
  return `${moodLabels[filter.mood]} 기록`;
}

function entriesForSummaryFilter(entries: Entry[], filter: SummaryFilter | null) {
  if (!filter) return [];
  return entries
    .filter((entry) => {
      if (filter.type === "category") {
        const category = categoryForEntry(entry);
        return category ? entryCategoryLabels[category] === filter.label : false;
      }
      if (filter.type === "date") return dateKey(entry.createdAt) === filter.date;
      return entry.mood === filter.mood;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function categoryDistribution(entries: Entry[]) {
  const counts = entries.reduce<Record<EntryCategory, {
    count: number;
    latest: number;
    energySum: number;
    positive: number;
    neutral: number;
    negative: number;
  }>>((acc, entry) => {
    const category = categoryForEntry(entry);
    if (!category) return acc;
    const latest = new Date(entry.createdAt).getTime();
    const current = acc[category] || { count: 0, latest: 0, energySum: 0, positive: 0, neutral: 0, negative: 0 };
    const moodType = moodCategory(entry.mood);
    acc[category] = {
      count: current.count + 1,
      latest: Math.max(current.latest, latest),
      energySum: current.energySum + normalizeEnergyPercent(entry.energy),
      positive: current.positive + (moodType === "positive" ? 1 : 0),
      neutral: current.neutral + (moodType === "neutral" ? 1 : 0),
      negative: current.negative + (moodType === "negative" ? 1 : 0)
    };
    return acc;
  }, {} as Record<EntryCategory, { count: number; latest: number; energySum: number; positive: number; neutral: number; negative: number }>);

  const total = Object.values(counts).reduce((sum, item) => sum + item.count, 0);
  const items = entryCategoryOptions
    .map((option, index) => ({
      key: option.key,
      label: entryCategoryLabels[option.key],
      count: counts[option.key]?.count || 0,
      latest: counts[option.key]?.latest || 0,
      averageEnergy: counts[option.key]?.count ? counts[option.key].energySum / counts[option.key].count : 0,
      positive: counts[option.key]?.positive || 0,
      neutral: counts[option.key]?.neutral || 0,
      negative: counts[option.key]?.negative || 0
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || b.latest - a.latest);

  return { total, items };
}

const fallbackSuggestions = [
  "산책 10분 하기",
  "좋아하는 노래 한 곡 듣기",
  "햇볕 15분 쬐기",
  "건강한 음식 한 끼 먹기",
  "가벼운 스트레칭 하기",
  "생각나는 가족이나 친구에게 전화하기"
];

function analysisSuggestions(entries: Entry[]) {
  if (!entries.length) return ["기록 하나 남겨보기"];
  const average = entries.reduce((sum, entry) => sum + normalizeEnergyPercent(entry.energy), 0) / entries.length;
  const negativeCount = entries.filter((entry) => moodCategory(entry.mood) === "negative").length;
  const positiveCount = entries.filter((entry) => moodCategory(entry.mood) === "positive").length;

  if (average >= 70 && negativeCount > positiveCount) return ["사용한 에너지가 큰 순간 전후로 기록 돌아보기"];
  if (average <= 40) return ["에너지를 아낀 날에 무엇을 덜 했는지 보기"];
  if (positiveCount > negativeCount) return ["긍정 감정이 나온 상황 한 번 더 만들기"];
  return [fallbackSuggestions[entries.length % fallbackSuggestions.length]];
}

function EnergyMoodChart({ entries }: { entries: Entry[] }) {
  const theme = useAppTheme();
  const moodCategoryColors = getMoodCategoryColors(theme);
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const [selectedBin, setSelectedBin] = useState<{ category: MoodCategory; energyBin: EnergyBin }>({
    category: "positive",
    energyBin: "high"
  });
  const insights = energyMoodInsights(sorted);
  const categoryRows: MoodCategory[] = ["positive", "neutral", "negative"];
  const categoryLabels: Record<MoodCategory, string> = {
    positive: "긍정",
    neutral: "중간",
    negative: "부정"
  };
  const energyBins: Array<{ key: EnergyBin; label: string; left: number; width: number }> = [
    { key: "low", label: "0~30 미만", left: 0, width: 30 },
    { key: "mid", label: "30~70 미만", left: 30, width: 40 },
    { key: "high", label: "70 이상", left: 70, width: 30 }
  ];
  const selectedEntries = selectedBin
    ? sorted
      .filter((entry) => moodCategory(entry.mood) === selectedBin.category && energyBin(normalizeEnergyPercent(entry.energy)) === selectedBin.energyBin)
      .sort((a, b) => normalizeEnergyPercent(b.energy) - normalizeEnergyPercent(a.energy) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return (
    <View style={styles.energyMoodBox}>
      <View style={styles.energyMoodLegend}>
        <LegendDot color={moodCategoryColors.positive} label="긍정" />
        <LegendDot color={moodCategoryColors.neutral} label="중간" />
        <LegendDot color={moodCategoryColors.negative} label="부정" />
      </View>
      <View style={styles.chartBlock}>
        <View style={styles.chartWrap}>
          <View style={styles.chartLabels}>
            {categoryRows.map((category) => (
              <Text key={category} style={styles.chartLabel}>{categoryLabels[category]}</Text>
            ))}
          </View>
          <View style={styles.chartArea}>
            {[33.333, 66.666].map((top) => (
              <View key={`h-${top}`} style={[styles.chartGridLine, { top: `${top}%` }]} />
            ))}
            {[30, 70].map((left) => (
              <View key={`v-${left}`} style={[styles.chartGridColumn, { left: `${left}%` }]} />
            ))}
            {categoryRows.map((category, rowIndex) => (
              energyBins.map((bin) => {
                const selected = selectedBin?.category === category && selectedBin.energyBin === bin.key;
                const count = sorted.filter((entry) => moodCategory(entry.mood) === category && energyBin(normalizeEnergyPercent(entry.energy)) === bin.key).length;
                return (
                  <Pressable
                    key={`${category}-${bin.key}`}
                    style={[
                      styles.chartRegion,
                      {
                        left: `${bin.left}%`,
                        top: `${rowIndex * 33.333}%`,
                        width: `${bin.width}%`,
                        height: "33.333%"
                      },
                      selected && {
                        backgroundColor: moodCategoryColors.selectedBackground,
                        borderColor: moodCategoryColors.selectedBorder
                      }
                    ]}
                    onPress={() => setSelectedBin({ category, energyBin: bin.key })}
                  >
                    <Text style={styles.chartRegionCount}>{count}</Text>
                  </Pressable>
                );
              })
            ))}
            {sorted.length ? sorted.map((entry, index) => {
              const category = moodCategory(entry.mood);
              const energy = normalizeEnergyPercent(entry.energy);
              const sameSpotIndex = sorted.slice(0, index).filter((item) => normalizeEnergyPercent(item.energy) === energy && moodCategory(item.mood) === category).length;
              const x = energy;
              const y = category === "positive" ? 16.666 : category === "neutral" ? 50 : 83.333;
              const offsetX = ((sameSpotIndex % 3) - 1) * 4;
              const offsetY = (Math.floor(sameSpotIndex / 3) % 3 - 1) * 4;
              return (
                <View
                  key={entry.id}
                  pointerEvents="none"
                  style={[
                    styles.chartDot,
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
          </View>
        </View>
        <View style={styles.chartXAxisRow}>
          <View style={styles.chartXAxisSpacer} />
          <View style={styles.chartXAxis}>
            {[0, 30, 70, 100].map((energy) => (
              <Text key={energy} style={[styles.chartAxisNumber, { left: `${energy}%` }]}>{energy}</Text>
            ))}
          </View>
        </View>
      </View>
      {selectedBin ? (
        <View style={styles.chartSelectedCard}>
          <Text style={styles.chartSelectedTitle}>
            {categoryLabels[selectedBin.category]} · {energyBins.find((bin) => bin.key === selectedBin.energyBin)?.label}
          </Text>
          {selectedEntries.length ? selectedEntries.map((entry) => (
            <View key={entry.id} style={styles.chartSelectedEntry}>
              <View style={styles.chartSelectedMeta}>
                <Text style={styles.chartSelectedMood}>{moodLabels[entry.mood]}</Text>
                <Text style={styles.chartSelectedTime}>{formatMonthDayLabel(dateKey(entry.createdAt))} · {formatTimeLabel(entry.createdAt)}</Text>
              </View>
              <Text style={[styles.chartSelectedEnergy, { color: moodCategoryColors[moodCategory(entry.mood)] }]}>쓴 에너지 {normalizeEnergyPercent(entry.energy)}%</Text>
              <Text style={styles.chartSelectedText}>{entry.text}</Text>
            </View>
          )) : (
            <Text style={styles.chartSelectedText}>이 구역에 해당하는 기록이 없어.</Text>
          )}
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

function CategoryDistributionCard({ entries }: { entries: Entry[] }) {
  const theme = useAppTheme();
  const moodCategoryColors = getMoodCategoryColors(theme);
  const { width } = useWindowDimensions();
  const distribution = categoryDistribution(entries);
  const slideWidth = Math.max(width - 92, 260);
  const energyItems = [...distribution.items].sort((a, b) => b.averageEnergy - a.averageEnergy || b.count - a.count);
  const moodRatioItems = [...distribution.items].sort((a, b) => {
    const positiveRatioA = a.count ? a.positive / a.count : 0;
    const positiveRatioB = b.count ? b.positive / b.count : 0;
    return positiveRatioB - positiveRatioA || b.positive - a.positive || b.count - a.count || b.latest - a.latest;
  });
  const totalAverageEnergy = energyItems.reduce((sum, item) => sum + item.averageEnergy, 0);
  const totalMoodCounts = distribution.items.reduce(
    (totals, item) => ({
      positive: totals.positive + item.positive,
      neutral: totals.neutral + item.neutral,
      negative: totals.negative + item.negative
    }),
    { positive: 0, neutral: 0, negative: 0 }
  );
  const totalPositive = distribution.total ? Math.round((totalMoodCounts.positive / distribution.total) * 100) : 0;
  const totalNeutral = distribution.total ? Math.round((totalMoodCounts.neutral / distribution.total) * 100) : 0;
  const totalNegative = distribution.total ? Math.max(0, 100 - totalPositive - totalNeutral) : 0;

  return (
    <View style={styles.categoryChartBox}>
      {distribution.items.length ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={slideWidth + 10}
          contentContainerStyle={styles.categorySlides}
        >
          <View style={[styles.categorySlide, { width: slideWidth }]}>
            <Text style={styles.categorySlideTitle}>개수/비율 분석</Text>
            <View style={styles.categoryLegendHeader}>
              <View style={styles.categoryRankSpacer} />
              <Text style={[styles.categoryLegendHeadText, styles.categoryLegendLabel]}>카테고리</Text>
              <View style={styles.categoryLegendMetricWide}>
                <Text style={[styles.categoryLegendHeadText, styles.categoryLegendMetricHalf]}>개수</Text>
                <Text style={[styles.categoryLegendHeadText, styles.categoryLegendMetricHalf]}>비율</Text>
              </View>
            </View>
            {distribution.items.map((item, index) => (
              <View key={item.key} style={styles.categoryLegendItem}>
                <View style={[styles.categoryRankBadge, { backgroundColor: "#111111" }]}>
                  <Text style={styles.categoryRankText}>{index + 1}</Text>
                </View>
                <Text style={styles.categoryLegendLabel} numberOfLines={1}>{item.label}</Text>
                <View style={styles.categoryLegendMetricWide}>
                  <Text style={styles.categoryLegendMetricHalf}>{item.count}개</Text>
                  <Text style={styles.categoryLegendMetricHalf}>{Math.round((item.count / distribution.total) * 100)}%</Text>
                </View>
              </View>
            ))}
            <View style={[styles.categoryLegendItem, styles.categoryTotalRow]}>
              <View style={styles.categoryRankSpacer} />
              <Text style={styles.categoryLegendLabel}>합계</Text>
              <View style={styles.categoryLegendMetricWide}>
                <Text style={styles.categoryLegendMetricHalf}>{distribution.total}개</Text>
                <Text style={styles.categoryLegendMetricHalf}>100%</Text>
              </View>
            </View>
          </View>

          <View style={[styles.categorySlide, { width: slideWidth }]}>
            <Text style={styles.categorySlideTitle}>에너지 사용 분석</Text>
            <View style={styles.categoryLegendHeader}>
              <View style={styles.categoryRankSpacer} />
              <Text style={[styles.categoryLegendHeadText, styles.categoryLegendLabel]}>카테고리</Text>
              <View style={styles.categoryLegendMetricWide}>
                <Text style={[styles.categoryLegendHeadText, styles.categoryLegendMetricHalf]}>평균 에너지</Text>
                <Text style={[styles.categoryLegendHeadText, styles.categoryLegendMetricHalf]}>차지 비중</Text>
              </View>
            </View>
            {energyItems.map((item, index) => (
              <View key={item.key} style={styles.categoryLegendItem}>
                <View style={[styles.categoryRankBadge, { backgroundColor: "#111111" }]}>
                  <Text style={styles.categoryRankText}>{index + 1}</Text>
                </View>
                <Text style={styles.categoryLegendLabel}>{item.label}</Text>
                <View style={styles.categoryLegendMetricWide}>
                  <Text style={styles.categoryLegendMetricHalf}>{item.averageEnergy.toFixed(0)}%</Text>
                  <Text style={styles.categoryLegendMetricHalf}>
                    {totalAverageEnergy ? Math.round((item.averageEnergy / totalAverageEnergy) * 100) : 0}%
                  </Text>
                </View>
              </View>
            ))}
            <View style={[styles.categoryLegendItem, styles.categoryTotalRow]}>
              <View style={styles.categoryRankSpacer} />
              <Text style={styles.categoryLegendLabel}>합계</Text>
              <View style={styles.categoryLegendMetricWide}>
                <Text style={styles.categoryLegendMetricHalf}>{totalAverageEnergy.toFixed(0)}%</Text>
                <Text style={styles.categoryLegendMetricHalf}>100%</Text>
              </View>
            </View>
          </View>

          <View style={[styles.categorySlide, { width: slideWidth }]}>
            <Text style={styles.categorySlideTitle}>감정 비율 분석</Text>
            <View style={styles.categoryLegendHeader}>
              <View style={styles.categoryRankSpacer} />
              <Text style={[styles.categoryLegendHeadText, styles.categoryLegendLabel]}>카테고리</Text>
              <View style={styles.categoryLegendMetricWide}>
                <Text style={[styles.categoryLegendHeadText, styles.categoryLegendMetricFull]}>감정 비율</Text>
              </View>
            </View>
            {moodRatioItems.map((item, index) => {
              const positive = item.count ? Math.round((item.positive / item.count) * 100) : 0;
              const neutral = item.count ? Math.round((item.neutral / item.count) * 100) : 0;
              const negative = item.count ? Math.max(0, 100 - positive - neutral) : 0;
              return (
                <View key={item.key} style={styles.categoryLegendItem}>
                  <View style={[styles.categoryRankBadge, { backgroundColor: "#111111" }]}>
                    <Text style={styles.categoryRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.categoryLegendLabel}>{item.label}</Text>
                  <View style={styles.categoryLegendMoodMetricWide}>
                    <View style={styles.categoryLegendMoodBar}>
                      <View
                        style={[
                          styles.categoryMoodRatioSegment,
                          { flex: item.positive || 0.0001, backgroundColor: moodCategoryColors.positive }
                        ]}
                      />
                      <View
                        style={[
                          styles.categoryMoodRatioSegment,
                          { flex: item.neutral || 0.0001, backgroundColor: moodCategoryColors.neutral }
                        ]}
                      />
                      <View
                        style={[
                          styles.categoryMoodRatioSegment,
                          { flex: item.negative || 0.0001, backgroundColor: moodCategoryColors.negative }
                        ]}
                      />
                    </View>
                    <Text style={styles.categoryMoodRatioText}>긍 {positive}% · 중 {neutral}% · 부 {negative}%</Text>
                  </View>
                </View>
              );
            })}
            <View style={[styles.categoryLegendItem, styles.categoryTotalRow]}>
              <View style={styles.categoryRankSpacer} />
              <Text style={styles.categoryLegendLabel}>전체</Text>
              <View style={styles.categoryLegendMoodMetricWide}>
                <View style={styles.categoryLegendMoodBar}>
                  <View
                    style={[
                      styles.categoryMoodRatioSegment,
                      { flex: totalMoodCounts.positive || 0.0001, backgroundColor: moodCategoryColors.positive }
                    ]}
                  />
                  <View
                    style={[
                      styles.categoryMoodRatioSegment,
                      { flex: totalMoodCounts.neutral || 0.0001, backgroundColor: moodCategoryColors.neutral }
                    ]}
                  />
                  <View
                    style={[
                      styles.categoryMoodRatioSegment,
                      { flex: totalMoodCounts.negative || 0.0001, backgroundColor: moodCategoryColors.negative }
                    ]}
                  />
                </View>
                <Text style={styles.categoryMoodRatioText}>긍 {totalPositive}% · 중 {totalNeutral}% · 부 {totalNegative}%</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.categoryLegendEmpty}>기록이 쌓이면 카테고리 비중이 보여.</Text>
      )}
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

export function CalendarScreen({ entries, energyColorMode, calendarMode, targetMoods, focusDate, onDeleteEntries, analysisOnly }: Props) {
  const theme = useAppTheme();
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries]
  );
  const initialDate = sortedEntries[0]?.createdAt ? new Date(sortedEntries[0].createdAt) : new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("summary");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateKey(initialDate));
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  useEffect(() => {
    if (!focusDate) return;
    setSelectedDate(focusDate);
    const [year, month] = focusDate.split("-").map(Number);
    setVisibleMonth(new Date(year, month - 1, 1));
  }, [focusDate]);

  const grouped = useMemo(() => entriesByDate(entries), [entries]);
  const selectedEntries = grouped[selectedDate] || [];
  const monthDays = getMonthDays(visibleMonth);
  const visibleMonthKey = monthKey(visibleMonth);
  const visibleMonthEntries = useMemo(
    () => entries.filter((entry) => dateKey(entry.createdAt).startsWith(visibleMonthKey)),
    [entries, visibleMonthKey]
  );
  const activeSummary = summarize(visibleMonthEntries);
  const activeCategories = categoryRanking(visibleMonthEntries);
  const activeSuggestions = analysisSuggestions(visibleMonthEntries);
  const summaryFilterEntries = useMemo(
    () => entriesForSummaryFilter(visibleMonthEntries, summaryFilter),
    [visibleMonthEntries, summaryFilter]
  );

  useEffect(() => {
    setSummaryFilter(null);
  }, [visibleMonthKey]);

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };
  const goToDate = (key: string | null) => {
    if (!key) return;
    const [year, month] = key.split("-").map(Number);
    setSelectedDate(key);
    setVisibleMonth(new Date(year, month - 1, 1));
    if (!analysisOnly) setViewMode("calendar");
  };
  const toggleSummaryFilter = (filter: SummaryFilter) => {
    setSummaryFilter((current) => (sameSummaryFilter(current, filter) ? null : filter));
  };

  return (
    <Screen
      eyebrow={analysisOnly ? "ANALYSIS" : "CALENDAR"}
      title={analysisOnly ? "분석 보기" : "캘린더"}
      lead={analysisOnly ? "남긴 기록을 여러 각도에서 다시 볼 수 있어." : "그날의 나는 무슨 생각을 했을까?"}
    >
      {!analysisOnly ? (
        <View style={[styles.switcher, { backgroundColor: theme.soft }]}>
          <Pressable style={[styles.switchItem, viewMode === "calendar" && { backgroundColor: theme.card }]} onPress={() => setViewMode("calendar")}>
            <Text style={[styles.switchText, { color: theme.muted }, viewMode === "calendar" && { color: theme.tint }]}>캘린더 보기</Text>
          </Pressable>
          <Pressable style={[styles.switchItem, viewMode === "collection" && { backgroundColor: theme.card }]} onPress={() => setViewMode("collection")}>
            <Text style={[styles.switchText, { color: theme.muted }, viewMode === "collection" && { color: theme.tint }]}>모아보기</Text>
          </Pressable>
        </View>
      ) : null}

      {analysisOnly || viewMode === "calendar" ? (
        <View style={styles.monthPanel}>
          <Pressable style={[styles.arrow, { backgroundColor: theme.soft }]} onPress={() => moveMonth(-1)}>
            <Text style={[styles.arrowText, { color: theme.tint }]}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{monthKey(visibleMonth)}</Text>
          <Pressable style={[styles.arrow, { backgroundColor: theme.soft }]} onPress={() => moveMonth(1)}>
            <Text style={[styles.arrowText, { color: theme.tint }]}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {analysisOnly ? (
        <View style={[styles.analysisBox, { borderColor: theme.border, backgroundColor: theme.soft }]}>
          <View style={[styles.analysisTabs, { backgroundColor: "#fff" }]}>
            {([
              ["summary", "요약"],
              ["category", "기록 카테고리 분석"],
              ["energy", "감정-에너지 분포"],
              ["suggestion", "제안"]
            ] as Array<[AnalysisMode, string]>).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.analysisTabItem, analysisMode === key && { backgroundColor: theme.soft }]}
                onPress={() => setAnalysisMode(key)}
              >
                <Text style={[styles.analysisTabText, analysisMode === key && { color: theme.tint }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {analysisMode === "summary" ? (
            <>
              <SummaryCard
                summary={activeSummary}
                embedded
                padded
                categories={activeCategories}
                categoryTint={theme.tint}
                categoryBorder={theme.border}
                activeFilter={summaryFilter}
                onToggleFilter={toggleSummaryFilter}
              />
              {summaryFilter ? (
                <SummaryFilterResults
                  title={summaryFilterTitle(summaryFilter)}
                  entries={summaryFilterEntries}
                  energyColorMode={energyColorMode}
                />
              ) : null}
            </>
          ) : null}

          {analysisMode === "category" ? (
            <CategoryDistributionCard entries={visibleMonthEntries} />
          ) : null}

          {analysisMode === "energy" ? (
            <>
              <Text style={styles.analysisDescription}>9개로 나뉜 각 영역에 어떤 기록이 있었는지 눌러봐</Text>
              <EnergyMoodChart entries={visibleMonthEntries} />
            </>
          ) : null}

          {analysisMode === "suggestion" ? (
            <View style={styles.suggestionBox}>
              <Text style={styles.summaryLabel}>이번 달 제안</Text>
              <View style={styles.recommendationList}>
                {activeSuggestions.slice(0, 4).map((item) => (
                  <Text key={item} style={styles.recommendationText}>{item}</Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : viewMode === "calendar" ? (
        <>
          <View style={styles.panel}>
            <View style={styles.weekRow}>
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <Text key={day} style={styles.weekday}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {monthDays.map((day, index) => {
                const key = day ? `${monthKey(visibleMonth)}-${String(day).padStart(2, "0")}` : `empty-${index}`;
                const dayEntries = day ? grouped[key] || [] : [];
                const energy = dayEnergy(dayEntries, calendarMode);
                const hasEnergy = energy !== null;
                const selected = key === selectedDate;
                const disabledFuture = Boolean(day && new Date(`${key}T00:00:00`).getTime() > new Date(dateKey(new Date())).getTime());
                const energyLevel = hasEnergy ? getEnergyLevel(energyColorMode, energy, theme.tint) : null;
                const dayColor = disabledFuture ? "#fff" : energyLevel ? energyLevel.color : "#eef1ed";
                const dayTextColor = energyLevel ? energyLevel.textColor : disabledFuture ? "#aeb9ad" : selected ? theme.tint : "#657064";
                const glowColor = "rgba(85, 85, 85, 0.12)";
                return (
                  <Pressable
                    key={key}
                    disabled={!day || disabledFuture}
                    style={styles.dayCell}
                    onPress={() => day && setSelectedDate(key)}
                  >
                    {day ? (
                      <CloverBadge
                        color={dayColor}
                        label={String(day)}
                        textColor={dayTextColor}
                        selected={selected}
                        disabled={disabledFuture}
                        glowColor={glowColor}
                        borderColor={theme.tint}
                        shadowOpacity={selected || disabledFuture ? 0 : 0.28}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <EntryList
            title={`${formatMonthDayLabel(selectedDate)} 기록`}
            entries={selectedEntries}
            compactDate
            energyColorMode={energyColorMode}
            onDeleteEntries={onDeleteEntries}
          />
        </>
      ) : (
        <MoodCollectionContent entries={entries} energyColorMode={energyColorMode} targetMoods={targetMoods} />
      )}
    </Screen>
  );
}

function SummaryCard({
  title,
  summary,
  embedded,
  padded,
  categories = [],
  categoryTint,
  categoryBorder,
  activeFilter,
  onToggleFilter
}: {
  title?: string;
  summary: ReturnType<typeof summarize>;
  embedded?: boolean;
  padded?: boolean;
  categories?: string[];
  categoryTint?: string;
  categoryBorder?: string;
  activeFilter?: SummaryFilter | null;
  onToggleFilter?: (filter: SummaryFilter) => void;
}) {
  const theme = useAppTheme();
  const highFilter = summary.bestDate ? ({ type: "date", role: "high", date: summary.bestDate } as SummaryFilter) : null;
  const lowFilter = summary.lowestDate ? ({ type: "date", role: "low", date: summary.lowestDate } as SummaryFilter) : null;
  const tagColor = theme.isDark ? "#111111" : categoryTint;
  const tagBorder = theme.isDark ? "#4a4a4a" : categoryBorder;
  const selectedTagBackground = theme.isDark ? "#111111" : categoryTint;
  const selectedTagText = theme.isDark ? "#ffffff" : theme.inverseText;
  const highSelected = Boolean(highFilter && sameSummaryFilter(activeFilter || null, highFilter));
  const lowSelected = Boolean(lowFilter && sameSummaryFilter(activeFilter || null, lowFilter));

  return (
    <View style={[styles.summary, embedded && styles.summaryEmbedded, padded && styles.summaryPadded]}>
      {title ? <Text style={styles.summaryTitle}>{title}</Text> : null}
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, styles.summaryMetricLabel]}>기록</Text>
        <Text style={styles.summaryValue}>{summary.count}</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, styles.summaryMetricLabel]}>자주 나타난 카테고리</Text>
        <View style={styles.keywordRow}>
          {categories.length ? categories.map((item) => {
            const filter = { type: "category", label: item } as SummaryFilter;
            const selected = sameSummaryFilter(activeFilter || null, filter);
            return (
              <Pressable key={item} onPress={() => onToggleFilter?.(filter)}>
                <Text
                  style={[
                    styles.keywordPill,
                    tagColor ? { color: tagColor, borderColor: tagBorder } : null,
                    selected && { color: selectedTagText, borderColor: selectedTagBackground, backgroundColor: selectedTagBackground }
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }) : (
            <Text style={styles.summaryValueSmall}>-</Text>
          )}
        </View>
      </View>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>평균 에너지 사용량</Text>
        <Text style={styles.summaryValue}>{summary.average}</Text>
      </View>
      <Pressable
        disabled={!highFilter}
        style={[
          styles.summaryItemWide,
          styles.summaryFilterButton,
          { borderColor: theme.border, backgroundColor: theme.cardAlt },
          highSelected && { borderColor: selectedTagBackground, backgroundColor: selectedTagBackground }
        ]}
        onPress={() => highFilter && onToggleFilter?.(highFilter)}
      >
        <Text style={[styles.summaryLabel, { color: highSelected ? selectedTagText : theme.muted }]}>에너지를 많이 소진한 날</Text>
        <Text style={[styles.summaryValueSmall, { color: highSelected ? selectedTagText : theme.text }]}>{summary.best}</Text>
      </Pressable>
      <Pressable
        disabled={!lowFilter}
        style={[
          styles.summaryItemWide,
          styles.summaryFilterButton,
          { borderColor: theme.border, backgroundColor: theme.cardAlt },
          lowSelected && { borderColor: selectedTagBackground, backgroundColor: selectedTagBackground }
        ]}
        onPress={() => lowFilter && onToggleFilter?.(lowFilter)}
      >
        <Text style={[styles.summaryLabel, { color: lowSelected ? selectedTagText : theme.muted }]}>에너지를 아낀 날</Text>
        <Text style={[styles.summaryValueSmall, { color: lowSelected ? selectedTagText : theme.text }]}>{summary.lowest}</Text>
      </Pressable>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>가장 많았던 감정</Text>
        {summary.moodRanking.length ? (
          <View style={styles.moodRankRow}>
            {summary.moodRanking.map((item) => {
              const filter = { type: "mood", mood: item.mood } as SummaryFilter;
              const selected = sameSummaryFilter(activeFilter || null, filter);
              return (
                <Pressable
                  key={item.mood}
                  style={[
                    styles.moodRankChip,
                    selected && { borderColor: selectedTagBackground, backgroundColor: selectedTagBackground }
                  ]}
                  onPress={() => onToggleFilter?.(filter)}
                >
                  <Text style={[styles.moodRankText, selected && { color: selectedTagText }]}>{moodLabels[item.mood]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.summaryValueSmall}>-</Text>
        )}
      </View>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>감정 분포</Text>
        <MoodRatioBar ratio={summary.moodRatio} />
      </View>
    </View>
  );
}

function SummaryFilterResults({
  title,
  entries,
  energyColorMode
}: {
  title: string;
  entries: Entry[];
  energyColorMode: EnergyColorMode;
}) {
  const theme = useAppTheme();

  return (
    <View style={[styles.summaryResults, { backgroundColor: theme.card }]}>
      <Text style={[styles.summaryResultsTitle, { color: theme.text }]}>{title}</Text>
      {entries.length ? entries.map((entry) => (
        <RecordCard
          key={entry.id}
          entry={entry}
          energyColorMode={energyColorMode}
          dateLabel={`${formatMonthDayLabel(dateKey(entry.createdAt))} · ${formatTimeLabel(entry.createdAt)}`}
        />
      )) : (
        <Text style={[styles.empty, { color: theme.muted }]}>해당 기록이 없어.</Text>
      )}
    </View>
  );
}

function RecordCard({
  entry,
  energyColorMode,
  dateLabel,
  selecting,
  selected,
  onPress
}: {
  entry: Entry;
  energyColorMode: EnergyColorMode;
  dateLabel: string;
  selecting?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const entryEnergy = normalizeEnergyPercent(entry.energy);
  const entryEnergyLevel = getEnergyLevel(energyColorMode, entryEnergy, theme.tint);
  const entryCategory = categoryForEntry(entry);

  return (
    <Pressable
      disabled={!selecting}
      style={[
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.card },
        selecting && styles.cardSelectable,
        selected && { borderColor: theme.tint, backgroundColor: theme.soft }
      ]}
      onPress={onPress}
    >
      <View style={styles.entryMeta}>
        <View style={styles.moodEnergyGroup}>
          {selecting ? (
            <View style={[styles.checkCircle, selected && { borderColor: theme.tint, backgroundColor: theme.tint }]}>
              <Text style={[styles.checkText, { color: theme.inverseText }]}>{selected ? "✓" : ""}</Text>
            </View>
          ) : null}
          {entryCategory ? (
            <Text style={[styles.categoryChip, { color: theme.tint, backgroundColor: theme.soft }]}>{entryCategoryLabels[entryCategory]}</Text>
          ) : null}
          <CloverBadge
            color={entryEnergyLevel.color}
            label={String(entryEnergy)}
            size={25}
            textColor={entryEnergyLevel.textColor}
            shadowOpacity={0.18}
            glowColor="rgba(85, 85, 85, 0.08)"
          />
          <Text style={[styles.mood, { color: theme.text }]}>{moodLabels[entry.mood]}</Text>
        </View>
        <Text style={[styles.date, { color: theme.muted }]}>{dateLabel}</Text>
      </View>
      <Text style={[styles.text, { color: theme.text }]}>{entry.text}</Text>
    </Pressable>
  );
}

function MoodRatioBar({ ratio }: { ratio: ReturnType<typeof getMoodCategoryRatio> }) {
  const theme = useAppTheme();
  const moodCategoryColors = getMoodCategoryColors(theme);

  if (!ratio.total) {
    return <Text style={styles.summaryValueSmall}>-</Text>;
  }

  const items: Array<{ key: MoodCategory; label: string; value: number; color: string }> = [
    { key: "positive", label: "긍정", value: ratio.positive, color: moodCategoryColors.positive },
    { key: "neutral", label: "중간", value: ratio.neutral, color: moodCategoryColors.neutral },
    { key: "negative", label: "부정", value: ratio.negative, color: moodCategoryColors.negative }
  ];

  return (
    <View style={styles.moodRatioBox}>
      <View style={styles.moodRatioBar}>
        {items.map((item) => (
          <View
            key={item.key}
            style={[
              styles.moodRatioSegment,
              {
                flex: item.value || 0.0001,
                backgroundColor: item.color
              }
            ]}
          />
        ))}
      </View>
      <View style={styles.moodRatioLegend}>
        {items.map((item) => (
          <View key={item.key} style={styles.moodRatioLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.moodRatioLegendText}>{item.label} {Math.round((item.value / ratio.total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EntryList({
  title,
  entries,
  compactDate,
  energyColorMode,
  onDeleteEntries
}: {
  title?: string;
  entries: Entry[];
  compactDate?: boolean;
  energyColorMode: EnergyColorMode;
  onDeleteEntries: (entryIds: string[]) => void;
}) {
  const theme = useAppTheme();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const sorted = [...entries].sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    if (compactDate) return left - right;
    return sortDirection === "desc" ? right - left : left - right;
  });

  const toggleSelect = (entryId: string) => {
    setConfirmingDelete(false);
    setSelectedIds((current) => (
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId]
    ));
  };

  const cancelSelect = () => {
    setSelecting(false);
    setSelectedIds([]);
    setConfirmingDelete(false);
  };

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    onDeleteEntries(selectedIds);
    cancelSelect();
  };

  return (
    <View style={styles.list}>
      {title ? (
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.text }]}>{title}</Text>
          {compactDate && sorted.length ? (
            <View style={styles.listActionsInline}>
              {selecting ? (
                <>
                  <Pressable style={styles.textAction} onPress={cancelSelect}>
                    <Text style={[styles.textActionLabel, { color: theme.muted }]}>취소</Text>
                  </Pressable>
                  <Pressable
                    disabled={!selectedIds.length}
                    style={styles.textAction}
                    onPress={() => setConfirmingDelete(true)}
                  >
                    <Text style={[styles.deleteActionLabel, !selectedIds.length && styles.disabledActionLabel]}>삭제</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.textAction}
                  onPress={() => setSelecting(true)}
                >
                  <Text style={[styles.textActionLabel, { color: theme.tint }]}>선택</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      {sorted.length && !compactDate ? (
        <View style={styles.listControlRow}>
          <View style={[styles.orderSwitcher, { backgroundColor: theme.soft }]}>
            <Pressable style={[styles.orderButton, sortDirection === "desc" && styles.orderButtonActive]} onPress={() => setSortDirection("desc")}>
              <Text style={[styles.orderText, sortDirection === "desc" && { color: theme.tint }]}>최신순</Text>
            </Pressable>
            <Pressable style={[styles.orderButton, sortDirection === "asc" && styles.orderButtonActive]} onPress={() => setSortDirection("asc")}>
              <Text style={[styles.orderText, sortDirection === "asc" && { color: theme.tint }]}>오래된순</Text>
            </Pressable>
          </View>
          <View style={styles.listActionsInline}>
            {selecting ? (
              <>
                <Pressable style={styles.textAction} onPress={cancelSelect}>
                  <Text style={[styles.textActionLabel, { color: theme.muted }]}>취소</Text>
                </Pressable>
                <Pressable
                  disabled={!selectedIds.length}
                  style={styles.textAction}
                  onPress={() => setConfirmingDelete(true)}
                >
                  <Text style={[styles.deleteActionLabel, !selectedIds.length && styles.disabledActionLabel]}>삭제</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.textAction}
                onPress={() => setSelecting(true)}
              >
                <Text style={[styles.textActionLabel, { color: theme.tint }]}>선택</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      {confirmingDelete ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>정말로 삭제하시겠습니까?</Text>
          <View style={styles.confirmActions}>
            <Pressable style={[styles.confirmButton, { backgroundColor: theme.tint }]} onPress={deleteSelected}>
              <Text style={styles.confirmPrimaryText}>네</Text>
            </Pressable>
            <Pressable style={styles.confirmButtonSecondary} onPress={() => setConfirmingDelete(false)}>
              <Text style={styles.confirmSecondaryText}>아니오</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {sorted.length ? (
        sorted.map((entry) => (
          <RecordCard
            key={entry.id}
            entry={entry}
            energyColorMode={energyColorMode}
            dateLabel={compactDate ? formatTimeLabel(entry.createdAt) : `${formatDateLabel(dateKey(entry.createdAt))} · ${formatTimeLabel(entry.createdAt)}`}
            selecting={selecting}
            selected={selectedIds.includes(entry.id)}
            onPress={() => toggleSelect(entry.id)}
          />
        ))
      ) : (
        <Text style={[styles.empty, { color: theme.muted }]}>남긴 기록이 없어.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#e7f6df"
  },
  switchItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 7
  },
  switchActive: {
    backgroundColor: "#fff"
  },
  switchText: {
    color: "#657064",
    fontWeight: "900"
  },
  switchTextActive: {
    color: "#2f8f54"
  },
  panel: {
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  monthPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  arrow: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e7f6df"
  },
  arrowText: {
    color: "#2f8f54",
    fontSize: 22,
    fontWeight: "900"
  },
  month: {
    color: "#18241b",
    fontSize: 17,
    fontWeight: "900"
  },
  caption: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "800"
  },
  segment: {
    flexDirection: "row",
    gap: 8
  },
  segmentCompact: {
    flex: 1,
    flexDirection: "row",
    gap: 6
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#f5f8f1"
  },
  segmentActive: {
    backgroundColor: "#2f8f54"
  },
  segmentText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#fff"
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekday: {
    width: "13.7%",
    textAlign: "center",
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 2
  },
  dayCell: {
    width: "13.7%",
    height: 50,
    alignItems: "center",
    justifyContent: "center"
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  summaryEmbedded: {
    marginTop: 2,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#dfe8da",
    borderRadius: 0
  },
  summaryPadded: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4
  },
  summaryTitle: {
    width: "100%",
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  summaryItem: {
    width: "48%",
    gap: 4
  },
  summaryItemWide: {
    width: "100%",
    gap: 4
  },
  summaryFilterButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fbfdf8"
  },
  summaryLabel: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "900"
  },
  summaryMetricLabel: {
    minHeight: 18
  },
  summaryValue: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  summaryValueSmall: {
    color: "#18241b",
    fontSize: 13,
    fontWeight: "900"
  },
  summaryValueActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  summaryValueActionText: {
    flex: 1
  },
  summaryGoButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f5f8f1"
  },
  summaryGoText: {
    color: "#657064",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "900"
  },
  moodRankRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4
  },
  moodRankChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#f5f8f1"
  },
  moodRankText: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  moodRatioBox: {
    gap: 8
  },
  moodRatioBar: {
    height: 14,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#eef1ed"
  },
  moodRatioSegment: {
    height: "100%"
  },
  moodRatioLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  moodRatioLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  moodRatioLegendText: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "900"
  },
  summaryResults: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  summaryResultsTitle: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900"
  },
  summaryResultCard: {
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fbfdf8"
  },
  summaryResultMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  summaryResultMetaLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  summaryResultMood: {
    flexShrink: 1,
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  summaryResultTime: {
    color: "#8c948b",
    fontSize: 11,
    fontWeight: "800"
  },
  summaryResultText: {
    color: "#18241b",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  analysisBox: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 8
  },
  analysisTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  analysisTabItem: {
    width: "49%",
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 7
  },
  analysisTabText: {
    color: "#657064",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center"
  },
  suggestionBox: {
    gap: 10,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  analysisTitle: {
    color: "#18241b",
    fontSize: 17,
    fontWeight: "900"
  },
  analysisDescription: {
    marginTop: -6,
    color: "#657064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  analysisGrid: {
    flexDirection: "row",
    gap: 10
  },
  analysisCell: {
    flex: 1,
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(24, 36, 27, 0.08)"
  },
  categoryChartBox: {
    padding: 0,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  categorySlides: {
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12
  },
  categorySlide: {
    minHeight: 302,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#fbfdf8"
  },
  categorySlideTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  categoryLegend: {
    gap: 7
  },
  categoryLegendHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 22,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(101, 112, 100, 0.18)"
  },
  categoryLegendHeadText: {
    color: "#8c948b",
    fontSize: 11,
    fontWeight: "900"
  },
  categoryLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 25
  },
  categoryTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(101, 112, 100, 0.18)"
  },
  categoryRankSpacer: {
    width: 20
  },
  categoryRankBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: 999
  },
  categoryRankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  categoryLegendLabel: {
    flex: 1,
    color: "#18241b",
    fontSize: 12,
    fontWeight: "900"
  },
  categoryLegendLabelCompact: {
    flex: 1,
    minWidth: 0,
    color: "#18241b",
    fontSize: 12,
    fontWeight: "900"
  },
  categoryLegendPercent: {
    width: 34,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  categoryLegendPercentWide: {
    width: 46,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendEnergy: {
    width: 50,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  categoryLegendEnergyWide: {
    width: 74,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  categoryLegendShareWide: {
    width: 86,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendMoodRatio: {
    width: 62,
    height: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#eef1ed"
  },
  categoryLegendMoodRatioWide: {
    width: 152,
    gap: 5
  },
  categoryLegendMetricWide: {
    width: 152,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  categoryLegendMoodMetricWide: {
    width: 152,
    gap: 5
  },
  categoryLegendMetricHalf: {
    flex: 1,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendMetricFull: {
    flex: 1,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendMoodBar: {
    height: 14,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#eef1ed"
  },
  categoryMoodRatioText: {
    color: "#657064",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryMoodRatioSegment: {
    height: "100%"
  },
  categoryLegendCount: {
    width: 38,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendCountWide: {
    width: 48,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  categoryLegendEmpty: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
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
  chartBlock: {
    gap: 4
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
  chartGridColumn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(101, 112, 100, 0.14)"
  },
  chartRegion: {
    position: "absolute",
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent"
  },
  chartRegionSelected: {
    backgroundColor: "rgba(47, 143, 84, 0.1)",
    borderColor: "rgba(47, 143, 84, 0.28)"
  },
  chartRegionCount: {
    color: "rgba(101, 112, 100, 0.46)",
    fontSize: 18,
    fontWeight: "900"
  },
  chartDot: {
    position: "absolute",
    zIndex: 2,
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
    flex: 1,
    position: "relative",
    height: 14
  },
  chartXAxisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  chartXAxisSpacer: {
    width: 28
  },
  chartAxisNumber: {
    position: "absolute",
    width: 28,
    marginLeft: -14,
    color: "rgba(101, 112, 100, 0.72)",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center"
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
  chartSelectedTitle: {
    color: "#18241b",
    fontSize: 13,
    fontWeight: "900"
  },
  chartSelectedEntry: {
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(101, 112, 100, 0.14)"
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: "#fff",
    fontSize: 11,
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
  recentHeader: {
    gap: 10
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7
  },
  customDateField: {
    flex: 1,
    gap: 6
  },
  customDateLabel: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  customDateTilde: {
    paddingBottom: 12,
    color: "#657064",
    fontSize: 16,
    fontWeight: "900"
  },
  customDateInput: {
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#18241b",
    fontSize: 14,
    fontWeight: "800"
  },
  customDateConfirm: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8
  },
  customDateConfirmText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  list: {
    gap: 10
  },
  listHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  listTitle: {
    flex: 1,
    color: "#18241b",
    fontSize: 17,
    fontWeight: "900"
  },
  listControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  orderSwitcher: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 8
  },
  orderButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 7
  },
  orderButtonActive: {
    backgroundColor: "#fff"
  },
  orderText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  listActionsInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8
  },
  textAction: {
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  textActionLabel: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "900"
  },
  deleteActionLabel: {
    color: "#d92d20",
    fontSize: 13,
    fontWeight: "900"
  },
  disabledActionLabel: {
    opacity: 0.35
  },
  confirmCard: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1c8c4",
    borderRadius: 8,
    backgroundColor: "#fff7f6"
  },
  confirmTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  confirmActions: {
    flexDirection: "row",
    gap: 8
  },
  confirmButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 8
  },
  confirmButtonSecondary: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  confirmPrimaryText: {
    color: "#fff",
    fontWeight: "900"
  },
  confirmSecondaryText: {
    color: "#657064",
    fontWeight: "900"
  },
  card: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  cardSelectable: {
    borderStyle: "dashed"
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  moodEnergyGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkCircle: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#cbd6c8",
    borderRadius: 999,
    backgroundColor: "#fff"
  },
  checkText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  date: {
    color: "#2f8f54",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  mood: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden"
  },
  text: {
    color: "#18241b",
    fontSize: 15,
    lineHeight: 22
  },
  empty: {
    color: "#657064",
    fontSize: 15
  }
});
