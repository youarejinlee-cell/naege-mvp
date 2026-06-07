import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

WebBrowser.maybeCompleteAuthSession();

const authStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key)
};

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL || "https://example.supabase.co", SUPABASE_ANON_KEY || "anon-key", {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export function getNativeRedirectUri() {
  return AuthSession.makeRedirectUri({
    path: "auth/callback"
  });
}

export function getStandaloneRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: "logtoletter",
    path: "auth/callback"
  });
}

export function getGoogleRedirectUri() {
  return "logtoletter://auth/callback";
}

function getAuthParams(url: string) {
  const hash = url.includes("#") ? url.split("#")[1] : "";
  const query = url.includes("?") ? url.split("?")[1] : "";
  const params = new URLSearchParams(hash || query);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    code: params.get("code")
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle(): Promise<Session | null> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase 설정이 필요해.");
  }

  const redirectTo = getGoogleRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (error) throw error;
  if (!data.url) throw new Error("Google 로그인 URL을 만들지 못했어.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;

  const { accessToken, refreshToken, code } = getAuthParams(result.url);
  if (code) {
    const { data: codeData, error: codeError } = await supabase.auth.exchangeCodeForSession(code);
    if (codeError) throw codeError;
    return codeData.session;
  }

  if (!accessToken || !refreshToken) {
    throw new Error(`로그인 토큰을 받지 못했어. Redirect URL: ${result.url}`);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (sessionError) throw sessionError;
  return sessionData.session;
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function deleteAccount() {
  if (!isSupabaseConfigured) throw new Error("Supabase 설정이 필요해.");
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) throw error;
}
