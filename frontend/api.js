import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://192.168.1.211:5000";
const authExpiredListeners = new Set();
let authExpirationHandled = false;

export function subscribeToAuthExpired(listener) {
  authExpiredListeners.add(listener);

  return () => {
    authExpiredListeners.delete(listener);
  };
}

async function handleAuthExpired() {
  if (authExpirationHandled) return;
  authExpirationHandled = true;

  await AsyncStorage.removeItem("token");
  authExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.log("Auth expiry listener error:", error?.message || error);
    }
  });
}

export async function apiFetch(path, options = {}) {
  const {
    skipAuth = false,
    headers: extraHeaders,
    ...rest
  } = options;

  const token = await AsyncStorage.getItem("token");

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
