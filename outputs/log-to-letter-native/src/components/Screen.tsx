import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../lib/theme";

type Props = PropsWithChildren<{
  eyebrow: string;
  title: string;
  lead?: string;
}>;

export function Screen({ eyebrow, title, lead, children }: Props) {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: theme.tint }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {lead ? <Text style={[styles.lead, { color: theme.muted }]}>{lead}</Text> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 16
  },
  heading: {
    gap: 6
  },
  eyebrow: {
    color: "#2f8f54",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  title: {
    color: "#18241b",
    fontSize: 28,
    fontWeight: "900"
  },
  lead: {
    color: "#657064",
    fontSize: 15,
    lineHeight: 22
  }
});
