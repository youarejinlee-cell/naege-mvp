import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationSettings } from "../types/domain";

const NOTIFICATION_IDS_KEY = "log-to-letter-notification-ids-v1";
const MAX_DAILY_NOTIFICATIONS = 12;
const MAX_FIXED_TIMES = 5;
const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 120;
const INTERVAL_STEP_MINUTES = 5;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isInDnd(minuteOfDay: number, dndStart: number, dndEnd: number) {
  if (dndStart === dndEnd) return false;
  if (dndStart < dndEnd) return minuteOfDay >= dndStart && minuteOfDay < dndEnd;
  return minuteOfDay >= dndStart || minuteOfDay < dndEnd;
}

function normalizeIntervalMinutes(value: number) {
  const clamped = Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, Number(value) || MAX_INTERVAL_MINUTES));
  return Math.round((clamped - MIN_INTERVAL_MINUTES) / INTERVAL_STEP_MINUTES) * INTERVAL_STEP_MINUTES + MIN_INTERVAL_MINUTES;
}

function getScheduleMinutes(settings: NotificationSettings) {
  const start = parseTime(settings.startTime);
  const dndStart = parseTime(settings.dndStart);
  const dndEnd = parseTime(settings.dndEnd);
  const interval = normalizeIntervalMinutes(settings.intervalMinutes);
  if (start === null || dndStart === null || dndEnd === null) return [];

  const times: number[] = [];
  for (let minute = start; minute < 24 * 60 && times.length < MAX_DAILY_NOTIFICATIONS; minute += interval) {
    if (!isInDnd(minute, dndStart, dndEnd)) {
      times.push(minute);
    }
  }
  return times;
}

function getFixedSchedule(settings: NotificationSettings) {
  const weekdays = (settings.weekdays?.length ? settings.weekdays : [1, 2, 3, 4, 5, 6, 7])
    .filter((day) => day >= 1 && day <= 7);
  const times = (settings.fixedTimes?.length ? settings.fixedTimes : ["10:00"])
    .slice(0, MAX_FIXED_TIMES)
    .map(parseTime)
    .filter((time): time is number => time !== null);

  return weekdays.flatMap((weekday) => times.map((minuteOfDay) => ({ weekday, minuteOfDay })));
}

async function saveScheduledIds(ids: string[]) {
  await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
}

async function getScheduledIds() {
  const raw = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function cancelLogNotifications() {
  const ids = await getScheduledIds();
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await saveScheduledIds([]);
}

export async function getNotificationPermissionStatus() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ? "허용됨" : permission.canAskAgain ? "요청 가능" : "차단됨";
}

export async function getScheduledLogNotificationCount() {
  const ids = await getScheduledIds();
  return ids.length;
}

export async function scheduleTestLogNotification() {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return permission.canAskAgain ? "권한 필요" : "권한 차단됨";
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Log to Letter",
      body: "테스트 알림이야. 지금 무슨 생각하고 있어?",
      data: { screen: "capture", test: true }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10
    }
  });

  return "10초 뒤 테스트 알림을 보낼게.";
}

export async function scheduleLogNotifications(settings: NotificationSettings) {
  await cancelLogNotifications();
  if (!settings.enabled) return { status: "꺼짐", count: 0 };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("log-reminders", {
      name: "기록 알림",
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return { status: permission.canAskAgain ? "권한 필요" : "권한 차단됨", count: 0 };
  }

  const ids = settings.scheduleMode === "fixed"
    ? await Promise.all(getFixedSchedule(settings).map(({ weekday, minuteOfDay }) => {
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: "Log to Letter",
          body: "지금 무슨 생각하고 있어?",
          data: { screen: "capture" }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
          channelId: Platform.OS === "android" ? "log-reminders" : undefined
        }
      });
    }))
    : await Promise.all(getScheduleMinutes(settings).map((minuteOfDay) => {
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: "Log to Letter",
          body: "지금 무슨 생각하고 있어?",
          data: { screen: "capture" }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: Platform.OS === "android" ? "log-reminders" : undefined
        }
      });
    }));

  await saveScheduledIds(ids);
  return { status: "예약됨", count: ids.length };
}
