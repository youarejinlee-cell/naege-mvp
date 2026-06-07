import { Pressable, StyleSheet, Text, View } from "react-native";
import { canUseDevTools } from "../lib/appVariant";
import { useAppTheme } from "../lib/theme";

export type TabKey = "capture" | "calendar" | "inbox" | "settings" | "account" | "appSettings" | "guide" | "dev";

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "capture", label: "기록", icon: "📝" },
  { key: "calendar", label: "캘린더", icon: "📅" },
  { key: "inbox", label: "편지보관함", icon: "✉️" },
  { key: "settings", label: "알림", icon: "🔔" },
  { key: "dev", label: "테스트", icon: "🧪" }
];

export function BottomTabs({ active, onChange }: Props) {
  const theme = useAppTheme();
  const visibleTabs = canUseDevTools ? tabs : tabs.filter((tab) => tab.key !== "dev");

  return (
    <View style={[styles.wrap, { borderTopColor: theme.border, backgroundColor: theme.page }]}>
      {visibleTabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.item, active === tab.key && { backgroundColor: theme.soft }]}
        >
          <Text style={styles.icon}>{tab.icon}</Text>
          <Text style={[styles.label, active === tab.key && { color: theme.tint }]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 6,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#dfe8da",
    backgroundColor: "#fbfdf8"
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: 8
  },
  icon: {
    fontSize: 17
  },
  label: {
    color: "#657064",
    fontSize: 11,
    fontWeight: "800"
  }
});
