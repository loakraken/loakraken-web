// Seals a user's API key for the BYOK cookie (보안 R1·R2): AES-256-GCM with a
// server secret, so the cookie can be neither read nor altered without it.
// The sealed value carries its own expiry; nothing is stored on the server.
// Pure (node:crypto, no request state): lib/byok/server.ts supplies the secret.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV = 12;
const TAG = 16;

type Payload = { k: string; exp: number };

/** A 32-byte secret from its base64 text, or null when it is not one. */
export function sealSecret(base64: string | undefined | null): Buffer | null {
  if (!base64) return null;
  const bytes = Buffer.from(base64.trim(), "base64");
  return bytes.length === 32 ? bytes : null;
}

/** "v1.<base64url(iv · ciphertext · tag)>" holding the key and when it stops counting. */
export function sealUserKey(key: string, expiresAt: Date, secret: Buffer) {
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const plain = Buffer.from(JSON.stringify({ k: key, exp: expiresAt.getTime() } satisfies Payload), "utf8");
  const body = Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${body.toString("base64url")}`;
}

/**
 * The key and its expiry from a sealed value, or null when it is malformed,
 * altered, sealed with another secret (rotated) or past its time.
 */
export function unsealUserKey(sealed: string | undefined | null, secret: Buffer, now = Date.now()) {
  if (!sealed || !sealed.startsWith(`${VERSION}.`)) return null;
  const body = Buffer.from(sealed.slice(VERSION.length + 1), "base64url");
  if (body.length <= IV + TAG) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret, body.subarray(0, IV));
    decipher.setAuthTag(body.subarray(body.length - TAG));
    const plain = Buffer.concat([decipher.update(body.subarray(IV, body.length - TAG)), decipher.final()]);
    const payload = JSON.parse(plain.toString("utf8")) as Partial<Payload>;
    if (typeof payload.k !== "string" || typeof payload.exp !== "number" || payload.exp <= now) return null;
    return { key: payload.k, expiresAt: new Date(payload.exp) };
  } catch {
    return null;
  }
}
