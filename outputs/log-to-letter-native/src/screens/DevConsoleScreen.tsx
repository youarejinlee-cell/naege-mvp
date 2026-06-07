import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { useAppTheme } from "../lib/theme";
import { Entry } from "../types/domain";

type Props = {
  testToday?: string;
  notificationStatus?: string | null;
  onChangeTestToday: (date?: string) => void;
  onAddSampleEntry: (entry: Omit<Entry, "id" | "createdAt">) => void;
  onRefreshNotifications: () => Promise<string>;
  onSendTestNotification: () => Promise<string>;
  onCancelNotifications: () => Promise<string>;
};

const samples: Array<Omit<Entry, "id" | "createdAt">> = [
  {
    text: "오늘은 해야 할 일을 작게 나눠보니까 마음이 조금 가벼워졌어.",
    mood: "calm",
    energy: 4
  },
  {
    text: "답장을 기다리면서 내가 뭘 원하는지 계속 생각하게 됐어.",
    mood: "anxious",
    energy: 2
  },
  {
    text: "칭찬을 들었는데 괜히 하루 종일 기분이 좋았어.",
    mood: "proud",
    energy: 5
  }
];

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DevConsoleScreen({
  testToday,
  notificationStatus,
  onChangeTestToday,
  onAddSampleEntry,
  onRefreshNotifications,
  onSendTestNotification,
  onCancelNotifications
}: Props) {
  const theme = useAppTheme();
  const displayToday = testToday || todayKey();
  const dateInputRef = useRef<TextInput | null>(null);
  const draftDate = useRef(displayToday);
  const [lastAddedText, setLastAddedText] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);

  useEffect(() => {
    draftDate.current = displayToday;
    dateInputRef.current?.setNativeProps({ text: displayToday });
  }, [displayToday]);

  return (
    <Screen eyebrow="DEVELOPMENT" title="테스트 콘솔" lead="운영 배포 때는 이 화면만 떼어내면 돼.">
      <View style={styles.grid}>
        <Tile label="알림 상태" value={notificationStatus || "확인 전"} />
        <Tile label="마이크 권한" value="확인 전" />
        <Tile label="앱 알림" value={notificationStatus?.includes("예약") ? "예약 확인" : "확인 전"} />
        <Tile label="테스트 오늘" value={displayToday} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>알림 테스트</Text>
        <Text style={styles.description}>권한과 예약 개수를 확인하고, 10초 뒤 도착하는 테스트 알림을 보내볼 수 있어.</Text>
        <View style={styles.actions}>
          <ActionButton
            label="상태 새로고침"
            disabled={notificationBusy}
            backgroundColor={theme.soft}
            color={theme.tint}
            onPress={async () => {
              setNotificationBusy(true);
              try {
                setNotificationMessage(await onRefreshNotifications());
              } finally {
                setNotificationBusy(false);
              }
            }}
          />
          <ActionButton
            label="10초 뒤 테스트"
            disabled={notificationBusy}
            backgroundColor={theme.tint}
            color="#fff"
            onPress={async () => {
              setNotificationBusy(true);
              try {
                setNotificationMessage(await onSendTestNotification());
              } finally {
                setNotificationBusy(false);
              }
            }}
          />
        </View>
        <ActionButton
          label="예약 알림 모두 취소"
          disabled={notificationBusy}
          backgroundColor="#fff1f0"
          color="#d92d20"
          onPress={async () => {
            setNotificationBusy(true);
            try {
              setNotificationMessage(await onCancelNotifications());
            } finally {
              setNotificationBusy(false);
            }
          }}
        />
        {notificationMessage ? (
          <Text style={[styles.successText, { color: theme.tint }]}>{notificationMessage}</Text>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>오늘 날짜 테스트</Text>
        <Text style={styles.description}>YYYY-MM-DD 형식으로 넣으면 편지 생성 기준 날짜도 그날로 볼게.</Text>
        <TextInput
          ref={dateInputRef}
          defaultValue={displayToday}
          onChangeText={(value) => {
            draftDate.current = value;
          }}
          placeholder="2026-06-06"
          style={styles.input}
        />
        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: theme.tint }]}
            onPress={() => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(draftDate.current)) {
                onChangeTestToday(draftDate.current);
              }
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: "#fff" }]}>적용</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { backgroundColor: theme.soft }]} onPress={() => {
            draftDate.current = todayKey();
            dateInputRef.current?.setNativeProps({ text: draftDate.current });
            onChangeTestToday(undefined);
          }}>
            <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>실제 오늘로</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { backgroundColor: theme.soft }]} onPress={() => {
            draftDate.current = "2026-06-13";
            dateInputRef.current?.setNativeProps({ text: draftDate.current });
            onChangeTestToday("2026-06-13");
          }}>
            <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>2026-06-13</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>샘플 기록 넣기</Text>
        <Text style={styles.description}>현재 테스트 오늘 날짜의 오전 9시 30분 기록으로 넣을게.</Text>
        {samples.map((sample) => (
          <Pressable
            key={sample.text}
            style={styles.sampleButton}
            onPress={() => {
              onAddSampleEntry(sample);
              setLastAddedText(`${displayToday} 기록을 넣었어.`);
            }}
          >
            <Text style={styles.sampleText}>{sample.text}</Text>
            <Text style={styles.sampleMeta}>감정 {sample.mood} · 에너지 {sample.energy}</Text>
          </Pressable>
        ))}
        {lastAddedText ? (
          <Text style={[styles.successText, { color: theme.tint }]}>{lastAddedText}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  backgroundColor,
  color,
  onPress
}: {
  label: string;
  disabled?: boolean;
  backgroundColor: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.secondaryButton, { backgroundColor }, disabled && styles.disabledButton]}
      onPress={onPress}
    >
      <Text style={[styles.secondaryButtonText, { color }]}>{disabled ? "처리 중" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  tile: {
    width: "48%",
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  label: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  value: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  panel: {
    gap: 10,
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
  description: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    color: "#18241b",
    fontSize: 15,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#e7f6df"
  },
  secondaryButtonText: {
    color: "#2f8f54",
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  sampleButton: {
    gap: 5,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#f5f8f1"
  },
  sampleText: {
    color: "#18241b",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  sampleMeta: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "800"
  },
  successText: {
    fontSize: 13,
    fontWeight: "900"
  }
});
