import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { useAppTheme } from "../lib/theme";
import { NotificationSettings } from "../types/domain";

const weekdays = [
  { value: 1, label: "일" },
  { value: 2, label: "월" },
  { value: 3, label: "화" },
  { value: 4, label: "수" },
  { value: 5, label: "목" },
  { value: 6, label: "금" },
  { value: 7, label: "토" }
];

const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 120;
const INTERVAL_STEP_MINUTES = 5;
const intervalOptions = Array.from(
  { length: (MAX_INTERVAL_MINUTES - MIN_INTERVAL_MINUTES) / INTERVAL_STEP_MINUTES + 1 },
  (_, index) => MIN_INTERVAL_MINUTES + index * INTERVAL_STEP_MINUTES
);

type Props = {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
  onSave: (settings: NotificationSettings) => Promise<void> | void;
};

export function SettingsScreen({ settings, onChange, onSave }: Props) {
  const theme = useAppTheme();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [adjustedNotice, setAdjustedNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const handleSave = async () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setSaveState("saving");
    setAdjustedNotice(null);
    setValidationError(null);
    const error = validateNotificationSettings(settings);
    if (error) {
      setSaveState("idle");
      setValidationError(error);
      return;
    }
    const normalized = normalizeNotificationSettings(settings);
    if (settings.scheduleMode === "interval" && normalized.intervalMinutes !== settings.intervalMinutes) {
      setAdjustedNotice(`알림 간격은 ${normalized.intervalMinutes}분으로 맞췄어.`);
      onChange(normalized);
    }
    try {
      await onSave(normalized);
      setSaveState("saved");
      setEditing(false);
    } catch {
      setSaveState("failed");
    }
    feedbackTimer.current = setTimeout(() => setSaveState("idle"), 1800);
  };

  const handleToggle = async (enabled: boolean) => {
    const next = { ...settings, enabled };
    onChange(next);
    setValidationError(null);
    if (enabled) {
      setEditing(true);
      return;
    }

    setEditing(false);
    setSaveState("saving");
    try {
      await onSave(next);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
    feedbackTimer.current = setTimeout(() => setSaveState("idle"), 1800);
  };

  const summary = getNotificationSummary(settings);

  return (
    <Screen
      eyebrow="NOTIFICATION"
      title="기록 알림 설정"
      lead="순간의 생각을 기록할 수 있도록 앱 푸시를 보내줄게."
    >
      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <View style={styles.switchWrap}>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#e68a8a", true: "#8ed08b" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {!editing ? (
          <View style={[styles.summaryBox, { backgroundColor: theme.soft, borderColor: theme.border }]}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{settings.enabled ? "알림 요약" : "알림이 설정되어 있지 않아"}</Text>
              {settings.enabled ? (
                <Pressable style={[styles.changeButton, { backgroundColor: theme.tint }]} onPress={() => setEditing(true)}>
                  <Text style={styles.changeButtonText}>변경</Text>
                </Pressable>
              ) : null}
            </View>
            {settings.enabled ? (
              <>
                {summary.lines.map((line) => (
                  <Text key={line} style={styles.summaryLine}>{line}</Text>
                ))}
                <Text style={[styles.summaryCount, { color: theme.tint }]}>{summary.countText}</Text>
              </>
            ) : (
              <Text style={styles.summaryLine}>알림을 켜면 기록할 순간을 놓치지 않게 도와줄게.</Text>
            )}
          </View>
        ) : null}

        {settings.enabled && editing ? (
          <>
            <View style={[styles.modeSwitch, { backgroundColor: theme.soft }]}>
              <Pressable
                style={[styles.modeButton, settings.scheduleMode !== "fixed" && { backgroundColor: theme.tint }]}
                onPress={() => onChange({ ...settings, scheduleMode: "interval" })}
              >
                <Text style={[styles.modeText, settings.scheduleMode !== "fixed" && styles.modeTextActive]}>간격 반복</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, settings.scheduleMode === "fixed" && { backgroundColor: theme.tint }]}
                onPress={() => onChange({ ...settings, scheduleMode: "fixed" })}
              >
                <Text style={[styles.modeText, settings.scheduleMode === "fixed" && styles.modeTextActive]}>특정 시간</Text>
              </Pressable>
            </View>

            {settings.scheduleMode === "fixed" ? (
              <>
                <Text style={styles.fieldLabel}>요일</Text>
                <View style={styles.weekdayRow}>
                  {weekdays.map((day) => {
                    const selected = settings.weekdays.includes(day.value);
                    return (
                      <Pressable
                        key={day.value}
                        style={[styles.weekdayChip, selected && { borderColor: theme.tint, backgroundColor: theme.soft }]}
                        onPress={() => {
                          const nextWeekdays = selected
                            ? settings.weekdays.filter((weekday) => weekday !== day.value)
                            : [...settings.weekdays, day.value].sort((a, b) => a - b);
                          onChange({ ...settings, weekdays: nextWeekdays.length ? nextWeekdays : [day.value] });
                        }}
                      >
                        <Text style={[styles.weekdayText, selected && { color: theme.tint }]}>{day.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.timeHeader}>
                  <Text style={styles.fieldLabel}>시간</Text>
                  <Pressable
                    disabled={settings.fixedTimes.length >= 5}
                    style={[styles.addTimeButton, { backgroundColor: theme.soft }, settings.fixedTimes.length >= 5 && styles.disabledButton]}
                    onPress={() => onChange({ ...settings, fixedTimes: [...settings.fixedTimes, "22:00"] })}
                  >
                    <Text style={[styles.addTimeText, { color: theme.tint }]}>+ 추가</Text>
                  </Pressable>
                </View>
                {settings.fixedTimes.map((time, index) => (
                  <View key={`${index}-${time}`} style={styles.timeRow}>
                    <TextInput
                      value={time}
                      onChangeText={(value) => {
                        const nextTimes = [...settings.fixedTimes];
                        nextTimes[index] = value;
                        onChange({ ...settings, fixedTimes: nextTimes });
                      }}
                      placeholder="10:00"
                      style={[styles.input, styles.timeInput]}
                    />
                    <Pressable
                      disabled={settings.fixedTimes.length <= 1}
                      style={[styles.removeTimeButton, settings.fixedTimes.length <= 1 && styles.disabledButton]}
                      onPress={() => onChange({ ...settings, fixedTimes: settings.fixedTimes.filter((_, itemIndex) => itemIndex !== index) })}
                    >
                      <Text style={styles.removeTimeText}>삭제</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : (
              <>
                <Field label="시작" value={settings.startTime} onChangeText={(startTime) => onChange({ ...settings, startTime })} />
                <Field label="방해금지 시작" value={settings.dndStart} onChangeText={(dndStart) => onChange({ ...settings, dndStart })} />
                <Field label="방해금지 종료" value={settings.dndEnd} onChangeText={(dndEnd) => onChange({ ...settings, dndEnd })} />
                <IntervalWheel
                  value={settings.intervalMinutes}
                  onChange={(intervalMinutes) => onChange({ ...settings, intervalMinutes })}
                />
              </>
            )}
          </>
        ) : null}
        {settings.enabled && editing ? (
          <View style={styles.simulationBox}>
            <Text style={styles.simulationLabel}>이렇게 저장하면</Text>
            <Text style={[styles.simulationText, { color: theme.tint }]}>{summary.countText}</Text>
          </View>
        ) : null}
        {validationError ? <Text style={styles.failedNotice}>{validationError}</Text> : null}
        {settings.enabled && editing ? (
          <Pressable
            disabled={saveState === "saving"}
            style={[
              styles.save,
              { backgroundColor: saveState === "saved" ? "#3fb565" : saveState === "failed" ? "#d92d20" : theme.tint },
              saveState === "saving" && styles.savePending
            ]}
            onPress={handleSave}
          >
            <Text style={styles.saveText}>
              {saveState === "saving" ? "저장 중" : saveState === "saved" ? "저장 완료" : saveState === "failed" ? "저장 실패" : "저장"}
            </Text>
          </Pressable>
        ) : null}
        {saveState === "saved" && adjustedNotice ? (
          <Text style={[styles.savedNotice, { color: theme.tint }]}>{adjustedNotice}</Text>
        ) : null}
        {saveState === "failed" ? (
          <Text style={styles.failedNotice}>저장하지 못했어. 네트워크나 로그인 상태를 확인해줘.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Field({
  label,
  hint,
  value,
  keyboardType,
  onChangeText
}: {
  label: string;
  hint?: string;
  value: string;
  keyboardType?: "number-pad";
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} />
    </View>
  );
}

function IntervalWheel({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const theme = useAppTheme();
  const wheelRef = useRef<ScrollView | null>(null);
  const selectedValue = normalizeIntervalMinutes(value);
  const selectedIndex = Math.max(0, intervalOptions.indexOf(selectedValue));

  useEffect(() => {
    requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({ y: Math.max(0, selectedIndex * 48 - 48), animated: false });
    });
  }, [selectedIndex]);

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>알림 간격(분)</Text>
      </View>
      <ScrollView
        ref={wheelRef}
        style={[styles.intervalWheel, { borderColor: theme.border }]}
        contentContainerStyle={styles.intervalWheelContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {intervalOptions.map((option) => {
          const selected = option === selectedValue;
          return (
            <Pressable
              key={option}
              style={[styles.intervalOption, selected && { backgroundColor: theme.soft }]}
              onPress={() => onChange(option)}
            >
              <Text style={[styles.intervalOptionText, selected && { color: theme.tint, fontSize: 20 }]}>
                {option}분
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function normalizeNotificationSettings(settings: NotificationSettings): NotificationSettings {
  const fixedTimes = (settings.fixedTimes?.length ? settings.fixedTimes : ["10:00"])
    .map((time) => normalizeTimeText(time))
    .filter((time): time is string => Boolean(time))
    .slice(0, 5);
  return {
    ...settings,
    intervalMinutes: normalizeIntervalMinutes(settings.intervalMinutes),
    weekdays: settings.weekdays?.length ? settings.weekdays.filter((day) => day >= 1 && day <= 7) : [1, 2, 3, 4, 5, 6, 7],
    fixedTimes: fixedTimes.length ? fixedTimes : ["10:00"]
  };
}

function normalizeTimeText(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function validateNotificationSettings(settings: NotificationSettings) {
  if (!settings.enabled) return null;

  if (settings.scheduleMode === "fixed") {
    if (!settings.weekdays.length) return "요일을 하나 이상 골라줘.";
    if (!settings.fixedTimes.length) return "알림 시간을 하나 이상 입력해줘.";
    if (settings.fixedTimes.some((time) => !normalizeTimeText(time))) {
      return "특정 시간은 10:00처럼 입력해줘.";
    }
    return null;
  }

  if (!normalizeTimeText(settings.startTime)) return "시작 시간을 09:00처럼 입력해줘.";
  if (!normalizeTimeText(settings.dndStart)) return "방해금지 시작 시간을 22:00처럼 입력해줘.";
  if (!normalizeTimeText(settings.dndEnd)) return "방해금지 종료 시간을 08:00처럼 입력해줘.";
  const start = parseTime(settings.startTime);
  const dndStart = parseTime(settings.dndStart);
  const dndEnd = parseTime(settings.dndEnd);
  if (start !== null && dndStart !== null && dndEnd !== null && isInDnd(start, dndStart, dndEnd)) {
    return "시작 시간이 방해금지 시간 안에 있어.\n시작 시간이나 방해금지 시간을 조정해줘.";
  }
  return null;
}

function normalizeIntervalMinutes(value: number) {
  const clamped = Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, Number(value) || MAX_INTERVAL_MINUTES));
  return Math.round((clamped - MIN_INTERVAL_MINUTES) / INTERVAL_STEP_MINUTES) * INTERVAL_STEP_MINUTES + MIN_INTERVAL_MINUTES;
}

function parseTime(value: string) {
  const normalized = normalizeTimeText(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

function isInDnd(minuteOfDay: number, dndStart: number, dndEnd: number) {
  if (dndStart === dndEnd) return false;
  if (dndStart < dndEnd) return minuteOfDay >= dndStart && minuteOfDay < dndEnd;
  return minuteOfDay >= dndStart || minuteOfDay < dndEnd;
}

function getIntervalCount(settings: NotificationSettings) {
  const start = parseTime(settings.startTime);
  const dndStart = parseTime(settings.dndStart);
  const dndEnd = parseTime(settings.dndEnd);
  const interval = normalizeIntervalMinutes(settings.intervalMinutes);
  if (start === null || dndStart === null || dndEnd === null) return 0;

  let count = 0;
  for (let minute = start; minute < 24 * 60 && count < 12; minute += interval) {
    if (!isInDnd(minute, dndStart, dndEnd)) count += 1;
  }
  return count;
}

function formatTime(value: string) {
  const normalized = normalizeTimeText(value);
  if (!normalized) return value;
  const [hour, minute] = normalized.split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return minute ? `${period} ${displayHour}시 ${minute}분` : `${period} ${displayHour}시`;
}

function getNotificationSummary(settings: NotificationSettings) {
  const normalized = normalizeNotificationSettings(settings);
  if (normalized.scheduleMode === "fixed") {
    const selectedDays = weekdays
      .filter((day) => normalized.weekdays.includes(day.value))
      .map((day) => day.label)
      .join(", ");
    const fixedTimes = normalized.fixedTimes.map(formatTime).join(", ");
    const count = normalized.weekdays.length * normalized.fixedTimes.length;
    return {
      lines: [
        "방식 · 특정 시간",
        `요일 · ${selectedDays}`,
        `시간 · ${fixedTimes}`
      ],
      countText: `일주일에 ${count}번의 기록을 할 수 있어`
    };
  }

  const count = getIntervalCount(normalized);
  return {
    lines: [
      "방식 · 간격 반복",
      `시작 · ${formatTime(normalized.startTime)}`,
      `간격 · ${normalized.intervalMinutes}분마다`,
      `방해금지 · ${formatTime(normalized.dndStart)} ~ ${formatTime(normalized.dndEnd)}`
    ],
    countText: `하루에 ${count}번의 기록을 할 수 있어`
  };
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  switchWrap: {
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionTitle: {
    color: "#18241b",
    fontSize: 16,
    fontWeight: "900"
  },
  status: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  summaryBox: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  summaryTitle: {
    flex: 1,
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  summaryLine: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  },
  summaryCount: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900"
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  changeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  field: {
    gap: 6
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  fieldLabel: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "900"
  },
  fieldHint: {
    flex: 1,
    color: "#98a294",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    color: "#18241b"
  },
  intervalWheel: {
    maxHeight: 168,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  intervalWheelContent: {
    gap: 6,
    padding: 8
  },
  intervalOption: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  intervalOptionText: {
    color: "#657064",
    fontSize: 16,
    fontWeight: "900"
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 8
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 7
  },
  modeText: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "900"
  },
  modeTextActive: {
    color: "#fff"
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 6
  },
  weekdayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  weekdayText: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "900"
  },
  timeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  addTimeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addTimeText: {
    fontSize: 13,
    fontWeight: "900"
  },
  timeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  timeInput: {
    flex: 1
  },
  removeTimeButton: {
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  removeTimeText: {
    color: "#d92d20",
    fontSize: 13,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.35
  },
  simulationBox: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  simulationLabel: {
    color: "#98a294",
    fontSize: 12,
    fontWeight: "900"
  },
  simulationText: {
    fontSize: 14,
    fontWeight: "900"
  },
  save: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: "#18241b"
  },
  savePending: {
    opacity: 0.68
  },
  saveText: {
    color: "#fff",
    fontWeight: "900"
  },
  savedNotice: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  },
  failedNotice: {
    color: "#d92d20",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  }
});
