import { useEffect, useState } from "react";
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { User } from "@supabase/supabase-js";
import { AuthCard } from "./src/components/AuthCard";
import { BottomTabs, TabKey } from "./src/components/BottomTabs";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AppSettingsScreen } from "./src/screens/AppSettingsScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { CaptureScreen } from "./src/screens/CaptureScreen";
import { DevConsoleScreen } from "./src/screens/DevConsoleScreen";
import { GuideScreen } from "./src/screens/GuideScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { canUseDevTools } from "./src/lib/appVariant";
import { createId, isUuid } from "./src/lib/ids";
import { buildWeeklyLetter } from "./src/lib/letter";
import {
  cancelLogNotifications,
  getNotificationPermissionStatus,
  getScheduledLogNotificationCount,
  scheduleLogNotifications,
  scheduleTestLogNotification
} from "./src/lib/notifications";
import { deleteRemoteEntries, deleteRemoteUserData, normalizeStateIds, syncAppState, upsertEntry, upsertRemoteSettings } from "./src/lib/remoteSync";
import { defaultState, loadAppState, saveAppState } from "./src/lib/storage";
import { deleteAccount, getCurrentSession, signInWithGoogle, signOut, supabase } from "./src/lib/supabase";
import { AppThemeProvider, themePalettes } from "./src/lib/theme";
import { AppState, ColorTheme, EnergyColorMode, Entry } from "./src/types/domain";

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentAppDate(state: AppState) {
  return canUseDevTools && state.testToday ? startOfDay(`${state.testToday}T00:00:00`) : startOfDay(new Date());
}

function nowForState(state: AppState) {
  if (!canUseDevTools || !state.testToday) return new Date();
  const now = new Date();
  return new Date(`${state.testToday}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`);
}

function entryAt(entry: Entry) {
  return startOfDay(entry.createdAt).getTime();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as { message?: string; code?: string; details?: string; hint?: string };
    return [
      details.message,
      details.code ? `code: ${details.code}` : null,
      details.details,
      details.hint ? `hint: ${details.hint}` : null
    ].filter(Boolean).join(" · ") || JSON.stringify(error);
  }
  return String(error || "서버 동기화에 실패했어.");
}

function sanitizeStateForVariant(state: AppState): AppState {
  return canUseDevTools ? state : { ...state, testToday: undefined };
}

function reconcileLetters(state: AppState, today = currentAppDate(state)): AppState {
  if (!state.entries.length) return { ...state, letters: [] };

  const sortedEntries = [...state.entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const firstInputDate = startOfDay(sortedEntries[0].createdAt);
  const validSendDates = new Set<string>();

  for (let sendDate = addDays(firstInputDate, 7); sendDate.getTime() <= today.getTime(); sendDate = addDays(sendDate, 7)) {
    validSendDates.add(dateKey(sendDate));
  }

  const generated = state.letters.filter((letter) => validSendDates.has(dateKey(letter.deliveredAt)) && letter.id === `letter-${dateKey(letter.deliveredAt)}`);
  const existingIds = new Set(generated.map((letter) => letter.id));

  for (let sendDate = addDays(firstInputDate, 7); sendDate.getTime() <= today.getTime(); sendDate = addDays(sendDate, 7)) {
    const periodStart = addDays(sendDate, -7);
    const periodEnd = sendDate;
    const id = `letter-${dateKey(sendDate)}`;
    if (existingIds.has(id)) continue;

    const periodEntries = sortedEntries.filter((entry) => {
      const time = entryAt(entry);
      return time >= periodStart.getTime() && time < periodEnd.getTime();
    });
    generated.push(buildWeeklyLetter(periodEntries, periodStart, sendDate, id));
    existingIds.add(id);
  }

  return {
    ...state,
    letters: generated.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime())
  };
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("capture");
  const [state, setState] = useState<AppState>(defaultState);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const letters = state.letters;
  const theme = themePalettes[state.theme];
  const activeTab = !canUseDevTools && tab === "dev" ? "capture" : tab;

  useEffect(() => {
    loadAppState().then((loaded) => {
      setState(reconcileLetters(sanitizeStateForVariant(normalizeStateIds(loaded))));
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    getCurrentSession()
      .then((session) => setUser(session?.user || null))
      .catch(() => setUser(null));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveAppState(state);
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const runFullSync = async (targetUser = user, targetState = state) => {
    if (!targetUser) return;
    setSyncStatus("동기화 중");
    setAuthError(null);
    try {
      const synced = await syncAppState(targetUser, targetState);
      setState(reconcileLetters(synced));
      setSyncStatus("완료");
    } catch (error) {
      console.warn("Supabase sync failed", error);
      setSyncStatus("실패");
      setAuthError(getErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    runFullSync(user, state);
  }, [hydrated, user?.id]);

  const addEntry = (entry: Entry) => {
    const normalized = { ...entry, id: isUuid(entry.id) ? entry.id : createId() };
    setCalendarFocusDate(dateKey(entry.createdAt));
    setState((current) => reconcileLetters({
      ...current,
      entries: [normalized, ...current.entries]
    }));
    if (user) {
      setSyncStatus("기록 저장 중");
      setAuthError(null);
      upsertEntry(user.id, normalized)
        .then(() => setSyncStatus("기록 저장 완료"))
        .catch((error) => {
          console.warn("Supabase entry upsert failed", error);
          setSyncStatus("실패");
          setAuthError(getErrorMessage(error));
        });
    }
    setTab("calendar");
  };

  const setTestToday = (testToday?: string) => {
    if (!canUseDevTools) return;
    const normalized = testToday && /^\d{4}-\d{2}-\d{2}$/.test(testToday) ? testToday : undefined;
    setState((current) => reconcileLetters({ ...current, testToday: normalized }, normalized ? startOfDay(`${normalized}T00:00:00`) : startOfDay(new Date())));
  };

  const addSampleEntry = (entry: Omit<Entry, "id" | "createdAt">) => {
    if (!canUseDevTools) return;
    const sampleDate = state.testToday || dateKey(new Date());
    const createdAt = new Date(`${sampleDate}T09:30:00`).toISOString();
    const sampleEntry = { ...entry, id: createId(), createdAt };
    setCalendarFocusDate(sampleDate);
    setState((current) => reconcileLetters({
      ...current,
      entries: [sampleEntry, ...current.entries]
    }));
    if (user) {
      setSyncStatus("샘플 저장 중");
      setAuthError(null);
      upsertEntry(user.id, sampleEntry)
        .then(() => setSyncStatus("샘플 저장 완료"))
        .catch((error) => {
          console.warn("Supabase sample entry upsert failed", error);
          setSyncStatus("실패");
          setAuthError(getErrorMessage(error));
        });
    }
    setTab("calendar");
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const session = await signInWithGoogle();
      setUser(session?.user || null);
      if (session?.user) {
        await runFullSync(session.user, state);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "로그인에 실패했어.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  const handleDeleteUserData = async () => {
    setSyncStatus("삭제 중");
    setAuthError(null);
    try {
      if (user) {
        await deleteRemoteUserData(user.id);
      }
      await cancelLogNotifications();
      setNotificationStatus("예약 0개");
      setState(sanitizeStateForVariant(defaultState));
      setCalendarFocusDate(undefined);
      setTab("capture");
      setSyncStatus("삭제 완료");
    } catch (error) {
      console.warn("User data delete failed", error);
      setSyncStatus("실패");
      setAuthError(getErrorMessage(error));
    }
  };

  const handleDeleteAccount = async () => {
    setSyncStatus("계정 삭제 중");
    setAuthError(null);
    try {
      await handleDeleteUserData();
      await deleteAccount();
      await signOut();
      setUser(null);
      setSyncStatus(null);
      setTab("capture");
    } catch (error) {
      console.warn("Account delete failed", error);
      setSyncStatus("실패");
      setAuthError(getErrorMessage(error));
    }
  };

  const setTheme = (theme: ColorTheme) => {
    setState((current) => {
      const next = { ...current, theme };
      if (user) upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase theme sync failed", error));
      return next;
    });
  };

  const setEnergyColorMode = (energyColorMode: EnergyColorMode) => {
    setState((current) => {
      const next = { ...current, energyColorMode };
      if (user) upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase energy color sync failed", error));
      return next;
    });
  };

  const deleteEntries = (entryIds: string[]) => {
    const ids = new Set(entryIds);
    if (user) {
      deleteRemoteEntries(user.id, entryIds).catch((error) => console.warn("Supabase delete entry failed", error));
    }
    setState((current) => ({
      ...current,
      entries: current.entries.filter((entry) => !ids.has(entry.id))
    }));
  };

  const applyNotificationSettings = async (settings: AppState["settings"]) => {
    try {
      if (!settings.enabled) {
        await cancelLogNotifications();
        setNotificationStatus("꺼짐");
        return;
      }
      const result = await scheduleLogNotifications(settings);
      const countLabel = settings.scheduleMode === "fixed"
        ? `일주일 ${result.count}번의 기록을 할 수 있어`
        : `하루 ${result.count}번의 기록을 할 수 있어`;
      setNotificationStatus(result.count ? countLabel : result.status);
    } catch (error) {
      console.warn("Notification scheduling failed", error);
      setNotificationStatus(error instanceof Error ? error.message : "예약 실패");
    }
  };

  const refreshNotificationDebug = async () => {
    const [permission, count] = await Promise.all([
      getNotificationPermissionStatus(),
      getScheduledLogNotificationCount()
    ]);
    const status = `${permission} · 예약 ${count}개`;
    setNotificationStatus(status);
    return status;
  };

  const sendTestNotification = async () => {
    const result = await scheduleTestLogNotification();
    setNotificationStatus(result);
    return result;
  };

  const cancelScheduledNotifications = async () => {
    await cancelLogNotifications();
    setNotificationStatus("예약 0개");
    return "예약된 기록 알림을 모두 취소했어.";
  };

  useEffect(() => {
    getNotificationPermissionStatus()
      .then(setNotificationStatus)
      .catch(() => setNotificationStatus("확인 실패"));
  }, []);

  useEffect(() => {
    if (!hydrated || !state.settings.enabled) return;
    applyNotificationSettings(state.settings);
  }, [hydrated]);

  const content = {
    capture: <CaptureScreen onAddEntry={addEntry} getNow={() => nowForState(state)} energyColorMode={state.energyColorMode} />,
    calendar: (
      <CalendarScreen
        entries={state.entries}
        energyColorMode={state.energyColorMode}
        calendarMode={state.calendarEnergyMode}
        focusDate={calendarFocusDate}
        onDeleteEntries={deleteEntries}
      />
    ),
    inbox: (
      <InboxScreen
        letters={letters}
        letterPaperStyle={state.letterPaperStyle}
        onSavePostscript={(letterId, postscript) => {
          setState((current) => ({
            ...current,
            letters: letters.map((letter) => (letter.id === letterId ? { ...letter, postscript } : letter))
          }));
          if (user) {
            const next = {
              ...state,
              letters: state.letters.map((letter) => (letter.id === letterId ? { ...letter, postscript } : letter))
            };
            upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase postscript sync failed", error));
          }
        }}
      />
    ),
    settings: (
      <SettingsScreen
        settings={state.settings}
        onChange={(settings) => setState((current) => {
          return { ...current, settings };
        })}
        onSave={async (settings) => {
          const next = { ...state, settings };
          await applyNotificationSettings(settings);
          if (user) {
            await upsertRemoteSettings(user.id, next);
          }
        }}
      />
    ),
    account: (
      <AccountScreen
        user={user}
        loading={authLoading}
        error={authError}
        syncStatus={syncStatus}
        onGoogleLogin={handleGoogleLogin}
        onSync={() => runFullSync()}
        onDeleteData={handleDeleteUserData}
        onDeleteAccount={handleDeleteAccount}
        onSignOut={handleSignOut}
      />
    ),
    appSettings: (
      <AppSettingsScreen
        theme={state.theme}
        energyColorMode={state.energyColorMode}
        calendarEnergyMode={state.calendarEnergyMode}
        letterPaperStyle={state.letterPaperStyle}
        onChangeTheme={setTheme}
        onChangeEnergyColorMode={setEnergyColorMode}
        onChangeCalendarEnergyMode={(calendarEnergyMode) => setState((current) => {
          const next = { ...current, calendarEnergyMode };
          if (user) upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase calendar mode sync failed", error));
          return next;
        })}
        onChangeLetterPaperStyle={(letterPaperStyle) => setState((current) => {
          const next = { ...current, letterPaperStyle };
          if (user) upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase letter paper sync failed", error));
          return next;
        })}
      />
    ),
    guide: <GuideScreen />,
    dev: (
      <DevConsoleScreen
        testToday={state.testToday}
        notificationStatus={notificationStatus}
        onChangeTestToday={setTestToday}
        onAddSampleEntry={addSampleEntry}
        onRefreshNotifications={refreshNotificationDebug}
        onSendTestNotification={sendTestNotification}
        onCancelNotifications={cancelScheduledNotifications}
      />
    )
  }[activeTab];

  return (
    <AppThemeProvider theme={theme}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <StatusBar style="dark" />
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.page }]}>
          <View style={styles.brandWrap}>
            <Image source={require("./assets/app-icon.png")} style={styles.logo} />
            <View>
              <Text style={styles.brand}>Log to Letter</Text>
              <Text style={styles.tagline}>미래의 나에게 보내는 지금의 나</Text>
            </View>
          </View>
          <Pressable
            style={[styles.menuButton, { backgroundColor: theme.soft }]}
            onPress={() => setMenuOpen((current) => !current)}
          >
            <Text style={[styles.menuButtonText, { color: theme.tint }]}>{menuOpen ? "×" : "☰"}</Text>
          </Pressable>
        </View>
        {menuOpen ? (
          <>
            <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
            <View style={[styles.floatingMenu, { borderColor: theme.border }]}>
              <View style={[styles.floatingMenuHeader, { borderBottomColor: theme.border }]}>
                <Text style={styles.floatingMenuTitle}>메뉴</Text>
                <Pressable style={styles.closeButton} onPress={() => setMenuOpen(false)}>
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>
              <AuthCard
                user={user}
                loading={authLoading}
                error={authError}
                onGoogleLogin={handleGoogleLogin}
              />
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border }]}
                onPress={() => {
                  setTab("account");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>👤</Text>
                <Text style={styles.menuListText}>계정</Text>
              </Pressable>
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border }]}
                onPress={() => {
                  setTab("appSettings");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>⚙️</Text>
                <Text style={styles.menuListText}>설정</Text>
              </Pressable>
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border }]}
                onPress={() => {
                  setTab("guide");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>📗</Text>
                <Text style={styles.menuListText}>가이드</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <View style={styles.body}>{content}</View>
        <BottomTabs active={activeTab} onChange={setTab} />
      </SafeAreaView>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f8f1"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe8da",
    backgroundColor: "#fbfdf8"
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 8
  },
  brand: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  tagline: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "700"
  },
  menuButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 8
  },
  menuButtonText: {
    fontSize: 22,
    fontWeight: "900"
  },
  menuBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    backgroundColor: "rgba(24, 36, 27, 0.08)"
  },
  floatingMenu: {
    position: "absolute",
    top: 68,
    right: 14,
    zIndex: 20,
    width: 292,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#18241b",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  floatingMenuHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe8da",
    backgroundColor: "#fff"
  },
  floatingMenuTitle: {
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8
  },
  closeButtonText: {
    color: "#657064",
    fontSize: 24,
    fontWeight: "900"
  },
  menuListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#dfe8da",
    backgroundColor: "#fff"
  },
  menuListIcon: {
    fontSize: 17
  },
  menuListText: {
    flex: 1,
    color: "#18241b",
    fontSize: 15,
    fontWeight: "900"
  },
  body: {
    flex: 1
  }
});
