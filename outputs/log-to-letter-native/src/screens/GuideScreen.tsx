import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { useAppTheme } from "../lib/theme";

const guideItems = [
  {
    title: "기록",
    body: "지금 든 생각을 적고, 감정 1개와 에너지를 함께 골라 남겨. 힌트 버튼으로 문장 시작을 잡을 수도 있어."
  },
  {
    title: "캘린더",
    body: "날짜별 기록을 확인하고, 기간별로 모아볼 수 있어. 이달 요약에서는 자주 나온 감정과 에너지가 좋았던 날, 낮았던 날을 볼 수 있어."
  },
  {
    title: "편지보관함",
    body: "첫 기록을 남긴 날부터 7일 뒤에 편지가 생겨. 받은 편지는 다시 바뀌지 않고, 월별 목록에서 다시 열어볼 수 있어."
  },
  {
    title: "알림",
    body: "기록할 순간을 놓치지 않도록 간격 반복이나 특정 시간 알림을 설정해. 방해금지 시간 안에는 알림이 가지 않게 조정할 수 있어."
  },
  {
    title: "설정",
    body: "메뉴의 설정에서 컬러 테마, 에너지 팔레트, 캘린더 날짜의 에너지 표시 기준을 바꿀 수 있어."
  }
];

export function GuideScreen() {
  const theme = useAppTheme();

  return (
    <Screen
      eyebrow="Guide"
      title="가이드"
      lead="지금의 기록이 나중의 너에게 조금 더 또렷하게 도착하도록."
    >
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>앱 이용 순서</Text>
        <View style={styles.itemList}>
          {guideItems.map((item, index) => (
            <View key={item.title} style={[styles.item, { borderColor: theme.border, backgroundColor: index === 0 ? theme.soft : "#fff" }]}>
              <Text style={[styles.itemNumber, { color: theme.tint }]}>{index + 1}</Text>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.noteBox, { borderColor: theme.border }]}>
        <Text style={styles.noteTitle}>처음엔 이렇게 써봐</Text>
        <Text style={styles.noteBody}>
          알림을 켜고 하루에 몇 번씩 짧게 기록해봐. 며칠이 지나면 캘린더에서 감정과 에너지 흐름을 확인하고, 편지가 도착하면 그 주의 기록을 다시 읽어볼 수 있어.
        </Text>
      </View>
    </Screen>
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
  itemList: {
    gap: 10
  },
  item: {
    flexDirection: "row",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderRadius: 8
  },
  itemNumber: {
    width: 24,
    fontSize: 18,
    fontWeight: "900"
  },
  itemTextWrap: {
    flex: 1,
    gap: 5
  },
  itemTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  itemBody: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  noteBox: {
    gap: 6,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  noteTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  noteBody: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  }
});
