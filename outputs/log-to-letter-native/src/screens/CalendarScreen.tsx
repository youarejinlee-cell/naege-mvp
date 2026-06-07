import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CloverBadge } from "../components/CloverBadge";
import { Screen } from "../components/Screen";
import { getEnergyLevel } from "../lib/energyColors";
import { useAppTheme } from "../lib/theme";
import { CalendarEnergyMode, EnergyColorMode, Entry, Mood } from "../types/domain";

type Props = {
  entries: Entry[];
  energyColorMode: EnergyColorMode;
  calendarMode: CalendarEnergyMode;
  focusDate?: string;
  onDeleteEntries: (entryIds: string[]) => void;
};

type ViewMode = "date" | "recent";
type SortDirection = "desc" | "asc";
type RangeMode = 7 | 30 | 90 | "custom";

const rangeLabels = [
  { value: 7, label: "1주" },
  { value: 30, label: "1개월" },
  { value: 90, label: "3개월" }
];

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
  sensitive: "🌶️ 예민함",
  blank: "🫠 멍함",
  complex: "🤔 복잡함"
};

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

function formatTimeLabel(value: string) {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 || 12;
  return `${period} ${displayHour}시 ${String(minutes).padStart(2, "0")}분`;
}

function daysAgoKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateKey(date);
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
  if (mode === "first") return sorted[0].energy;
  if (mode === "last") return sorted[sorted.length - 1].energy;

  const counts = entries.reduce<Record<number, number>>((acc, entry) => {
    acc[entry.energy] = (acc[entry.energy] || 0) + 1;
    return acc;
  }, {});
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0]);
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

  const average = entries.reduce((sum, entry) => sum + entry.energy, 0) / entries.length;
  const bestDay = [...dayStats].sort((a, b) => b.average - a.average || b.max - a.max)[0];
  const lowestDay = [...dayStats].sort((a, b) => a.average - b.average || a.min - b.min)[0];
  return {
    count: `${entries.length}개`,
    average: average.toFixed(1),
    best: bestDay ? `${formatDateLabel(bestDay.date)} · 평균 ${bestDay.average.toFixed(1)}` : "-",
    lowest: lowestDay ? `${formatDateLabel(lowestDay.date)} · 평균 ${lowestDay.average.toFixed(1)}` : "-",
    moodRanking
  };
}

function getDayEnergyStats(entries: Entry[]) {
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = dateKey(entry.createdAt);
    acc[key] = [...(acc[key] || []), entry];
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, dayEntries]) => {
    const energies = dayEntries.map((entry) => entry.energy);
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

export function CalendarScreen({ entries, energyColorMode, calendarMode, focusDate, onDeleteEntries }: Props) {
  const theme = useAppTheme();
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries]
  );
  const initialDate = sortedEntries[0]?.createdAt ? new Date(sortedEntries[0].createdAt) : new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("date");
  const [selectedDate, setSelectedDate] = useState(dateKey(initialDate));
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [rangeMode, setRangeMode] = useState<RangeMode>(7);
  const [draftStartDate, setDraftStartDate] = useState(daysAgoKey(90));
  const [draftEndDate, setDraftEndDate] = useState(dateKey(new Date()));
  const [appliedStartDate, setAppliedStartDate] = useState(daysAgoKey(90));
  const [appliedEndDate, setAppliedEndDate] = useState(dateKey(new Date()));

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
  const recentEntries = useMemo(() => {
    const cutoff = rangeMode === "custom"
      ? new Date(`${appliedStartDate}T00:00:00`).getTime()
      : Date.now() - rangeMode * 24 * 60 * 60 * 1000;
    const customEnd = new Date(`${appliedEndDate}T23:59:59`).getTime();
    return [...entries]
      .filter((entry) => {
        const entryTime = new Date(entry.createdAt).getTime();
        return rangeMode === "custom"
          ? entryTime >= cutoff && entryTime <= customEnd
          : entryTime >= cutoff;
      });
  }, [appliedEndDate, appliedStartDate, entries, rangeMode]);
  const activeSummary = summarize(viewMode === "date" ? visibleMonthEntries : recentEntries);

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <Screen eyebrow="CALENDAR" title="캘린더" lead="그날의 나는 무슨 생각을 했을까?">
      <View style={[styles.switcher, { backgroundColor: theme.soft }]}>
        <Pressable style={[styles.switchItem, viewMode === "date" && styles.switchActive]} onPress={() => setViewMode("date")}>
          <Text style={[styles.switchText, viewMode === "date" && { color: theme.tint }]}>날짜별</Text>
        </Pressable>
        <Pressable style={[styles.switchItem, viewMode === "recent" && styles.switchActive]} onPress={() => setViewMode("recent")}>
          <Text style={[styles.switchText, viewMode === "recent" && { color: theme.tint }]}>기간별</Text>
        </Pressable>
      </View>

      {viewMode === "date" ? (
        <>
          <View style={styles.panel}>
            <View style={styles.calendarHeader}>
              <Pressable style={[styles.arrow, { backgroundColor: theme.soft }]} onPress={() => moveMonth(-1)}>
                <Text style={[styles.arrowText, { color: theme.tint }]}>‹</Text>
              </Pressable>
              <Text style={styles.month}>{monthKey(visibleMonth)}</Text>
              <Pressable style={[styles.arrow, { backgroundColor: theme.soft }]} onPress={() => moveMonth(1)}>
                <Text style={[styles.arrowText, { color: theme.tint }]}>›</Text>
              </Pressable>
            </View>
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
                const energyLevel = hasEnergy ? getEnergyLevel(energyColorMode, energy) : null;
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
            <SummaryCard title="이달 요약" summary={activeSummary} embedded />
          </View>

          <EntryList
            title={`${formatDateLabel(selectedDate)} 기록`}
            entries={selectedEntries}
            compactDate
            energyColorMode={energyColorMode}
            onDeleteEntries={onDeleteEntries}
          />
        </>
      ) : (
        <>
          <View style={styles.panel}>
            <View style={styles.recentHeader}>
              <View style={styles.segmentCompact}>
                {rangeLabels.map((range) => (
                  <Pressable key={range.value} style={[styles.segmentItem, { backgroundColor: theme.page }, rangeMode === range.value && { backgroundColor: theme.tint }]} onPress={() => setRangeMode(range.value as RangeMode)}>
                    <Text style={[styles.segmentText, rangeMode === range.value && styles.segmentTextActive]}>{range.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={[styles.segmentItem, { backgroundColor: theme.page }, rangeMode === "custom" && { backgroundColor: theme.tint }]} onPress={() => setRangeMode("custom")}>
                  <Text style={[styles.segmentText, rangeMode === "custom" && styles.segmentTextActive]}>직접 입력</Text>
                </Pressable>
              </View>
              {rangeMode === "custom" ? (
                <View style={styles.customDateRow}>
                  <View style={styles.customDateField}>
                    <Text style={styles.customDateLabel}>시작일</Text>
                    <TextInput
                      value={draftStartDate}
                      onChangeText={setDraftStartDate}
                      placeholder="YYYY-MM-DD"
                      keyboardType="numbers-and-punctuation"
                      style={[styles.customDateInput, { borderColor: theme.border }]}
                    />
                  </View>
                  <Text style={styles.customDateTilde}>~</Text>
                  <View style={styles.customDateField}>
                    <Text style={styles.customDateLabel}>종료일</Text>
                    <TextInput
                      value={draftEndDate}
                      onChangeText={setDraftEndDate}
                      placeholder="YYYY-MM-DD"
                      keyboardType="numbers-and-punctuation"
                      style={[styles.customDateInput, { borderColor: theme.border }]}
                    />
                  </View>
                  <Pressable
                    style={[styles.customDateConfirm, { backgroundColor: theme.tint }]}
                    onPress={() => {
                      setAppliedStartDate(draftStartDate);
                      setAppliedEndDate(draftEndDate);
                    }}
                  >
                    <Text style={styles.customDateConfirmText}>확인</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.listTitle}>
            {rangeMode === "custom" ? `${formatDateLabel(appliedStartDate)} ~ ${formatDateLabel(appliedEndDate)} 기록` : `최근 ${rangeMode}일 기록`}
          </Text>
          <SummaryCard summary={activeSummary} />
          <EntryList
            entries={recentEntries}
            energyColorMode={energyColorMode}
            onDeleteEntries={onDeleteEntries}
          />
        </>
      )}
    </Screen>
  );
}

function SummaryCard({ title, summary, embedded }: { title?: string; summary: ReturnType<typeof summarize>; embedded?: boolean }) {
  return (
    <View style={[styles.summary, embedded && styles.summaryEmbedded]}>
      {title ? <Text style={styles.summaryTitle}>{title}</Text> : null}
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>기록</Text>
        <Text style={styles.summaryValue}>{summary.count}</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>평균 에너지</Text>
        <Text style={styles.summaryValue}>{summary.average}</Text>
      </View>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>에너지 좋았던 날</Text>
        <Text style={styles.summaryValueSmall}>{summary.best}</Text>
      </View>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>에너지 낮았던 날</Text>
        <Text style={styles.summaryValueSmall}>{summary.lowest}</Text>
      </View>
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>가장 많았던 감정</Text>
        {summary.moodRanking.length ? (
          <View style={styles.moodRankRow}>
            {summary.moodRanking.map((item) => (
              <View key={item.mood} style={styles.moodRankChip}>
                <Text style={styles.moodRankText}>{moodLabels[item.mood]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.summaryValueSmall}>-</Text>
        )}
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
          <Text style={styles.listTitle}>{title}</Text>
        </View>
      ) : null}
      {sorted.length ? (
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
                  <Text style={styles.textActionLabel}>취소</Text>
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
        sorted.map((entry) => {
          const entryEnergyLevel = getEnergyLevel(energyColorMode, entry.energy);
          return (
          <Pressable
            key={entry.id}
            disabled={!selecting}
            style={[
              styles.card,
              selecting && styles.cardSelectable,
              selectedIds.includes(entry.id) && { borderColor: theme.tint, backgroundColor: theme.soft }
            ]}
            onPress={() => toggleSelect(entry.id)}
          >
            <View style={styles.entryMeta}>
              <View style={styles.moodEnergyGroup}>
                {selecting ? (
                  <View style={[styles.checkCircle, selectedIds.includes(entry.id) && { borderColor: theme.tint, backgroundColor: theme.tint }]}>
                    <Text style={styles.checkText}>{selectedIds.includes(entry.id) ? "✓" : ""}</Text>
                  </View>
                ) : null}
                <Text style={styles.mood}>{moodLabels[entry.mood]}</Text>
                <CloverBadge
                  color={entryEnergyLevel.color}
                  label={String(entry.energy)}
                  size={24}
                  textColor={entryEnergyLevel.textColor}
                  shadowOpacity={0.18}
                  glowColor="rgba(85, 85, 85, 0.08)"
                />
              </View>
              <Text style={styles.date}>{compactDate ? formatTimeLabel(entry.createdAt) : `${formatDateLabel(dateKey(entry.createdAt))} · ${formatTimeLabel(entry.createdAt)}`}</Text>
            </View>
            <Text style={styles.text}>{entry.text}</Text>
          </Pressable>
          );
        })
      ) : (
        <Text style={styles.empty}>남긴 기록이 없어.</Text>
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
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
  summaryLabel: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "900"
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
  moodRankRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
