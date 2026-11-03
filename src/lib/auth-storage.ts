import type { SupportedStorage } from "@supabase/supabase-js";

const rememberPreferenceKey = "fluxary.remember-session";
const authTokenKeyPattern = /^sb-.+-auth-token$/;
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
  const keysToMove = getAuthTokenKeys(previousStorage);
  for (const key of keysToMove) {
    const value = previousStorage.getItem(key);
    if (value !== null) nextStorage.setItem(key, value);
    previousStorage.removeItem(key);
  }
  window.localStorage.setItem(rememberPreferenceKey, String(remember));
}

function readRememberPreference() {
  const storedPreference = window.localStorage.getItem(rememberPreferenceKey);
  if (storedPreference !== null) return storedPreference === "true";
  return getAuthTokenKeys(window.localStorage).length > 0;
}

function getSelectedStorage(): Storage {
  return rememberSession ? window.localStorage : window.sessionStorage;
}

function getAuthTokenKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && authTokenKeyPattern.test(key));
}
