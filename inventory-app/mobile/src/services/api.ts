import AsyncStorage from "@react-native-async-storage/async-storage";

// Default to the current live cloud instance (/api)
export const DEFAULT_API_URL = "https://ais-pre-tmyu5h3l35eoaqzcyclo53-895653288134.europe-west2.run.app/api";

async function getBaseUrl() {
  const custom = await AsyncStorage.getItem("custom_api_url");
  return custom || DEFAULT_API_URL;
}

async function authHeader() {
  const token = await AsyncStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, options: RequestInit = {}) {
  const baseUrl = await getBaseUrl();
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...(options.headers || {}),
  };
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  myTasks: () => request("/audit-tasks/mine"),

  itemByBarcode: (barcode: string) => request(`/items/barcode/${encodeURIComponent(barcode)}`),

  recentRecords: (taskId: string, limit = 5) =>
    request(`/audit-records/task/${taskId}/recent?limit=${limit}`),

  submitRecord: (record: object) =>
    request("/audit-records", { method: "POST", body: JSON.stringify(record) }),

  syncBatch: (records: object[]) =>
    request("/audit-records/sync", { method: "POST", body: JSON.stringify({ records }) }),

  registerFcmToken: (fcmToken: string) =>
    request("/users/me/fcm-token", { method: "POST", body: JSON.stringify({ fcmToken }) }),

  reportUnregisteredItem: (payload: object) =>
    request("/audit-records/pending-items", { method: "POST", body: JSON.stringify(payload) }),
};
