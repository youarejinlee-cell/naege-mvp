import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAppTheme } from "../lib/theme";

type Props = {
  user: User | null;
  loading?: boolean;
  error?: string | null;
  onGoogleLogin: () => void;
};

export function AuthCard({ user, loading, error, onGoogleLogin }: Props) {
  const theme = useAppTheme();
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Log to Letter";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <View style={[styles.card, { borderBottomColor: theme.border, backgroundColor: theme.cardAlt }]}>
      {user ? (
        <View style={styles.profileRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: theme.soft }]}>
              <Text style={[styles.avatarText, { color: theme.tint }]}>{displayName.slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.profileText}>
            <Text style={[styles.label, { color: theme.muted }]}>계정</Text>
            <Text style={[styles.title, { color: theme.text }]}>{displayName}</Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: theme.muted }]}>계정</Text>
          <Text style={[styles.title, { color: theme.text }]}>계정 연결</Text>
          <Text style={[styles.text, { color: theme.muted }]}>
            {isSupabaseConfigured ? "Google 계정으로 연결할 수 있어." : "Supabase 설정을 넣으면 Google 로그인을 쓸 수 있어."}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={!isSupabaseConfigured || loading}
            style={[styles.button, { backgroundColor: theme.tint }, (!isSupabaseConfigured || loading) && styles.disabled]}
            onPress={onGoogleLogin}
          >
            <Text style={[styles.buttonLabel, { color: theme.inverseText }]}>{loading ? "연결 중" : "Google로 계속하기"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe8da",
    backgroundColor: "#fbfdf8"
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999
  },
  avatarFallback: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900"
  },
  profileText: {
    flex: 1,
    gap: 3
  },
  label: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  text: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 18
  },
  error: {
    color: "#d92d20",
    fontSize: 12,
    fontWeight: "800"
  },
  button: {
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#18241b"
  },
  disabled: {
    opacity: 0.45
  },
  buttonLabel: {
    color: "#fff",
    fontWeight: "900"
  }
});
