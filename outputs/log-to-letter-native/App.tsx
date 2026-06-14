import { useEffect, useState } from "react";
import { Image, Platform, Pressable, StatusBar as NativeStatusBar, StyleSheet, Text, View } from "react-native";
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
import { deleteRemoteEntries, deleteRemoteUserData, generateDueLetters, normalizeStateIds, pullAppState, syncAppState, upsertEntry, upsertRemoteSettings } from "./src/lib/remoteSync";
import { defaultState, loadAppState, saveAppState } from "./src/lib/storage";
import { deleteAccount, getCurrentSession, signInWithGoogle, signOut, supabase } from "./src/lib/supabase";
import { AppThemeProvider, themePalettes } from "./src/lib/theme";
import { AppState, ColorTheme, Entry, Letter, Mood } from "./src/types/domain";

const topSafePadding = Platform.select({
  ios: 44,
  android: NativeStatusBar.currentHeight || 24,
  default: 24
});

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
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

function normalizeSavedLetterCopy(state: AppState): AppState {
  return {
    ...state,
    letters: state.letters.map((letter) => {
      const deliveredDate = dateKey(letter.deliveredAt);
      const isJuneSampleLetter = deliveredDate === "2026-06-08" || letter.periodLabel === "2026-06-01 ~ 2026-06-07";
      if (!isJuneSampleLetter) return letter;

      return {
        ...letter,
        title: letter.title === "작은 성공이라는 열매" || letter.title === "작게 해낸 날들"
          ? "작게 해낸 날들이 너를 조금 더 믿게 했어"
          : letter.title,
        keyword: "작게 해낸 날들"
      };
    })
  };
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

const storeSampleEntries: Array<Omit<Entry, "id">> = [
  {
    text: "아침에 눈뜨자마자 마음이 조금 가벼웠어. 이번 달은 작은 기록부터 해보자는 생각이 들었어.",
    mood: "hopeful",
    energy: 4,
    createdAt: "2026-05-01T08:40:00"
  },
  {
    text: "정리해둔 할 일을 하나 끝냈어. 별일 아닌데도 오늘의 방향이 잡히는 느낌이 있었어.",
    mood: "proud",
    energy: 4,
    createdAt: "2026-05-02T14:10:00"
  },
  {
    text: "연휴가 끝나가는 게 아쉬웠어. 쉬고 싶은 마음과 다시 움직여야 한다는 마음이 같이 있었어.",
    mood: "complex",
    energy: 3,
    createdAt: "2026-05-04T19:05:00"
  },
  {
    text: "점심을 천천히 먹었더니 생각이 덜 급해졌어. 몸이 느려지니까 마음도 조금 따라왔어.",
    mood: "peaceful",
    energy: 4,
    createdAt: "2026-05-05T13:20:00"
  },
  {
    text: "회의 전에 긴장했는데 막상 시작하니 괜찮았어. 걱정이 실제보다 먼저 커지는 것 같아.",
    mood: "worried",
    energy: 2,
    createdAt: "2026-05-06T10:30:00"
  },
  {
    text: "오늘은 무덤덤했어. 감정이 크지 않은 날도 기록해두면 나중에 흐름이 보일 것 같아.",
    mood: "indifferent",
    energy: 3,
    createdAt: "2026-05-07T21:00:00"
  },
  {
    text: "친구가 해준 말이 오래 남았어. 내가 너무 혼자 결론을 내리려고 했던 것 같아.",
    mood: "moved",
    energy: 4,
    createdAt: "2026-05-08T20:35:00"
  },
  {
    text: "괜히 비교하는 마음이 올라왔어. 부러운 장면 뒤에 내가 바라는 생활이 숨어 있는 것 같아.",
    mood: "envious",
    energy: 2,
    createdAt: "2026-05-09T17:25:00"
  },
  {
    text: "산책하면서 생각이 조금 정리됐어. 움직여야 머릿속 말들이 조용해지는 날이 있네.",
    mood: "calm",
    energy: 4,
    createdAt: "2026-05-10T18:50:00"
  },
  {
    text: "해야 할 일을 미루다가 결국 하나만 끝냈어. 작게라도 해내니 마음이 덜 무거웠어.",
    mood: "selfEsteem",
    energy: 4,
    createdAt: "2026-05-11T22:15:00"
  },
  {
    text: "오늘은 말 한마디가 계속 마음에 걸렸어. 내가 원했던 건 사과보다 이해였던 것 같아.",
    mood: "sensitive",
    energy: 2,
    createdAt: "2026-05-12T16:45:00"
  },
  {
    text: "아까 먹은 빵이 생각보다 맛있어서 기분이 좋아졌어. 작은 만족이 하루를 살짝 바꿨어.",
    mood: "happy",
    energy: 5,
    createdAt: "2026-05-13T15:10:00"
  },
  {
    text: "오늘은 배운 게 있었어. 내가 힘들다고 느끼는 순간에는 보통 기준이 너무 높아져 있었어.",
    mood: "instructive",
    energy: 3,
    createdAt: "2026-05-14T21:40:00"
  },
  {
    text: "답장이 늦어지니까 마음이 흔들렸어. 내가 원하는 관계의 속도를 더 잘 알아야겠어.",
    mood: "anxious",
    energy: 2,
    createdAt: "2026-05-15T23:05:00"
  },
  {
    text: "오전에 칭찬을 받았는데 오래 기억하고 싶었어. 그냥 운이 아니라 내가 준비한 것도 있었어.",
    mood: "grateful",
    energy: 5,
    createdAt: "2026-05-16T11:25:00"
  },
  {
    text: "주말인데도 일 생각이 들어왔어. 쉬는 중에도 잘해야 한다는 마음이 남아 있었어.",
    mood: "tired",
    energy: 2,
    createdAt: "2026-05-17T12:15:00"
  },
  {
    text: "오늘은 머리가 멍했어. 생각을 정리하려고 하기보다 일단 잠을 먼저 챙겨야 할 것 같아.",
    mood: "blank",
    energy: 1,
    createdAt: "2026-05-19T22:30:00"
  },
  {
    text: "새로 산 작은 물건이 마음에 들었어. 내가 좋아하는 취향을 알아가는 느낌이 있었어.",
    mood: "delight",
    energy: 4,
    createdAt: "2026-05-20T18:20:00"
  },
  {
    text: "사람들 앞에서 괜찮은 척하느라 피곤했어. 사실은 조금 어렵다고 말하고 싶었어.",
    mood: "difficult",
    energy: 2,
    createdAt: "2026-05-21T20:05:00"
  },
  {
    text: "오늘은 궁금한 마음이 컸어. 내가 반복해서 끌리는 것들이 결국 내 욕망을 보여주는 것 같아.",
    mood: "curious",
    energy: 4,
    createdAt: "2026-05-22T14:55:00"
  },
  {
    text: "걱정이 올라왔지만 바로 휩쓸리진 않았어. 걱정이 알려주는 방향만 조용히 적어뒀어.",
    mood: "accepting",
    energy: 3,
    createdAt: "2026-05-23T19:30:00"
  },
  {
    text: "오랜만에 재밌는 얘기를 많이 했어. 웃고 나니 생각이 덜 딱딱해졌어.",
    mood: "fun",
    energy: 5,
    createdAt: "2026-05-24T22:05:00"
  },
  {
    text: "오전 회의에서 준비한 내용을 차분하게 설명했어. 잘해내고 싶은 마음이 조금 덜 날카로웠어.",
    mood: "proud",
    energy: 5,
    createdAt: "2026-05-25T09:20:00"
  },
  {
    text: "답장을 기다리면서 내가 원하는 게 뭔지 계속 생각했어. 그냥 확인받고 싶었던 걸지도 몰라.",
    mood: "anxious",
    energy: 2,
    createdAt: "2026-05-26T21:10:00"
  },
  {
    text: "오늘은 서운한 마음이 올라왔는데, 바로 말하기보다 내가 바라는 관계의 모양을 먼저 적어봤어.",
    mood: "reflective",
    energy: 3,
    createdAt: "2026-05-27T18:40:00"
  },
  {
    text: "퇴근길에 산책을 했더니 머리가 조금 맑아졌어. 몸이 먼저 쉬고 싶다고 말한 것 같아.",
    mood: "calm",
    energy: 4,
    createdAt: "2026-05-28T20:15:00"
  },
  {
    text: "마감 생각이 계속 따라와서 예민했어. 일을 잘하고 싶은 마음이 자꾸 몸을 조이는 것 같아.",
    mood: "sensitive",
    energy: 2,
    createdAt: "2026-05-29T16:05:00"
  },
  {
    text: "친구랑 짧게 통화했는데 이상하게 마음이 풀렸어. 별말 아닌 대화가 필요했나봐.",
    mood: "grateful",
    energy: 4,
    createdAt: "2026-05-31T11:30:00"
  },
  {
    text: "하루 종일 이것저것 해냈는데도 어딘가 부족한 느낌이 있었어. 기준을 조금 낮춰도 괜찮을 것 같아.",
    mood: "reflective",
    energy: 3,
    createdAt: "2026-05-30T20:45:00"
  },
  {
    text: "아침에 해야 할 일을 세 개로만 나누니까 시작이 쉬웠어. 작은 단위로 해내는 게 나한테 맞는 것 같아.",
    mood: "hopeful",
    energy: 4,
    createdAt: "2026-06-01T09:05:00"
  },
  {
    text: "오늘은 괜히 비교하는 마음이 올라왔어. 부러움 뒤에 내가 원하는 장면이 숨어 있는 것 같아.",
    mood: "envious",
    energy: 2,
    createdAt: "2026-06-02T17:45:00"
  },
  {
    text: "쇼츠에서 본 정리법을 따라 해봤는데 생각보다 재밌었어. 일단 눈앞에 보이게 만드는 게 도움이 됐어.",
    mood: "fun",
    energy: 5,
    createdAt: "2026-06-03T22:00:00"
  },
  {
    text: "몸이 너무 피곤해서 기록도 짧게 남겨. 오늘은 더 밀어붙이면 안 될 것 같아.",
    mood: "tired",
    energy: 1,
    createdAt: "2026-06-04T23:10:00"
  },
  {
    text: "점심에 먹은 파스타가 생각보다 좋았어. 이런 작은 만족도 하루를 바꿀 수 있네.",
    mood: "happy",
    energy: 4,
    createdAt: "2026-06-05T13:25:00"
  },
  {
    text: "칭찬을 받았는데 바로 넘기지 않고 기록해두고 싶었어. 오늘의 나는 꽤 잘 버텼어.",
    mood: "proud",
    energy: 5,
    createdAt: "2026-06-06T09:43:00"
  },
  {
    text: "오후에는 다시 걱정이 올라왔어. 그래도 걱정의 방향을 보니 내가 중요하게 여기는 게 보였어.",
    mood: "worried",
    energy: 2,
    createdAt: "2026-06-06T17:55:00"
  },
  {
    text: "밤에는 마음이 조금 조용해졌어. 오늘 기록들을 보니 에너지가 오르내린 이유가 선명해.",
    mood: "accepting",
    energy: 3,
    createdAt: "2026-06-06T22:12:00"
  },
  {
    text: "새로운 장소에서 커피를 마셨는데 기분이 환기됐어. 내가 생각보다 작은 변화를 좋아하나봐.",
    mood: "excited",
    energy: 5,
    createdAt: "2026-06-07T15:20:00"
  },
  {
    text: "대화 중에 내가 원하는 걸 흐리게 말하고 있다는 걸 알았어. 다음에는 조금 더 직접 말해보고 싶어.",
    mood: "curious",
    energy: 3,
    createdAt: "2026-06-09T19:05:00"
  },
  {
    text: "오늘은 무덤덤했어. 특별히 좋은 것도 나쁜 것도 없었지만, 이런 날도 기록으로 남겨두면 흐름이 보이겠지.",
    mood: "indifferent",
    energy: 3,
    createdAt: "2026-06-10T12:30:00"
  },
  {
    text: "작게 미뤄둔 일을 끝냈어. 대단한 일은 아니지만 나를 조금 믿어도 되겠다는 생각이 들었어.",
    mood: "selfEsteem",
    energy: 4,
    createdAt: "2026-06-11T18:18:00"
  }
];

const storeSampleLetters: Letter[] = [
  {
    id: "letter-2026-06-01",
    title: "잘하려는 마음 사이에서 쉬는 법을 찾고 있었어",
    keyword: "잘하려는 마음",
    periodLabel: "2026-05-25 ~ 2026-05-31",
    deliveredAt: "2026-06-01T00:00:00",
    body: "이번 주의 너는 일을 잘 해내고 싶은 마음과 관계 안에서 확인받고 싶은 마음 사이를 오가고 있었어.\n\n회의를 준비하고, 마감 생각에 예민해지고, 답장을 기다리며 네가 원하는 것이 무엇인지 생각했던 기록들이 이어져 있었어. 기록 속 에너지는 높았다가 낮아졌지만, 그 아래에는 공통적으로 “잘하고 싶다”는 마음이 있었어.\n\n흥미로운 건 네가 마음을 밀어붙일 때보다, 산책을 하거나 친구와 짧게 대화했을 때 조금 더 안정됐다는 점이야. 너는 혼자 더 세게 버티는 방식보다, 생각을 밖으로 꺼내고 몸을 움직일 때 회복되는 사람일지도 몰라.\n\n다음 주에는 잘해야 한다는 마음이 올라올 때 바로 결론을 내리지 말고, 지금 내가 원하는 것이 무엇인지 한 문장으로 먼저 적어봐. 원하는 것을 알아차리는 일이 다음 행동을 고르는 첫 단서가 될 거야."
  },
  {
    id: "letter-2026-06-08",
    title: "작게 해낸 날들이 너를 조금 더 믿게 했어",
    keyword: "작게 해낸 날들",
    periodLabel: "2026-06-01 ~ 2026-06-07",
    deliveredAt: "2026-06-08T00:00:00",
    body: "이번 주 기록에서는 작은 단위로 시작했을 때 너의 에너지가 살아나는 장면이 눈에 띄었어.\n\n해야 할 일을 세 개로 나눴던 아침, 쇼츠에서 본 정리법을 따라 해본 밤, 칭찬을 그냥 넘기지 않고 기록해둔 순간이 있었어. 반대로 몸이 피곤했던 날에는 에너지가 확 낮아졌고, 비교하는 마음이나 걱정이 올라왔던 기록도 함께 남아 있었어.\n\n이번 주의 핵심은 기분을 좋게 유지하는 것이 아니라, 에너지가 움직이는 조건을 알아차린 데 있어. 너는 막연히 버티는 것보다 눈앞에 보이게 정리하고, 작은 행동을 끝냈을 때 스스로를 조금 더 믿게 되는 것 같아.\n\n다음 주에는 기록할 때 “지금 내가 할 수 있는 가장 작은 행동은 뭐지?”를 같이 적어봐. 큰 결심보다 작은 실행이 너를 더 안정적으로 움직이게 할 수 있어."
  }
];

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
      setState(reconcileLetters(normalizeSavedLetterCopy(sanitizeStateForVariant(normalizeStateIds(loaded)))));
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
      let nextState = synced;
      try {
        const result = await generateDueLetters(canUseDevTools ? targetState.testToday : undefined);
        if ((result.generated || 0) + (result.updated || 0) > 0) {
          nextState = await pullAppState(targetUser.id, synced);
        }
      } catch (letterError) {
        console.warn("AI letter generation failed", letterError);
        setAuthError(`AI 편지 생성 실패: ${getErrorMessage(letterError)}`);
      }
      setState(reconcileLetters(normalizeSavedLetterCopy(nextState)));
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

  const addStoreSampleData = () => {
    if (!canUseDevTools) return;
    const sampleEntries = storeSampleEntries.map((entry) => ({ ...entry, id: createId() }));
    const sampleKeys = new Set(storeSampleEntries.flatMap((entry) => [
      `${entry.createdAt}|${entry.text}`,
      `${entry.createdAt}.000Z|${entry.text}`
    ]));
    setCalendarFocusDate("2026-05-31");
    setTab("calendar");
    setState((current) => {
      const existing = current.entries.filter((entry) => !sampleKeys.has(`${entry.createdAt}|${entry.text}`));
      return {
        ...reconcileLetters({
          ...current,
          testToday: "2026-06-14",
          theme: "green",
          energyColorMode: "soft",
          calendarEnergyMode: "last",
          letterPaperStyle: "clover",
          entries: [...sampleEntries, ...existing]
        }, startOfDay("2026-06-14T00:00:00")),
        letters: storeSampleLetters
      };
    });
    if (user) {
      setSyncStatus("스토어 샘플 저장 중");
      setAuthError(null);
      Promise.all(sampleEntries.map((entry) => upsertEntry(user.id, entry)))
        .then(() => setSyncStatus("스토어 샘플 저장 완료"))
        .catch((error) => {
          console.warn("Supabase store sample entry upsert failed", error);
          setSyncStatus("실패");
          setAuthError(getErrorMessage(error));
        });
    }
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

  const setTargetMoods = (targetMoods: Mood[]) => {
    setState((current) => {
      const next = { ...current, targetMoods };
      if (user) upsertRemoteSettings(user.id, next).catch((error) => console.warn("Supabase target moods sync failed", error));
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
        targetMoods={state.targetMoods}
        focusDate={calendarFocusDate}
        onDeleteEntries={deleteEntries}
      />
    ),
    inbox: (
      <InboxScreen
        entries={state.entries}
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
    collection: (
      <CalendarScreen
        entries={state.entries}
        energyColorMode={state.energyColorMode}
        calendarMode={state.calendarEnergyMode}
        targetMoods={state.targetMoods}
        onDeleteEntries={deleteEntries}
        analysisOnly
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
        targetMoods={state.targetMoods}
        letterPaperStyle={state.letterPaperStyle}
        onChangeTheme={setTheme}
        onChangeTargetMoods={setTargetMoods}
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
        onAddStoreSampleData={addStoreSampleData}
        onRefreshNotifications={refreshNotificationDebug}
        onSendTestNotification={sendTestNotification}
        onCancelNotifications={cancelScheduledNotifications}
      />
    )
  }[activeTab];

  return (
    <AppThemeProvider theme={theme}>
      <View style={[styles.safe, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} />
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.page }]}>
          <View style={styles.brandWrap}>
            <Image source={require("./assets/app-icon.png")} style={styles.logo} />
            <View>
              <Text style={[styles.brand, { color: theme.text }]}>Log to Letter</Text>
              <Text style={[styles.tagline, { color: theme.muted }]}>미래의 나에게 보내는 지금의 나</Text>
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
            <View style={[styles.floatingMenu, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <View style={[styles.floatingMenuHeader, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
                <Text style={[styles.floatingMenuTitle, { color: theme.text }]}>메뉴</Text>
                <Pressable style={styles.closeButton} onPress={() => setMenuOpen(false)}>
                  <Text style={[styles.closeButtonText, { color: theme.muted }]}>×</Text>
                </Pressable>
              </View>
              <AuthCard
                user={user}
                loading={authLoading}
                error={authError}
                onGoogleLogin={handleGoogleLogin}
              />
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => {
                  setTab("account");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>👤</Text>
                <Text style={[styles.menuListText, { color: theme.text }]}>계정</Text>
              </Pressable>
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => {
                  setTab("appSettings");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>⚙️</Text>
                <Text style={[styles.menuListText, { color: theme.text }]}>설정</Text>
              </Pressable>
              <Pressable
                style={[styles.menuListItem, { borderTopColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => {
                  setTab("guide");
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.menuListIcon}>📗</Text>
                <Text style={[styles.menuListText, { color: theme.text }]}>가이드</Text>
              </Pressable>
              {canUseDevTools ? (
                <Pressable
                  style={[styles.menuListItem, { borderTopColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => {
                    setTab("dev");
                    setMenuOpen(false);
                  }}
                >
                  <Text style={styles.menuListIcon}>🧪</Text>
                  <Text style={[styles.menuListText, { color: theme.text }]}>테스트</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
        <View style={styles.body}>{content}</View>
        <BottomTabs active={activeTab} onChange={setTab} />
      </View>
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
    paddingTop: topSafePadding + 8,
    paddingBottom: 12,
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
