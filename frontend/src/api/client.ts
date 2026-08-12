import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://home-sync-10.preview.emergentagent.com';
const TOKEN_KEY = 'lotus_token';
const QUEUE_KEY = 'lotus_sync_queue';
const CACHE_PREFIX = 'lotus_cache_';

// ----------- Token storage -----------
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function setToken(token: string | null) {
  if (Platform.OS === 'web') {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
export { getToken };

// ----------- Sync queue -----------
type QueuedOp = { id: string; method: string; path: string; body?: any; created_at: string };

async function readQueue(): Promise<QueuedOp[]> {
  const v = await AsyncStorage.getItem(QUEUE_KEY);
  return v ? JSON.parse(v) : [];
}
async function writeQueue(q: QueuedOp[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
export async function pendingSyncCount(): Promise<number> {
  return (await readQueue()).length;
}
async function enqueue(op: Omit<QueuedOp, 'id' | 'created_at'>) {
  const q = await readQueue();
  q.push({ ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() });
  await writeQueue(q);
}
export async function clearQueue() { await writeQueue([]); }

let syncing = false;
export async function replayQueue(): Promise<{ synced: number; remaining: number }> {
  if (syncing) return { synced: 0, remaining: (await readQueue()).length };
  syncing = true;
  try {
    const q = await readQueue();
    const remaining: QueuedOp[] = [];
    let synced = 0;
    for (const op of q) {
      try {
        await rawFetch(op.method, op.path, op.body, /* offlineFallback */ false);
        synced += 1;
      } catch {
        remaining.push(op);
      }
    }
    await writeQueue(remaining);
    return { synced, remaining: remaining.length };
  } finally {
    syncing = false;
  }
}

// ----------- Fetch with offline handling -----------
async function rawFetch(method: string, path: string, body?: any, offlineFallback = true) {
  const token = await getToken();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

async function cacheGet(path: string, data: any) {
  try { await AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ data, at: Date.now() })); } catch {}
}
async function cacheRead(path: string): Promise<any | null> {
  try {
    const v = await AsyncStorage.getItem(CACHE_PREFIX + path);
    if (!v) return null;
    return JSON.parse(v).data;
  } catch { return null; }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body as string) : options.body) : undefined;

  // Try network
  try {
    const data = await rawFetch(method, path, body, true);
    if (method === 'GET') await cacheGet(path, data);
    return data as T;
  } catch (e: any) {
    const netState = await NetInfo.fetch().catch(() => null);
    const offline = netState ? netState.isConnected === false : /Network request failed|Failed to fetch/i.test(e?.message || '');

    if (method === 'GET') {
      const cached = await cacheRead(path);
      if (cached !== null) return cached as T;
      throw e;
    }

    if (offline && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      await enqueue({ method, path, body });
      // Return an optimistic stub
      return { queued: true, offline: true, path, body } as unknown as T;
    }
    throw e;
  }
}

// Register network listener that auto-replays queue on reconnect
let listenerRegistered = false;
export function registerAutoSync(onDone?: (r: { synced: number; remaining: number }) => void) {
  if (listenerRegistered) return;
  listenerRegistered = true;
  NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const r = await replayQueue();
      onDone?.(r);
    }
  });
}
