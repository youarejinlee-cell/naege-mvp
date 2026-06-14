import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CloverBadge } from "../components/CloverBadge";
import { Screen } from "../components/Screen";
import { categoryForEntry, entryCategoryLabels } from "../lib/entryCategories";
import { getEnergyLevel, normalizeEnergyPercent } from "../lib/energyColors";
import { useAppTheme } from "../lib/theme";
import { EnergyColorMode, Entry, Mood } from "../types/domain";

type Props = {
  entries: Entry[];
  energyColorMode: EnergyColorMode;
  targetMoods: Mood[];
};

type RangeMode = "week" | "month" | "quarter" | "custom";
type SortDirection = "desc" | "asc";

const moodOptions: Array<{ key: Mood; label: string; group: "긍정" | "중간" | "부정" }> = [
  { key: "calm", label: "😌 차분함", group: "긍정" },
  { key: "joy", label: "😊 좋음", group: "긍정" },
  { key: "moved", label: "🥹 뭉클함", group: "긍정" },
  { key: "recovered", label: "🌱 회복됨", group: "긍정" },
  { key: "happy", label: "😄 행복함", group: "긍정" },
  { key: "delight", label: "😁 기쁨", group: "긍정" },
  { key: "excited", label: "💓 설렘", group: "긍정" },
  { key: "fun", label: "😆 재밌음", group: "긍정" },
  { key: "hopeful", label: "🌤️ 희망적임", group: "긍정" },
  { key: "grateful", label: "🙏 고마움", group: "긍정" },
  { key: "proud", label: "✨ 뿌듯함", group: "긍정" },
  { key: "peaceful", label: "🕊️ 평화로움", group: "긍정" },
  { key: "lucky", label: "🍀 행운", group: "긍정" },
  { key: "selfEsteem", label: "💪 자존감상승", group: "긍정" },
  { key: "complex", label: "🤔 복잡함", group: "중간" },
  { key: "indifferent", label: "😶 무덤덤함", group: "중간" },
  { key: "curious", label: "🧐 궁금함", group: "중간" },
  { key: "accepting", label: "🤲 받아들임", group: "중간" },
  { key: "reflective", label: "🪞 반성함", group: "중간" },
  { key: "envious", label: "🫧 부러움", group: "중간" },
  { key: "instructive", label: "📌 교훈적임", group: "중간" },
  { key: "difficult", label: "🧩 어려움", group: "중간" },
  { key: "blank", label: "🫠 멍함", group: "중간" },
  { key: "anxious", label: "😟 불안함", group: "부정" },
  { key: "worried", label: "😥 걱정됨", group: "부정" },
  { key: "tired", label: "😮‍💨 피곤함", group: "부정" },
  { key: "sad", label: "😔 가라앉음", group: "부정" },
  { key: "depressed", label: "🌧️ 우울함", group: "부정" },
  { key: "angry", label: "😤 날카로움", group: "부정" },
  { key: "irritated", label: "😒 짜증남", group: "부정" },
  { key: "jealous", label: "🫣 질투", group: "부정" },
  { key: "prideHurt", label: "😣 자존심상함", group: "부정" },
  { key: "sensitive", label: "🫨 예민함", group: "부정" },
  { key: "regret", label: "😞 후회됨", group: "부정" }
];

const moodLabelMap = moodOptions.reduce<Record<Mood, string>>((acc, mood) => {
  acc[mood.key] = mood.label;
  return acc;
}, {} as Record<Mood, string>);

const defaultTargetMoods: Mood[] = ["calm", "joy", "moved"];

function getInitialMoods(targetMoods: Mood[]) {
  return targetMoods.length ? targetMoods.slice(0, 3) : defaultTargetMoods;
}

function dateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rangeFromMode(mode: RangeMode, end = new Date()) {
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (mode === "week") return { start: dateKey(addDays(normalizedEnd, -6)), end: dateKey(normalizedEnd) };
  if (mode === "month") return { start: dateKey(addMonths(normalizedEnd, -1)), end: dateKey(normalizedEnd) };
  return { start: dateKey(addMonths(normalizedEnd, -3)), end: dateKey(normalizedEnd) };
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
  return `${period} ${hours % 12 || 12}시 ${String(minutes).padStart(2, "0")}분`;
}

function mostUsedMood(entries: Entry[]) {
  const counts = entries.reduce<Record<string, { count: number; latest: number }>>((acc, entry) => {
    const current = acc[entry.mood] || { count: 0, latest: 0 };
    acc[entry.mood] = {
      count: current.count + 1,
      latest: Math.max(current.latest, new Date(entry.createdAt).getTime())
    };
    return acc;
  }, {});
  const [mood] = Object.entries(counts).sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest)[0] || [];
  return (mood as Mood | undefined) || "calm";
}

function FilterIcon({ color }: { color: string }) {
  return (
    <View style={styles.filterIcon}>
      <View style={[styles.filterIconLine, styles.filterIconLineTop, { backgroundColor: color }]} />
      <View style={[styles.filterIconLine, styles.filterIconLineMiddle, { backgroundColor: color }]} />
      <View style={[styles.filterIconLine, styles.filterIconLineBottom, { backgroundColor: color }]} />
      <View style={[styles.filterIconKnob, styles.filterIconKnobTop, { backgroundColor: color }]} />
      <View style={[styles.filterIconKnob, styles.filterIconKnobMiddle, { backgroundColor: color }]} />
      <View style={[styles.filterIconKnob, styles.filterIconKnobBottom, { backgroundColor: color }]} />
    </View>
  );
}

export function MoodCollectionContent({ entries, energyColorMode, targetMoods }: Props) {
  const theme = useAppTheme();
  const defaultRange = rangeFromMode("quarter");
  const [rangeMode, setRangeMode] = useState<RangeMode>("quarter");
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [draftStart, setDraftStart] = useState(defaultRange.start);
  const [draftEnd, setDraftEnd] = useState(defaultRange.end);
  const [selectedMoods, setSelectedMoods] = useState<Mood[]>(() => getInitialMoods(targetMoods));
  const [draftRangeMode, setDraftRangeMode] = useState<RangeMode>("quarter");
  const [draftMoods, setDraftMoods] = useState<Mood[]>(() => getInitialMoods(targetMoods));
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateError, setDateError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const rangeEntries = useMemo(() => entries.filter((entry) => {
    const key = dateKey(entry.createdAt);
    return key >= appliedRange.start && key <= appliedRange.end;
  }), [entries, appliedRange]);

  const moodCounts = useMemo(() => rangeEntries.reduce<Record<Mood, number>>((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] || 0) + 1;
    return acc;
  }, {} as Record<Mood, number>), [rangeEntries]);

  const draftMoodCounts = useMemo(() => {
    const start = parseDateInput(draftStart);
    const end = parseDateInput(draftEnd);
    if (!start || !end || start.getTime() > end.getTime()) return moodCounts;
    const startKey = dateKey(start);
    const endKey = dateKey(end);
    return entries
      .filter((entry) => {
        const key = dateKey(entry.createdAt);
        return key >= startKey && key <= endKey;
      })
      .reduce<Record<Mood, number>>((acc, entry) => {
        acc[entry.mood] = (acc[entry.mood] || 0) + 1;
        return acc;
      }, {} as Record<Mood, number>);
  }, [entries, draftStart, draftEnd, moodCounts]);

  const filteredEntries = useMemo(() => rangeEntries
    .filter((entry) => selectedMoods.includes(entry.mood))
    .sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return sortDirection === "desc" ? right - left : left - right;
    }), [rangeEntries, selectedMoods, sortDirection]);

  const toggleDraftMood = (mood: Mood) => {
    setDraftMoods((current) => {
      if (current.includes(mood)) return current.filter((item) => item !== mood);
      if (current.length >= 3) return current;
      return [...current, mood];
    });
  };

  const selectPreset = (mode: Exclude<RangeMode, "custom">) => {
    const next = rangeFromMode(mode);
    setDraftRangeMode(mode);
    setDraftStart(next.start);
    setDraftEnd(next.end);
    setDateError("");
  };

  const openFilter = () => {
    setDraftRangeMode(rangeMode);
    setDraftStart(appliedRange.start);
    setDraftEnd(appliedRange.end);
    setDraftMoods(selectedMoods);
    setDateError("");
    setFilterOpen(true);
  };

  const cancelFilter = () => {
    setFilterOpen(false);
    setDateError("");
  };

  const confirmFilter = () => {
    const start = parseDateInput(draftStart);
    const end = parseDateInput(draftEnd);
    if (!start || !end) {
      setDateError("YYYY-MM-DD 형식으로 입력해줘.");
      return;
    }
    if (start.getTime() > end.getTime()) {
      setDateError("시작일이 종료일보다 늦을 수 없어.");
      return;
    }
    setRangeMode(draftRangeMode);
    setAppliedRange({ start: dateKey(start), end: dateKey(end) });
    setSelectedMoods(draftMoods);
    setFilterOpen(false);
    setDateError("");
  };

  const selectedLabel = selectedMoods.length
    ? selectedMoods.map((mood) => moodLabelMap[mood] || mood).join(", ")
    : "선택한 감정";

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>필터</Text>
      <View style={[styles.filterPanel, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.filterSummary}>
          <Text style={[styles.rangeInfo, { color: theme.muted }]}>{formatDateLabel(appliedRange.start)} ~ {formatDateLabel(appliedRange.end)}</Text>
          <Text style={[styles.resultSubtitle, { color: theme.muted }]}>{selectedLabel}</Text>
        </View>
        <Pressable style={[styles.filterButton, { backgroundColor: theme.soft }]} onPress={openFilter}>
          <FilterIcon color={theme.tint} />
        </Pressable>
      </View>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={cancelFilter}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalOutside} onPress={cancelFilter} />
          <View style={[styles.filterModal, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>필터 설정</Text>
              <Pressable style={[styles.closeButton, { backgroundColor: theme.soft }]} onPress={cancelFilter}>
                <Text style={[styles.closeButtonText, { color: theme.tint }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.filterSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>기간</Text>
                <View style={styles.segmentRow}>
                  {[
                    ["week", "1주"],
                    ["month", "1개월"],
                    ["quarter", "3개월"],
                    ["custom", "직접 설정"]
                  ].map(([key, label]) => (
                    <Pressable
                      key={key}
                      style={[styles.segment, { backgroundColor: theme.cardAlt }, draftRangeMode === key && { backgroundColor: theme.tint }]}
                      onPress={() => {
                        if (key === "custom") {
                          setDraftRangeMode("custom");
                          return;
                        }
                        selectPreset(key as Exclude<RangeMode, "custom">);
                      }}
                    >
                      <Text style={[styles.segmentText, { color: theme.muted }, draftRangeMode === key && { color: theme.inverseText }]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {draftRangeMode === "custom" ? (
                  <View style={styles.customDateBox}>
                    <View style={styles.dateInputRow}>
                      <View style={styles.dateField}>
                        <Text style={[styles.dateInputLabel, { color: theme.muted }]}>시작일</Text>
                        <TextInput
                          value={draftStart}
                          onChangeText={setDraftStart}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.muted}
                          style={[styles.dateInput, { borderColor: theme.border, backgroundColor: theme.cardAlt, color: theme.text }]}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                      <Text style={[styles.wave, { color: theme.muted }]}>~</Text>
                      <View style={styles.dateField}>
                        <Text style={[styles.dateInputLabel, { color: theme.muted }]}>종료일</Text>
                        <TextInput
                          value={draftEnd}
                          onChangeText={setDraftEnd}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.muted}
                          style={[styles.dateInput, { borderColor: theme.border, backgroundColor: theme.cardAlt, color: theme.text }]}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
                {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
              </View>

              <View style={styles.filterSection}>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>감정</Text>
                  <Text style={[styles.moodHelp, { color: theme.muted }]}>최대 3개까지 고를 수 있어</Text>
                </View>
                <View style={styles.moodBoard}>
                  {(["긍정", "중간", "부정"] as const).map((group) => (
                    <View key={group} style={styles.moodGroup}>
                      <Text style={[styles.groupTitle, { color: theme.muted }]}>{group}</Text>
                      <View style={styles.moodWrap}>
                        {moodOptions
                          .filter((mood) => mood.group === group)
                          .map((mood) => {
                            const active = draftMoods.includes(mood.key);
                            const disabled = !active && draftMoods.length >= 3;
                            const count = draftMoodCounts[mood.key] || 0;
                            return (
                              <Pressable
                                key={mood.key}
                                disabled={disabled}
                                style={[
                                  styles.moodChip,
                                  { borderColor: theme.border, backgroundColor: theme.cardAlt },
                                  active && { borderColor: theme.tint, backgroundColor: theme.soft },
                                  disabled && styles.moodChipDisabled
                                ]}
                                onPress={() => toggleDraftMood(mood.key)}
                              >
                                <Text style={[
                                  styles.moodText,
                                  { color: theme.muted },
                                  active && { color: theme.tint },
                                  disabled && styles.moodTextDisabled
                                ]}>{mood.label}{count ? ` ${count}` : ""}</Text>
                              </Pressable>
                            );
                          })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={[styles.modalActions, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
              <Pressable style={[styles.cancelButton, { borderColor: theme.border, backgroundColor: theme.cardAlt }]} onPress={cancelFilter}>
                <Text style={[styles.cancelButtonText, { color: theme.muted }]}>취소</Text>
              </Pressable>
              <Pressable style={[styles.applyButton, { backgroundColor: theme.tint }]} onPress={confirmFilter}>
                <Text style={[styles.applyButtonText, { color: theme.inverseText }]}>확인</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, { color: theme.text }]}>기록</Text>
        <View style={styles.resultMetaRow}>
          <Text style={[styles.resultSubtitle, { color: theme.muted }]}>총 {filteredEntries.length}개</Text>
          <View style={[styles.orderSwitcher, { backgroundColor: theme.soft }]}>
            <Pressable style={[styles.orderButton, sortDirection === "desc" && { backgroundColor: theme.card }]} onPress={() => setSortDirection("desc")}>
              <Text style={[styles.orderText, { color: theme.muted }, sortDirection === "desc" && { color: theme.tint }]}>최신순</Text>
            </Pressable>
            <Pressable style={[styles.orderButton, sortDirection === "asc" && { backgroundColor: theme.card }]} onPress={() => setSortDirection("asc")}>
              <Text style={[styles.orderText, { color: theme.muted }, sortDirection === "asc" && { color: theme.tint }]}>오래된순</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.list}>
        {filteredEntries.length ? filteredEntries.map((entry) => {
          const energy = normalizeEnergyPercent(entry.energy);
          const energyLevel = getEnergyLevel(energyColorMode, energy, theme.tint);
          const entryCategory = categoryForEntry(entry);
          return (
            <View key={entry.id} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardMetaLeft}>
                  {entryCategory ? (
                    <Text style={[styles.cardCategory, { color: theme.tint, backgroundColor: theme.soft }]}>{entryCategoryLabels[entryCategory]}</Text>
                  ) : null}
                  <CloverBadge
                    color={energyLevel.color}
                    label={String(energy)}
                    size={24}
                    textColor={energyLevel.textColor}
                    shadowOpacity={0.14}
                    glowColor="rgba(85, 85, 85, 0.08)"
                  />
                  <Text style={[styles.cardMood, { color: theme.text }]}>{moodLabelMap[entry.mood]}</Text>
                </View>
                <Text style={[styles.cardTime, { color: theme.muted }]}>{formatDateLabel(entry.createdAt)} · {formatTimeLabel(entry.createdAt)}</Text>
              </View>
              <Text style={[styles.cardText, { color: theme.text }]}>{entry.text}</Text>
            </View>
          );
        }) : (
          <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>해당 감정으로 남긴 기록이 없어</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>기간이나 감정을 바꿔서 다시 볼 수 있어.</Text>
          </View>
        )}
      </View>
    </>
  );
}

export function MoodCollectionScreen(props: Props) {
  return (
    <Screen eyebrow="COLLECT" title="모아보기" lead="기간과 감정을 고르면 그때의 기록을 한곳에 모아볼 수 있어.">
      <MoodCollectionContent {...props} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterPanel: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  filterSummary: {
    flex: 1,
    gap: 5
  },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  filterIcon: {
    width: 28,
    height: 28,
    position: "relative"
  },
  filterIconLine: {
    position: "absolute",
    left: 3,
    right: 3,
    height: 3,
    borderRadius: 999
  },
  filterIconLineTop: {
    top: 5
  },
  filterIconLineMiddle: {
    top: 13
  },
  filterIconLineBottom: {
    top: 21
  },
  filterIconKnob: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 999
  },
  filterIconKnobTop: {
    top: 3,
    left: 7
  },
  filterIconKnobMiddle: {
    top: 11,
    right: 6
  },
  filterIconKnobBottom: {
    top: 19,
    left: 13
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(24, 36, 27, 0.35)"
  },
  modalOutside: {
    ...StyleSheet.absoluteFillObject
  },
  filterModal: {
    width: "100%",
    maxWidth: 420,
    height: "78%",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#fff"
  },
  modalHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1
  },
  modalTitle: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  closeButtonText: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24
  },
  modalScroll: {
    flex: 1
  },
  modalScrollContent: {
    gap: 18,
    padding: 16,
    paddingBottom: 22
  },
  filterSection: {
    gap: 12
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    backgroundColor: "#fff"
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  cancelButtonText: {
    color: "#657064",
    fontSize: 14,
    fontWeight: "900"
  },
  applyButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  panel: {
    gap: 12,
    padding: 14,
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
  segmentRow: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f4f7ef"
  },
  segmentText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#fff"
  },
  customDateBox: {
    gap: 10
  },
  dateInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  dateField: {
    flex: 1,
    gap: 5
  },
  dateInputLabel: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  dateInput: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    color: "#18241b",
    fontSize: 13,
    fontWeight: "800",
    backgroundColor: "#fbfdf8"
  },
  wave: {
    paddingBottom: 11,
    color: "#657064",
    fontSize: 16,
    fontWeight: "900"
  },
  confirmButton: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 8
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  errorText: {
    color: "#d85b52",
    fontSize: 12,
    fontWeight: "800"
  },
  rangeInfo: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  moodGroup: {
    gap: 8
  },
  moodHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  moodHelp: {
    marginTop: 3,
    color: "#657064",
    fontSize: 12,
    fontWeight: "800"
  },
  selectedMoodWrap: {
    minHeight: 38,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  emptyMoodText: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  moodBoard: {
    gap: 12,
    paddingTop: 4
  },
  groupTitle: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  expandButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  expandText: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 21
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
    borderColor: "#dfe8da",
    borderRadius: 999,
    backgroundColor: "#fbfdf8"
  },
  moodChipDisabled: {
    opacity: 0.38
  },
  moodText: {
    color: "#253027",
    fontSize: 12,
    fontWeight: "900"
  },
  moodTextDisabled: {
    color: "#9aa39a"
  },
  resultHeader: {
    gap: 10
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  resultTitle: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  resultSubtitle: {
    marginTop: 3,
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  orderSwitcher: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 8
  },
  orderButton: {
    paddingHorizontal: 12,
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
  list: {
    gap: 10
  },
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  cardTop: {
    gap: 8
  },
  cardMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardMood: {
    color: "#18241b",
    fontSize: 13,
    fontWeight: "900"
  },
  cardCategory: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden"
  },
  cardTime: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "800"
  },
  cardText: {
    color: "#253027",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  emptyCard: {
    gap: 6,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  emptyTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  emptyText: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  }
});
