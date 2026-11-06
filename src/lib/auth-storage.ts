import type { SupportedStorage } from "@supabase/supabase-js";
import { forgetRememberedAuthTab, initializeAuthTabId, rememberAuthTab } from "./auth-tab";

const rememberPreferenceKey = "fluxary.remember-session";

const authTokenPrefix = `sb-${getProjectRef()}-auth-token-`;
export const authTabId = await initializeAuthTabId({ authTokenPrefix });
export const authStorageKey = `${authTokenPrefix}${authTabId}`;
const tabRememberPreferenceKey = `${rememberPreferenceKey}:${authTabId}`;
let rememberSession = readRememberPreference();

export const authStorage: SupportedStorage = {
  getItem(key) {
    return getSelectedStorage().getItem(key);
  },
  setItem(key, value) {
    getSelectedStorage().setItem(key, value);
  },
  removeItem(key) {
    getSelectedStorage().removeItem(key);
  },
};

export function getRememberSessionPreference() {
  return rememberSession;
}

export function setRememberSessionPreference(remember: boolean) {
  const previousStorage = getSelectedStorage();
  rememberSession = remember;
  const nextStorage = getSelectedStorage();
  const keysToMove = getAuthStorageKeys(previousStorage);
  for (const key of keysToMove) {
    const value = previousStorage.getItem(key);
    if (value !== null) nextStorage.setItem(key, value);
    previousStorage.removeItem(key);
  }
  window.sessionStorage.setItem(tabRememberPreferenceKey, String(remember));
  if (!remember) forgetRememberedAuthTab(authTabId);
}

export function rememberCurrentAuthSession() {
  if (rememberSession) rememberAuthTab(authTabId);
}

export function clearAuthSession() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of getAuthStorageKeys(storage)) storage.removeItem(key);
  }
  forgetRememberedAuthTab(authTabId);
}

export function clearRememberedAuthSession() {
  forgetRememberedAuthTab(authTabId);
}

function readRememberPreference() {
  const storedPreference = window.sessionStorage.getItem(tabRememberPreferenceKey)
    ?? window.localStorage.getItem(rememberPreferenceKey);
  if (storedPreference !== null) return storedPreference === "true";
  return getAuthStorageKeys(window.localStorage).length > 0;
}

function getSelectedStorage(): Storage {
  return rememberSession ? window.localStorage : window.sessionStorage;
}

function getAuthStorageKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string =>
      key !== null && (key === authStorageKey || key.startsWith(`${authStorageKey}-`)),
    );
}

function getProjectRef() {
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!configuredUrl) return "unconfigured";
  try {
    return new URL(configuredUrl).hostname.split(".")[0];
  } catch {
    return "unconfigured";
  }
}
