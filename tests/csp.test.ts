import assert from "node:assert/strict";
import test from "node:test";
import { contentSecurityPolicy, newNonce } from "../lib/csp";

const directive = (policy: string, name: string) =>
  policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

test("CSP in production: scripts by nonce only, no inline or eval", () => {
  const policy = contentSecurityPolicy("abc123", false);
  assert.equal(directive(policy, "script-src"), "script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  assert.equal(directive(policy, "connect-src"), "connect-src 'self'");
  for (const part of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"])
    assert.ok(policy.includes(part), part);
  assert.ok(directive(policy, "img-src").includes("https://cdn-lostark.game.onstove.com"));
  assert.equal(policy.includes("'unsafe-eval'"), false);
  assert.equal(directive(policy, "script-src").includes("'unsafe-inline'"), false);
});

test("CSP in development: eval and the dev socket, for React's error stacks and reloads", () => {
  const policy = contentSecurityPolicy("abc123", true);
  assert.ok(directive(policy, "script-src").endsWith("'unsafe-eval'"));
  assert.equal(directive(policy, "connect-src"), "connect-src 'self' ws:");
});

test("nonce: new each time, base64 of 36 characters", () => {
  const a = newNonce();
  const b = newNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{48}$/);
});
