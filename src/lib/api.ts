// API service layer
// Apps Script handles mutations (borrow, return) + lightweight reads (cases, components, holdings)
// Google Sheets API handles the heavy read (live stock) — much faster than Apps Script

import { sendBorrowAlert, sendReturnAlert } from "./email";

const BASE_URL = import.meta.env.VITE_APPSCRIPT_URL as string;
const SHEETS_API_KEY = import.meta.env.VITE_SHEETS_API_KEY as string;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID as string;

if (!BASE_URL) {
  console.error(
    "VITE_APPSCRIPT_URL is not set. Create a .env file with your Apps Script deployment URL.",
  );
}
if (!SHEETS_API_KEY || !SPREADSHEET_ID) {
  console.error(
    "VITE_SHEETS_API_KEY or VITE_SPREADSHEET_ID is not set. Live stock will fall back to Apps Script.",
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Holding {
  component: string;
  outstanding: number;
}

export interface StockItem {
  component: string;
  stock: number;
  caseName: string;
}

// ─── Cache (memory + localStorage) ───────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const STORAGE_PREFIX = "inv-cache:";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  // Memory first
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.timestamp <= CACHE_TTL_MS) {
    return mem.data as T;
  }
  if (mem) memCache.delete(key);

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp <= CACHE_TTL_MS) {
        memCache.set(key, entry); // hydrate memory
        return entry.data as T;
      }
      localStorage.removeItem(STORAGE_PREFIX + key);
    }
  } catch {
    /* ignore parse / quota errors */
  }

  return null;
}

/**
 * Read cached data even if the TTL has expired.
 * Used for stale-while-revalidate: show old data instantly, refresh behind.
 */
function getStaleCached<T>(key: string): T | null {
  const mem = memCache.get(key);
  if (mem) return mem.data as T;

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) {
      const entry: CacheEntry<T> = JSON.parse(raw);
      memCache.set(key, entry);
      return entry.data as T;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  memCache.set(key, entry);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* ignore quota errors */
  }
}

/** Force-clear a specific cache key or the entire cache. */
export function invalidateCache(key?: string): void {
  if (key) {
    memCache.delete(key);
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
  } else {
    memCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * GET with cache — returns cached data if fresh, otherwise fetches and caches.
 * `cacheKey` must be unique per request.
 */
async function cachedGet<T>(
  cacheKey: string,
  params: Record<string, string>,
): Promise<T> {
  const hit = getCached<T>(cacheKey);
  if (hit) return hit;

  const data = await get<T>(params);
  setCache(cacheKey, data);
  return data;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // Apps Script doesn't support application/json for CORS
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateNotEmpty(value: string, fieldName: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function validatePositiveInt(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch all available case names for the dropdown.
 * GET ?action=getCases → ["TSYS Case1", "TSXS Case2"]
 */
export async function fetchCases(): Promise<string[]> {
  return cachedGet<string[]>("getCases", { action: "getCases" });
}

/**
 * Fetch component names for a given case.
 * GET ?action=getComponents&case=<caseName> → ["MG996R Servo", "SG90 Servo"]
 */
export async function fetchComponentsByCase(
  caseName: string,
): Promise<string[]> {
  validateNotEmpty(caseName, "Case name");
  return cachedGet<string[]>(`getComponents:${caseName}`, {
    action: "getComponents",
    case: caseName,
  });
}

/**
 * Submit a borrow transaction.
 * POST { action: "borrow", userId, caseName, component, quantity }
 * → { success: true } or { error: "Not enough stock available" }
 */
export async function borrowComponent(
  userId: string,
  caseName: string,
  component: string,
  quantity: number,
): Promise<{ success: boolean; message: string }> {
  validateNotEmpty(userId, "User ID");
  validateNotEmpty(caseName, "Case name");
  validateNotEmpty(component, "Component");
  validatePositiveInt(quantity, "Quantity");

  const data = await post<{ success?: boolean; error?: string }>({
    action: "borrow",
    userId: userId.trim(),
    caseName,
    component,
    quantity,
  });

  if (data.error) {
    return { success: false, message: data.error };
  }

  // No cache invalidation — backend cache auto-clears on borrow; let caching handle stock updates

  // Send email alert (non-blocking)
  sendBorrowAlert({ userId, component, quantity, caseName }).catch((err) =>
    console.error("Failed to send borrow alert:", err),
  );

  return {
    success: true,
    message: `Successfully borrowed ${quantity}x ${component}!`,
  };
}

/**
 * Fetch what a user currently holds (active borrows).
 * GET ?action=getUserHoldings&userId=<id>
 * → [{ component: "MG996R Servo", outstanding: 2 }, ...]
 */
export async function fetchUserHoldings(userId: string): Promise<Holding[]> {
  validateNotEmpty(userId, "User ID");
  return get<Holding[]>({ action: "getUserHoldings", userId: userId.trim() });
}

/**
 * Submit a return transaction.
 * POST { action: "return", userId, component, quantity }
 * → { success: true } or { error: "Return quantity exceeds borrowed amount" }
 */
export async function returnComponent(
  userId: string,
  component: string,
  quantity: number,
): Promise<{ success: boolean; message: string }> {
  validateNotEmpty(userId, "User ID");
  validateNotEmpty(component, "Component");
  validatePositiveInt(quantity, "Quantity");

  const data = await post<{ success?: boolean; error?: string }>({
    action: "return",
    userId: userId.trim(),
    component,
    quantity,
  });

  if (data.error) {
    return { success: false, message: data.error };
  }

  // No cache invalidation — backend cache auto-clears on return; let caching handle stock updates

  // Send email alert (non-blocking)
  sendReturnAlert({ userId, component, quantity }).catch((err) =>
    console.error("Failed to send return alert:", err),
  );

  return {
    success: true,
    message: `Successfully returned ${quantity}x ${component}!`,
  };
}

/**
 * Sheets API response shape for spreadsheets.values.get
 */
interface SheetsValuesResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

/**
 * Fetch live stock via Google Sheets API (fast, read-only).
 * Falls back to Apps Script if Sheets API keys are missing.
 *
 * Sheet columns:  A=Case  B=Component  C=Initial  D=Borrowed  E=Returned  F=Current_Stock
 * We read A2:F (skip header row) and map to StockItem[].
 */
export async function fetchLiveStock(): Promise<StockItem[]> {
  // Return from cache if still fresh
  const cached = getCached<StockItem[]>("getLiveStock");
  if (cached) return cached;

  // Prefer Sheets API for speed; fall back to Apps Script
  if (SHEETS_API_KEY && SPREADSHEET_ID) {
    const data = await fetchLiveStockFromSheets();
    setCache("getLiveStock", data);
    return data;
  }

  // Fallback: Apps Script
  const data = await get<StockItem[]>({ action: "getLiveStock" });
  setCache("getLiveStock", data);
  return data;
}

async function fetchLiveStockFromSheets(): Promise<StockItem[]> {
  const range = encodeURIComponent("Live_Stock!A2:F");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Sheets API request failed: ${res.status} ${res.statusText}`,
    );
  }

  const json: SheetsValuesResponse = await res.json();
  const rows = json.values ?? [];

  return rows
    .filter((row) => row[1]?.trim()) // skip rows with no component name
    .map((row) => ({
      caseName: (row[0] ?? "Unknown").trim(),
      component: row[1].trim(),
      stock: parseInt(row[5] ?? "0", 10) || 0,
    }));
}

/**
 * Return cached live stock instantly (even if stale / expired).
 * Used by the Admin/Inventory page for stale-while-revalidate.
 */
export function getCachedLiveStock(): StockItem[] | null {
  return getStaleCached<StockItem[]>("getLiveStock");
}

// ─── TinkerHub Check-In Validation ───────────────────────────────────────────

const TINKERHUB_API = "https://app-api.tinkerhub.org";

interface TinkerHubMember {
  id: number;
  name: string;
  username: string;
  avatar: string;
  [key: string]: unknown;
}

interface ActiveCheckIn {
  mid: number;
  membershipId: number;
  name: string;
  [key: string]: unknown;
}

/**
 * Look up a TinkerHub member by username.
 * GET https://app-api.tinkerhub.org/v1/public/member/username/{username}
 * Returns the member object (we mainly need `id`).
 */
export async function fetchMemberByUsername(
  username: string,
): Promise<TinkerHubMember> {
  const cleanUsername = username.replace(/^@/, "").trim();
  validateNotEmpty(cleanUsername, "Username");

  const res = await fetch(
    `${TINKERHUB_API}/v1/public/member/username/${encodeURIComponent(cleanUsername)}`,
  );
  if (!res.ok) {
    throw new Error("Member not found. Please check your Hub ID.");
  }
  return res.json() as Promise<TinkerHubMember>;
}

/**
 * Fetch all currently active check-ins.
 * GET https://app-api.tinkerhub.org/checkin/active
 */
async function fetchActiveCheckins(): Promise<ActiveCheckIn[]> {
  const cached = getCached<ActiveCheckIn[]>("activeCheckins");
  if (cached) return cached;

  const res = await fetch(`${TINKERHUB_API}/checkin/active`);
  if (!res.ok) {
    throw new Error("Failed to fetch active check-ins.");
  }
  const data = (await res.json()) as ActiveCheckIn[];
  // Short TTL — 2 minutes so check-in status stays reasonably fresh
  setCache("activeCheckins", data);
  return data;
}

/**
 * Validate that a user (by Hub username) is currently checked in.
 *
 * 1. Resolve username → member id
 * 2. Check if that id appears in the active check-in list
 *
 * Returns { active: true, name } if checked in, { active: false } otherwise.
 */
export async function validateUserActive(
  username: string,
): Promise<{ active: boolean; name: string; avatar: string }> {
  // Step 1: Resolve username to member id
  const member = await fetchMemberByUsername(username);
  const memberId = member.id;

  // Step 2: Check active check-ins
  const activeList = await fetchActiveCheckins();
  const match = activeList.find(
    (entry) => entry.mid === memberId || entry.membershipId === memberId,
  );

  if (match) {
    return {
      active: true,
      name: match.name || member.name,
      avatar: member.avatar,
    };
  }

  return { active: false, name: member.name, avatar: member.avatar };
}
