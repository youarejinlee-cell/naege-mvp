import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { User } from "@supabase/supabase-js";
import { Screen } from "../components/Screen";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAppTheme } from "../lib/theme";

type Props = {
  user: User | null;
  loading?: boolean;
  error?: string | null;
  syncStatus?: string | null;
  onGoogleLogin: () => void;
  onSync: () => void;
  onDeleteData: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  onSignOut: () => void;
};

export function AccountScreen({
  user,
  loading,
  error,
  syncStatus,
  onGoogleLogin,
  onSync,
  onDeleteData,
  onDeleteAccount,
  onSignOut
}: Props) {
  const theme = useAppTheme();
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Log to Letter";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <Screen eyebrow="Account" title="계정" lead="로그인과 데이터 관리를 여기에서 할 수 있어.">
      <View style={styles.panel}>
        {user ? (
          <>
            <View style={styles.profileHeader}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: theme.soft }]}>
                  <Text style={[styles.avatarText, { color: theme.tint }]}>{displayName.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.profileText}>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.email}>{user.email || "Google 계정"}</Text>
              </View>
            </View>
            {syncStatus ? <Text style={styles.status}>서버 동기화: {syncStatus}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <ActionButton label="지금 동기화" color={theme.tint} onPress={onSync} />
            <ActionButton
              label="내 기록과 편지 완전 삭제"
              color="#d92d20"
              onPress={() => {
                Alert.alert(
                  "내 데이터 완전 삭제",
                  "기록, 편지, 알림 설정을 이 기기와 서버에서 삭제할게. 이 작업은 되돌릴 수 없어.",
                  [
                    { text: "아니오", style: "cancel" },
                    { text: "삭제", style: "destructive", onPress: () => void onDeleteData() }
                  ]
                );
              }}
            />
            <ActionButton
              label="내 계정 삭제"
              color="#d92d20"
              onPress={() => {
                Alert.alert(
                  "내 계정 삭제",
                  "계정과 서버 데이터를 삭제할게. 계정 삭제용 서버 함수가 연결되어 있어야 완료돼.",
                  [
                    { text: "아니오", style: "cancel" },
                    { text: "삭제", style: "destructive", onPress: () => void onDeleteAccount() }
                  ]
                );
              }}
            />
            <ActionButton label="로그아웃" color={theme.tint} onPress={onSignOut} />
          </>
        ) : (
          <>
            <Text style={styles.name}>계정 연결</Text>
            <Text style={styles.description}>
              {isSupabaseConfigured ? "Google 계정으로 연결하면 기록과 편지를 서버에 동기화할 수 있어." : "Supabase 설정을 넣으면 Google 로그인을 쓸 수 있어."}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              disabled={!isSupabaseConfigured || loading}
              style={[styles.loginButton, { backgroundColor: theme.tint }, (!isSupabaseConfigured || loading) && styles.disabledButton]}
              onPress={onGoogleLogin}
            >
              <Text style={styles.loginButtonText}>{loading ? "연결 중" : "Google로 계속하기"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999
  },
  avatarFallback: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900"
  },
  profileText: {
    flex: 1,
    gap: 4
  },
  name: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  email: {
    color: "#657064",
    fontSize: 13,
    fontWeight: "800"
  },
  description: {
    color: "#657064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  status: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "800"
  },
  error: {
    color: "#d92d20",
    fontSize: 12,
    fontWeight: "800"
  },
  actionButton: {
    paddingVertical: 10
  },
  actionText: {
    fontSize: 14,
    fontWeight: "900"
  },
  loginButton: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 8
  },
  disabledButton: {
    opacity: 0.45
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "900"
  }
});
