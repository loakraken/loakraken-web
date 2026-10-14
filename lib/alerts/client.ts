import type { BackendFailure, BackendResult } from "../api/backend";
import {
  TOKEN_HEADER,
  type AlertItemsEnvelope,
  type Comparator,
  type ConditionEnvelope,
  type ConditionsEnvelope,
  type DoneEnvelope,
  type SubscribeBody,
  type SubscriptionEnvelope,
  type VapidKeyEnvelope,
} from "./model";

export class AlertQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(input, { ...init, cache: "no-store" });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new AlertQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof AlertQueryError || init.signal?.aborted) throw error;
    throw new AlertQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

/** This browser's subscription: the id and the manage token the backend gave once. */
export type Owned = { subscriptionId: string; token: string };
const KEY = "loakraken.priceAlerts";
const json = { "Content-Type": "application/json" };
const withToken = (own: Owned, extra: Record<string, string> = {}) => ({ [TOKEN_HEADER]: own.token, ...extra });

export const fetchAlertItems = (signal?: AbortSignal) => call<AlertItemsEnvelope>("/api/alerts/items", { signal });
export const fetchConditions = (own: Owned, signal?: AbortSignal) =>
  call<ConditionsEnvelope>(`/api/alerts/subscriptions/${own.subscriptionId}/conditions`, {
    headers: withToken(own),
    signal,
  });
export const addCondition = (own: Owned, body: { itemId: number; comparator: Comparator; price: number }) =>
  call<ConditionEnvelope>(`/api/alerts/subscriptions/${own.subscriptionId}/conditions`, {
    method: "POST",
    headers: withToken(own, json),
    body: JSON.stringify(body),
  });
export const deleteCondition = (own: Owned, conditionId: string) =>
  call<DoneEnvelope>(`/api/alerts/subscriptions/${own.subscriptionId}/conditions/${conditionId}`, {
    method: "DELETE",
    headers: withToken(own),
  });

/** The stored subscription, or null (none, unreadable storage, or a malformed entry). */
export function readOwned(): Owned | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const { subscriptionId, token } = value as Record<string, unknown>;
    return typeof subscriptionId === "string" && typeof token === "string" ? { subscriptionId, token } : null;
  } catch {
    return null;
  }
}
function saveOwned(own: Owned | null) {
  try {
    if (own) localStorage.setItem(KEY, JSON.stringify(own));
    else localStorage.removeItem(KEY);
  } catch {
    /* Private mode: the subscription lasts this page only. */
  }
}

/** Web push needs a service worker, PushManager and notifications (iOS: the home-screen app). */
export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const SW = "/alerts-sw.js";
const SCOPE = "/market/alerts";

function keyBytes(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

export type TurnOnResult = { ok: true; own: Owned } | { ok: false; reason: "denied" | "unsupported" | "failed"; code?: string };

/**
 * Asks for permission (on the visitor's press only), subscribes this browser
 * to push with our key and registers it; the backend sends one confirmation
 * notification before keeping it. The token is kept in this browser only.
 */
export async function turnOn(): Promise<TurnOnResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const key = await call<VapidKeyEnvelope>("/api/alerts/vapid-public-key");
    const registration = await navigator.serviceWorker.register(SW, { scope: SCOPE, updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const serverKey = keyBytes(key.data.publicKey);
    let subscription = await registration.pushManager.getSubscription();
    // One made under an earlier key cannot receive what the current key signs.
    if (subscription && !sameBytes(subscription.options.applicationServerKey, serverKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
    const body = subscription.toJSON() as SubscribeBody;
    const made = await call<SubscriptionEnvelope>("/api/alerts/subscriptions", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys }),
    });
    const own = { subscriptionId: made.data.subscriptionId, token: made.data.manageToken };
    saveOwned(own);
    return { ok: true, own };
  } catch (error) {
    return { ok: false, reason: "failed", code: error instanceof AlertQueryError ? error.info.code : undefined };
  }
}

/** Turns alerts off: the backend forgets the subscription and its conditions, the browser its push subscription. */
export async function turnOff(own: Owned) {
  await call<DoneEnvelope>(`/api/alerts/subscriptions/${own.subscriptionId}`, {
    method: "DELETE",
    headers: withToken(own),
  }).catch((error: unknown) => {
    // Already gone on the backend: nothing left to delete there.
    if (!(error instanceof AlertQueryError && error.info.code === "ALERT_SUBSCRIPTION_NOT_FOUND")) throw error;
  });
  forget();
  try {
    const registration = await navigator.serviceWorker.getRegistration(SCOPE);
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* The backend no longer sends to it either way. */
  }
}

/** The stored subscription no longer exists on the backend (cleaned up, or turned off elsewhere). */
export function forget() {
  saveOwned(null);
}
