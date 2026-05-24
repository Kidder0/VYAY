import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const LOCAL_BASE_URL = "http://192.168.1.211:5000";
const WEB_BASE_URL =
  typeof window !== "undefined" && window.location?.hostname && window.location.hostname !== "localhost"
    ? ""
    : process.env.EXPO_PUBLIC_API_URL || LOCAL_BASE_URL;
const BASE_URL = Platform.OS === "web" ? WEB_BASE_URL : process.env.EXPO_PUBLIC_API_URL || LOCAL_BASE_URL;
export const MEMBER_TOKEN_KEY = "token";
export const ADMIN_TOKEN_KEY = "admin_token";
export const APP_MODE_KEY = "app_mode";
export const APP_MODE_MEMBER = "member";
export const APP_MODE_ADMIN = "admin";
const authExpiredListeners = new Set();
const adminAuthExpiredListeners = new Set();
const sessionChangeListeners = new Set();
let authExpirationHandled = false;
let adminAuthExpirationHandled = false;

export function subscribeToAuthExpired(listener) {
  authExpiredListeners.add(listener);

  return () => {
    authExpiredListeners.delete(listener);
  };
}

export function subscribeToSessionChanges(listener) {
  sessionChangeListeners.add(listener);

  return () => {
    sessionChangeListeners.delete(listener);
  };
}

async function persistAppMode(mode) {
  if (mode) {
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
  } else {
    await AsyncStorage.removeItem(APP_MODE_KEY);
  }
}

export async function getSessionSnapshot() {
  const [memberToken, adminToken, appMode] = await Promise.all([
    AsyncStorage.getItem(MEMBER_TOKEN_KEY),
    AsyncStorage.getItem(ADMIN_TOKEN_KEY),
    AsyncStorage.getItem(APP_MODE_KEY),
  ]);

  return {
    memberToken,
    adminToken,
    appMode,
  };
}

async function emitSessionChange(snapshot) {
  const nextSnapshot = snapshot || (await getSessionSnapshot());

  sessionChangeListeners.forEach((listener) => {
    try {
      listener(nextSnapshot);
    } catch (error) {
      console.log("Session change listener error:", error?.message || error);
    }
  });

  return nextSnapshot;
}

export async function setActiveAppMode(mode) {
  await persistAppMode(mode);
  return emitSessionChange();
}

export async function clearAppMode() {
  await persistAppMode(null);
  return emitSessionChange();
}

export async function setMemberSession(token) {
  const adminToken = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);

  await AsyncStorage.setItem(MEMBER_TOKEN_KEY, token);
  await persistAppMode(APP_MODE_MEMBER);

  return emitSessionChange({
    memberToken: token,
    adminToken,
    appMode: APP_MODE_MEMBER,
  });
}

export async function clearMemberSession() {
  const adminToken = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  const nextMode = null;

  await AsyncStorage.removeItem(MEMBER_TOKEN_KEY);
  await persistAppMode(nextMode);

  return emitSessionChange({
    memberToken: null,
    adminToken,
    appMode: nextMode,
  });
}

export async function setAdminSession(token) {
  const memberToken = await AsyncStorage.getItem(MEMBER_TOKEN_KEY);

  await AsyncStorage.setItem(ADMIN_TOKEN_KEY, token);
  await persistAppMode(APP_MODE_ADMIN);

  return emitSessionChange({
    memberToken,
    adminToken: token,
    appMode: APP_MODE_ADMIN,
  });
}

export async function clearAdminSession() {
  const memberToken = await AsyncStorage.getItem(MEMBER_TOKEN_KEY);
  const nextMode = memberToken ? APP_MODE_MEMBER : null;

  await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
  await persistAppMode(nextMode);

  return emitSessionChange({
    memberToken,
    adminToken: null,
    appMode: nextMode,
  });
}

async function handleAuthExpired() {
  if (authExpirationHandled) return;
  authExpirationHandled = true;

  await clearMemberSession();
  authExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.log("Auth expiry listener error:", error?.message || error);
    }
  });
}

export function subscribeToAdminAuthExpired(listener) {
  adminAuthExpiredListeners.add(listener);

  return () => {
    adminAuthExpiredListeners.delete(listener);
  };
}

async function handleAdminAuthExpired() {
  if (adminAuthExpirationHandled) return;
  adminAuthExpirationHandled = true;

  await clearAdminSession();
  adminAuthExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.log("Admin auth expiry listener error:", error?.message || error);
    }
  });
}

export async function apiFetch(path, options = {}) {
  const {
    skipAuth = false,
    headers: extraHeaders,
    ...rest
  } = options;

  const token = await AsyncStorage.getItem(MEMBER_TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
  });

  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuth) {
      await handleAuthExpired();
    }

    throw new Error(data.message || `Request failed (${res.status})`);
  }

  authExpirationHandled = false;
  return data;
}

export async function adminApiFetch(path, options = {}) {
  const {
    skipAuth = false,
    headers: extraHeaders,
    ...rest
  } = options;

  const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
  });

  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const message = String(data.message || "");
    const tokenError =
      res.status === 401 ||
      (res.status === 403 &&
        (message.toLowerCase().includes("token") ||
          message.toLowerCase().includes("expired")));

    if (tokenError && !skipAuth) {
      await handleAdminAuthExpired();
    }

    throw new Error(data.message || `Request failed (${res.status})`);
  }

  adminAuthExpirationHandled = false;
  return data;
}
