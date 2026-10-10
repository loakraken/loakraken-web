// Values on the privacy policy and contact pages that the operators decide
// (PM 총괄, vault "30 PM/개인정보 처리방침 초안"). One place to change them.

export const CONTACT_EMAIL = "contact@loakraken.gg";
export const PRIVACY_EMAIL = "privacy@loakraken.gg";
/** Law art. 30: the officer's name *or* the handling department and contact. */
export const PRIVACY_OFFICER = "LOAKraken 운영팀";
export const INQUIRY_RETENTION = "처리 완료 후 1년";
/** Removal and deletion requests are handled within this many days. */
export const REQUEST_DAYS = 7;

/**
 * Still to be confirmed before launch (null shows "확정 후 기재"):
 * - EFFECTIVE_DATE: the public launch day (PM 총괄 announces it)
 * - RATE_LIMIT_IP_RETENTION: how long the traffic-limit IP hash lives (backend #108 TTL)
 * - AWS_TRANSFER: whether server management involves a transfer abroad
 */
export const EFFECTIVE_DATE: string | null = null;
export const RATE_LIMIT_IP_RETENTION: string | null = null;
export const AWS_TRANSFER: string | null = null;

export const PENDING_TEXT = "확정 후 기재";
export const OFFICIAL_API_URL = "https://developer-lostark.game.onstove.com";
