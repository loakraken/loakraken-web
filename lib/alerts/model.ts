// Price alerts by web push (api #482·#486·#491, checklist M33): no login, one
// anonymous subscription per browser. The backend hands a manage token once;
// the browser keeps it and sends it as X-Alert-Token (never in an address).
// Alerts fire when an item's lowest listing price crosses the line, only for
// the items the market warmup already refreshes (no extra official calls).

import type { components } from "../api/alerts-schema";
import { type ForwardContext } from "../api/backend";

type Schemas = components["schemas"];
export type VapidKeyEnvelope = Schemas["ApiResponseVapidKeyResponse"];
export type AlertItemsEnvelope = Schemas["ApiResponseListAlertItemResponse"];
export type AlertItem = Schemas["AlertItemResponse"];
export type SubscriptionEnvelope = Schemas["ApiResponseSubscriptionResponse"];
export type ConditionsEnvelope = Schemas["ApiResponseListConditionResponse"];
export type ConditionEnvelope = Schemas["ApiResponseConditionResponse"];
export type AlertCondition = Schemas["ConditionResponse"];
export type DoneEnvelope = { code: string; message: string; data: null };

export const ALERT_SUCCESS = "ALERT_SUCCESS";
/** The backend's limit per subscription (alerts.push.max-conditions-per-subscription). */
export const MAX_CONDITIONS = 10;
export const COMPARATORS = ["AT_OR_BELOW", "AT_OR_ABOVE"] as const;
export type Comparator = (typeof COMPARATORS)[number];
/** The manage token travels in this header only. */
export const TOKEN_HEADER = "X-Alert-Token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids the routes pass on: a UUID, nothing else reaches the backend path. */
export const isAlertId = (value: string) => UUID.test(value);
/** The token as the backend makes it (32 random bytes, base64url), at most 128 characters. */
export const isManageToken = (value: string | null): value is string =>
  !!value && /^[A-Za-z0-9_-]{16,128}$/.test(value);

/** A browser push subscription as the backend takes it (PushSubscription.toJSON()). */
export type SubscribeBody = { endpoint: string; keys: { p256dh: string; auth: string } };
export function parseSubscribeBody(value: unknown): SubscribeBody | null {
  if (!value || typeof value !== "object") return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1024) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 128 || keys.auth.length > 64) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export type ConditionBody = { itemId: number; comparator: Comparator; price: number };
/** 0.01 ~ 999,999,999,999.99 gold, two decimals at most (the backend's bounds). */
export function parseConditionBody(value: unknown): ConditionBody | null {
  if (!value || typeof value !== "object") return null;
  const { itemId, comparator, price } = value as Record<string, unknown>;
  if (typeof itemId !== "number" || !Number.isSafeInteger(itemId) || itemId < 1) return null;
  if (!COMPARATORS.includes(comparator as Comparator)) return null;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0.01 || price > 999_999_999_999.99) return null;
  if (Math.round(price * 100) !== Number((price * 100).toFixed(6))) return null;
  return { itemId, comparator: comparator as Comparator, price };
}
export type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; context?: ForwardContext };

/** "1,234G 이하" — the condition in words. */
export function conditionText(comparator: string, price: number) {
  const gold = `${price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}G`;
  return comparator === "AT_OR_ABOVE" ? `${gold} 이상` : `${gold} 이하`;
}

/** What each failure means to the visitor, in Korean (none of the backend's text). */
export function alertErrorText(code: string | undefined) {
  switch (code) {
    case "ALERT_PUSH_NOT_DELIVERED":
      return "확인 알림을 보내지 못했어요. 알림 권한을 확인하고 다시 켜 주세요.";
    case "ALERT_PUSH_UNAVAILABLE":
      return "알림 서비스에 잠시 연결할 수 없어요. 잠시 뒤 다시 켜 주세요.";
    case "ALERTS_FULL":
      return "지금은 새 알림을 받을 수 없어요. 잠시 뒤 다시 시도해 주세요.";
    case "ALERT_INVALID_SUBSCRIPTION":
      return "이 브라우저의 구독 정보를 받을 수 없어요. 다른 브라우저로 켜 주세요.";
    case "ALERT_ITEM_NOT_ALERTABLE":
      return "이 품목은 지금 알림을 걸 수 없어요. 다른 품목을 골라 주세요.";
    case "ALERT_TOO_MANY_CONDITIONS":
      return `알림은 ${MAX_CONDITIONS}개까지 걸 수 있어요. 필요 없는 알림을 지워 주세요.`;
    case "ALERT_CONDITION_NOT_FOUND":
      return "이미 지운 알림이에요.";
    case "CLIENT_RATE_LIMITED":
    case "LOST_ARK_RATE_LIMITED":
      return "요청이 많아요. 잠시 뒤 다시 시도해 주세요.";
    default:
      return "알림 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  }
}
