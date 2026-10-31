// Backend side of model.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// model.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/alerts.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { ALERT_SUCCESS, TOKEN_HEADER, type VapidKeyEnvelope, type AlertItemsEnvelope, type SubscriptionEnvelope, type ConditionsEnvelope, type ConditionEnvelope, type DoneEnvelope, type Options, type SubscribeBody, type ConditionBody } from "./model";

function validator<T>(schema: string) {
  const validate = lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${schema}`,
      components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
    }),
  );
  return (value: unknown): value is T =>
    validate(value) && (value as { code?: unknown }).code === ALERT_SUCCESS;
}

export const isVapidKeyEnvelope = validator<VapidKeyEnvelope>("ApiResponseVapidKeyResponse");

export const isAlertItemsEnvelope = validator<AlertItemsEnvelope>("ApiResponseListAlertItemResponse");

export const isSubscriptionEnvelope = validator<SubscriptionEnvelope>("ApiResponseSubscriptionResponse");

export const isConditionsEnvelope = validator<ConditionsEnvelope>("ApiResponseListConditionResponse");

export const isConditionEnvelope = validator<ConditionEnvelope>("ApiResponseConditionResponse");

/** Unsubscribe and delete answer with no data. */
export const isDoneEnvelope = (value: unknown): value is DoneEnvelope =>
  !!value &&
  typeof value === "object" &&
  (value as { code?: unknown }).code === ALERT_SUCCESS &&
  (value as { data?: unknown }).data == null;

const ERRORS: Record<number, readonly string[]> = {
  400: [
    "INVALID_REQUEST",
    "ALERT_INVALID_SUBSCRIPTION",
    "ALERT_PUSH_NOT_DELIVERED",
    "ALERT_ITEM_NOT_ALERTABLE",
    "ALERT_TOO_MANY_CONDITIONS",
  ],
  404: ["ALERT_SUBSCRIPTION_NOT_FOUND", "ALERT_CONDITION_NOT_FOUND"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["ALERTS_FULL", "ALERT_PUSH_UNAVAILABLE"],
};

const tokenHeader = (token: string) => ({ [TOKEN_HEADER]: token });

export function requestVapidKey(origin: string | undefined, options: Options = {}): Promise<BackendResult<VapidKeyEnvelope>> {
  return requestBackend(backendUrl(origin, "/api/v1/alerts/vapid-public-key"), {
    ...options,
    isValid: isVapidKeyEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestAlertItems(origin: string | undefined, options: Options = {}): Promise<BackendResult<AlertItemsEnvelope>> {
  return requestBackend(backendUrl(origin, "/api/v1/alerts/items"), {
    ...options,
    isValid: isAlertItemsEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestSubscribe(
  body: SubscribeBody,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<SubscriptionEnvelope>> {
  // Confirming with the push service takes a moment: a little longer than reads.
  return requestBackend(backendUrl(origin, "/api/v1/alerts/subscriptions"), {
    timeoutMs: 20_000,
    ...options,
    method: "POST",
    body,
    isValid: isSubscriptionEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestUnsubscribe(
  subscriptionId: string,
  token: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<DoneEnvelope>> {
  return requestBackend(backendUrl(origin, `/api/v1/alerts/subscriptions/${subscriptionId}`), {
    ...options,
    method: "DELETE",
    headers: tokenHeader(token),
    isValid: isDoneEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestConditions(
  subscriptionId: string,
  token: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<ConditionsEnvelope>> {
  return requestBackend(backendUrl(origin, `/api/v1/alerts/subscriptions/${subscriptionId}/conditions`), {
    ...options,
    headers: tokenHeader(token),
    isValid: isConditionsEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestAddCondition(
  subscriptionId: string,
  token: string,
  body: ConditionBody,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<ConditionEnvelope>> {
  return requestBackend(backendUrl(origin, `/api/v1/alerts/subscriptions/${subscriptionId}/conditions`), {
    ...options,
    method: "POST",
    body,
    headers: tokenHeader(token),
    isValid: isConditionEnvelope,
    errorCodes: ERRORS,
  });
}

export function requestDeleteCondition(
  subscriptionId: string,
  token: string,
  conditionId: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<DoneEnvelope>> {
  return requestBackend(
    backendUrl(origin, `/api/v1/alerts/subscriptions/${subscriptionId}/conditions/${conditionId}`),
    { ...options, method: "DELETE", headers: tokenHeader(token), isValid: isDoneEnvelope, errorCodes: ERRORS },
  );
}
