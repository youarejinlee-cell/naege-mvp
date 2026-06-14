import { User } from "@supabase/supabase-js";
import { AppState, Entry, Letter, Mood, NotificationSettings } from "../types/domain";
import { normalizeEnergyPercent } from "./energyColors";
import { createId, isUuid } from "./ids";
import { normalizeColorTheme, normalizeLetterPaperStyle } from "./storage";
import { supabase } from "./supabase";

type EntryRow = {
  id: string;
  text: string;
  mood: string;
  energy: number;
  created_at: string;
};

type LetterRow = {
  id: string;
  title: string;
  body: string;
  period_start: string;
  period_end: string;
  delivered_at: string;
  summary_json?: { keyword?: string } | null;
  themes?: string[] | null;
  recommendations?: string[] | null;
  postscript?: string | null;
  model?: string | null;
  prompt_version?: string | null;
};

type NotificationSettingsRow = {
  enabled: boolean;
  schedule_mode?: "interval" | "fixed" | null;
  start_time: string;
  interval_minutes: number;
  dnd_start: string;
  dnd_end: string;
  weekdays?: number[] | null;
  fixed_times?: string[] | null;
};

type AppSettingsRow = {
  preferences?: {
    theme?: AppState["theme"];
    energyColorMode?: AppState["energyColorMode"];
    calendarEnergyMode?: AppState["calendarEnergyMode"];
    letterPaperStyle?: AppState["letterPaperStyle"];
    targetMoods?: AppState["targetMoods"];
  } | null;
};

const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 120;
const INTERVAL_STEP_MINUTES = 5;

function dateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function splitPeriod(periodLabel: string, deliveredAt: string) {
  const match = periodLabel.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  if (match) return { start: match[1], end: match[2] };

  const delivered = new Date(deliveredAt);
  const start = new Date(delivered);
  start.setDate(start.getDate() - 7);
  const end = new Date(delivered);
  end.setDate(end.getDate() - 1);
  return { start: dateKey(start), end: dateKey(end) };
}

function normalizeEntries(entries: Entry[]) {
  return entries.map((entry) => ({
    ...entry,
    id: isUuid(entry.id) ? entry.id : createId(),
    energy: normalizeEnergyPercent(entry.energy)
  }));
}

function entryToRow(userId: string, entry: Entry) {
  return {
    id: entry.id,
    user_id: userId,
    text: entry.text,
    mood: entry.mood,
    energy: normalizeEnergyPercent(entry.energy),
    source: "native",
    created_at: entry.createdAt,
    updated_at: new Date().toISOString()
  };
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    text: row.text,
    mood: row.mood as Mood,
    energy: normalizeEnergyPercent(row.energy),
    createdAt: row.created_at
  };
}

function letterToRow(userId: string, letter: Letter) {
  const period = splitPeriod(letter.periodLabel, letter.deliveredAt);
  return {
    id: letter.id,
    user_id: userId,
    period_start: period.start,
    period_end: period.end,
    delivered_at: dateKey(letter.deliveredAt),
    title: letter.title,
    body: letter.body,
    html: letter.body.replace(/\n/g, "<br>"),
    summary_json: { keyword: letter.keyword },
    themes: letter.themes || [],
    recommendations: letter.recommendations || [],
    postscript: letter.postscript || "",
    model: letter.model || null,
    prompt_version: letter.promptVersion || "native-rule-v1",
    updated_at: new Date().toISOString()
  };
}

function rowToLetter(row: LetterRow): Letter {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    periodLabel: `${row.period_start} ~ ${row.period_end}`,
    deliveredAt: `${row.delivered_at}T00:00:00`,
    keyword: row.summary_json?.keyword || "그때의 마음",
    postscript: row.postscript || "",
    model: row.model || undefined,
    promptVersion: row.prompt_version || undefined,
    themes: row.themes || [],
    recommendations: row.recommendations || []
  };
}

function normalizeIntervalMinutes(value: number) {
  const clamped = Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, Number(value) || MAX_INTERVAL_MINUTES));
  return Math.round((clamped - MIN_INTERVAL_MINUTES) / INTERVAL_STEP_MINUTES) * INTERVAL_STEP_MINUTES + MIN_INTERVAL_MINUTES;
}

function settingsToRow(userId: string, settings: NotificationSettings) {
  const intervalMinutes = normalizeIntervalMinutes(settings.intervalMinutes);
  return {
    user_id: userId,
    enabled: settings.enabled,
    notifications_enabled: settings.enabled,
    schedule_mode: settings.scheduleMode || "interval",
    start_time: settings.startTime,
    interval_minutes: intervalMinutes,
    dnd_start: settings.dndStart,
    dnd_end: settings.dndEnd,
    weekdays: settings.weekdays?.length ? settings.weekdays : [1, 2, 3, 4, 5, 6, 7],
    fixed_times: settings.fixedTimes?.length ? settings.fixedTimes : ["10:00"],
    timezone: "Asia/Seoul",
    updated_at: new Date().toISOString()
  };
}

function rowToSettings(row: NotificationSettingsRow): NotificationSettings {
  return {
    enabled: row.enabled,
    scheduleMode: row.schedule_mode || "interval",
    startTime: row.start_time.slice(0, 5),
    intervalMinutes: normalizeIntervalMinutes(row.interval_minutes),
    dndStart: row.dnd_start.slice(0, 5),
    dndEnd: row.dnd_end.slice(0, 5),
    weekdays: row.weekdays?.length ? row.weekdays : [1, 2, 3, 4, 5, 6, 7],
    fixedTimes: row.fixed_times?.length ? row.fixed_times : ["10:00"]
  };
}

export function normalizeStateIds(state: AppState): AppState {
  return {
    ...state,
    entries: normalizeEntries(state.entries),
    letterPaperStyle: normalizeLetterPaperStyle(state.letterPaperStyle)
  };
}

export async function upsertProfile(user: User) {
  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email,
    display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function pushAppState(userId: string, state: AppState) {
  const normalized = normalizeStateIds(state);

  if (normalized.entries.length) {
    const { error } = await supabase.from("entries").upsert(normalized.entries.map((entry) => entryToRow(userId, entry)));
    if (error) throw { ...error, message: `entries 저장 실패: ${error.message}` };
  }

  if (normalized.letters.length) {
    const { error } = await supabase.from("letters").upsert(normalized.letters.map((letter) => letterToRow(userId, letter)));
    if (error) throw { ...error, message: `letters 저장 실패: ${error.message}` };
  }

  const { error: notificationError } = await supabase.from("notification_settings").upsert(settingsToRow(userId, normalized.settings));
  if (notificationError) throw { ...notificationError, message: `notification_settings 저장 실패: ${notificationError.message}` };

  const { error: settingsError } = await supabase.from("app_settings").upsert({
    user_id: userId,
    preferences: {
      theme: normalized.theme,
      energyColorMode: normalized.energyColorMode,
      calendarEnergyMode: normalized.calendarEnergyMode,
      letterPaperStyle: normalized.letterPaperStyle,
      targetMoods: normalized.targetMoods || []
    },
    updated_at: new Date().toISOString()
  });
  if (settingsError) throw { ...settingsError, message: `app_settings 저장 실패: ${settingsError.message}` };

  return normalized;
}

export async function pullAppState(userId: string, local: AppState): Promise<AppState> {
  const [
    entriesResult,
    lettersResult,
    notificationResult,
    settingsResult
  ] = await Promise.all([
    supabase.from("entries").select("id,text,mood,energy,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("letters").select("id,title,body,period_start,period_end,delivered_at,summary_json,themes,recommendations,postscript,model,prompt_version").eq("user_id", userId).order("delivered_at", { ascending: false }),
    supabase.from("notification_settings").select("enabled,schedule_mode,start_time,interval_minutes,dnd_start,dnd_end,weekdays,fixed_times").eq("user_id", userId).maybeSingle(),
    supabase.from("app_settings").select("preferences").eq("user_id", userId).maybeSingle()
  ]);

  if (entriesResult.error) throw { ...entriesResult.error, message: `entries 불러오기 실패: ${entriesResult.error.message}` };
  if (lettersResult.error) throw { ...lettersResult.error, message: `letters 불러오기 실패: ${lettersResult.error.message}` };
  if (notificationResult.error) throw { ...notificationResult.error, message: `notification_settings 불러오기 실패: ${notificationResult.error.message}` };
  if (settingsResult.error) throw { ...settingsResult.error, message: `app_settings 불러오기 실패: ${settingsResult.error.message}` };

  const preferences = (settingsResult.data as AppSettingsRow | null)?.preferences || {};

  return {
    ...local,
    entries: ((entriesResult.data || []) as EntryRow[]).map(rowToEntry),
    letters: ((lettersResult.data || []) as LetterRow[]).map(rowToLetter),
    settings: notificationResult.data ? rowToSettings(notificationResult.data as NotificationSettingsRow) : local.settings,
    theme: normalizeColorTheme(preferences.theme || local.theme),
    energyColorMode: preferences.energyColorMode || local.energyColorMode,
    calendarEnergyMode: preferences.calendarEnergyMode || local.calendarEnergyMode,
    targetMoods: preferences.targetMoods || local.targetMoods || [],
    letterPaperStyle: normalizeLetterPaperStyle(preferences.letterPaperStyle || local.letterPaperStyle)
  };
}

export async function syncAppState(user: User, local: AppState): Promise<AppState> {
  try {
    await upsertProfile(user);
  } catch (error) {
    console.warn("Supabase profile upsert skipped", error);
  }
  const normalized = await pushAppState(user.id, local);
  return pullAppState(user.id, normalized);
}

export async function generateDueLetters(today?: string) {
  const { data, error } = await supabase.functions.invoke("generate-letter", {
    body: today ? { today } : {}
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const message = await context.clone().json()
        .then((body) => body?.error || body?.message || JSON.stringify(body))
        .catch(() => context.clone().text())
        .catch(() => error.message);
      throw new Error(`${message} (${context.status})`);
    }
    throw error;
  }
  return data as { generated?: number; updated?: number; skipped?: number; letters?: string[] };
}

export async function upsertEntry(userId: string, entry: Entry) {
  const normalized = isUuid(entry.id) ? entry : { ...entry, id: createId() };
  const { error } = await supabase.from("entries").upsert(entryToRow(userId, normalized));
  if (error) throw { ...error, message: `entries 저장 실패: ${error.message}` };
  return normalized;
}

export async function deleteRemoteEntries(userId: string, entryIds: string[]) {
  const ids = entryIds.filter(isUuid);
  if (!ids.length) return;
  const { error } = await supabase.from("entries").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

export async function deleteRemoteUserData(userId: string) {
  const tables = [
    "entries",
    "letters",
    "letter_periods",
    "push_tokens",
    "notification_settings",
    "app_settings"
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw { ...error, message: `${table} 삭제 실패: ${error.message}` };
  }
}

export async function upsertRemoteSettings(userId: string, state: AppState) {
  await pushAppState(userId, state);
}
