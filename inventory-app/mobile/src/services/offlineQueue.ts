import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

const QUEUE_KEY = "pending_audit_records";
const PENDING_ITEMS_QUEUE_KEY = "pending_unregistered_items";

export interface QueuedRecord {
  taskId: string;
  itemId: string | null;
  barcodeScanned: string;
  locationLabel: string;
  unitName: string;
  qtyInUnit: number;
  qtyPerUnit: number;
  condition: "NORMAL" | "DAMAGED";
  photoUrl?: string;
  deviceTimestamp: string; // captured at scan time, used for ordering on the server
}

// Every scan is appended locally first — the UI never waits on the network.
// This mirrors the server's append-only design: nothing here is ever
// "updated", a correction is just another queued record (e.g. from the
// +/- quantity buttons) that the server aggregates during report generation.
export async function enqueueRecord(record: QueuedRecord) {
  const existing = await getQueue();
  existing.push(record);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
}

export async function getQueue(): Promise<QueuedRecord[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getRecentFromQueue(taskId: string, limit = 5): Promise<QueuedRecord[]> {
  const all = await getQueue();
  return all.filter((r) => r.taskId === taskId).slice(-limit).reverse();
}

// Flushes the local queue to the server in one batch call, tied to the
// logged-in employee's account (the server reads employeeId from the JWT,
// not from the payload). Clears the queue only after a confirmed success.
export async function flushQueue(): Promise<{ synced: number } | null> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return null;

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0 };

  await api.syncBatch(queue);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
  return { synced: queue.length };
}

// Same append-and-flush pattern as scans, for unregistered-item reports
// captured in NewItemScreen while offline (photos + name/price/quantity).
export async function enqueueUnregisteredItem(payload: object) {
  const raw = await AsyncStorage.getItem(PENDING_ITEMS_QUEUE_KEY);
  const existing = raw ? JSON.parse(raw) : [];
  existing.push(payload);
  await AsyncStorage.setItem(PENDING_ITEMS_QUEUE_KEY, JSON.stringify(existing));
}

async function flushUnregisteredItemsQueue(): Promise<number> {
  const raw = await AsyncStorage.getItem(PENDING_ITEMS_QUEUE_KEY);
  const queue: object[] = raw ? JSON.parse(raw) : [];
  if (queue.length === 0) return 0;

  const remaining: object[] = [];
  let succeeded = 0;
  for (const payload of queue) {
    try {
      await api.reportUnregisteredItem(payload);
      succeeded++;
    } catch {
      remaining.push(payload); // keep it queued if the upload itself failed
    }
  }
  await AsyncStorage.setItem(PENDING_ITEMS_QUEUE_KEY, JSON.stringify(remaining));
  return succeeded;
}

// Call this once at app startup and whenever connectivity changes.
export function watchConnectivityAndFlush(onSynced?: (count: number) => void) {
  return NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const result = await flushQueue().catch(() => null);
      const itemsSynced = await flushUnregisteredItemsQueue().catch(() => 0);
      const total = (result?.synced ?? 0) + itemsSynced;
      if (total > 0) onSynced?.(total);
    }
  });
}
