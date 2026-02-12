// Google Apps Script API service layer
// All calls go through the deployed Apps Script web app URL from .env

const BASE_URL = import.meta.env.VITE_APPSCRIPT_URL as string;

if (!BASE_URL) {
  console.error(
    "VITE_APPSCRIPT_URL is not set. Create a .env file with your Apps Script deployment URL.",
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
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/** Force-clear a specific cache key or the entire cache. */
export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
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

  // Invalidate stock & component caches after a successful borrow
  invalidateCache("getLiveStock");
  invalidateCache(`getComponents:${caseName}`);

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

  // Invalidate stock cache after a successful return
  invalidateCache("getLiveStock");

  return {
    success: true,
    message: `Successfully returned ${quantity}x ${component}!`,
  };
}

/**
 * Fetch live stock for admin/dashboard view.
 * GET ?action=getLiveStock
 * → [{ component: "MG996R Servo", stock: 3 }, ...]
 */
export async function fetchLiveStock(): Promise<StockItem[]> {
  return cachedGet<StockItem[]>("getLiveStock", { action: "getLiveStock" });
}
