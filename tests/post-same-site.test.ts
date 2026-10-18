import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// The routes are server modules: stand in for the "server-only" marker, which
// throws outside a server build, before loading them.
const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = { exports: {}, loaded: true } as NodeJS.Module;
const load = async (path: string) => ((await import(`../app/api/${path}/route`)) as { POST: (request: Request) => Promise<Response> }).POST;
// Every POST through the web api spends the visitor's (and the site's) limit
// on the backend, so a form or script on another site must not reach it.
const routes = [
  "combat-power/simulate",
  "crit-speed",
  "markets/accessory-search",
  "markets/material-prices",
  "markets/material-quotes",
  "refining/plans",
];
const refreshes = ["characters/card-collection/refresh", "characters/roster-combat-power/refresh"];
const FLAGS = ["COMBAT_POWER_SIM", "CRIT_SPEED_TOOL", "ACCESSORY_SEARCH_TOOL"];

async function withFlagsOn<T>(run: () => Promise<T>) {
  const before = FLAGS.map((name) => process.env[name]);
  for (const name of FLAGS) process.env[name] = "on";
  try {
    return await run();
  } finally {
    FLAGS.forEach((name, i) => {
      if (before[i] === undefined) delete process.env[name];
      else process.env[name] = before[i];
    });
  }
}

// text/plain: a request that passes the origin check stops at 415 before any backend call.
const post = (path: string, headers: Record<string, string>) =>
  new Request(`https://loakraken.gg/api/${path}`, {
    method: "POST",
    headers: { "content-type": "text/plain", ...headers },
    body: "{}",
  });
const crossSite: Record<string, string>[] = [
  { "sec-fetch-site": "cross-site" },
  { "sec-fetch-site": "same-site" },
  { origin: "https://evil.example" },
  {},
];
const sameSite: Record<string, string>[] = [{ "sec-fetch-site": "same-origin" }, { origin: "https://loakraken.gg" }];

test("web api POSTs from another site get 403", async () => {
  await withFlagsOn(async () => {
    for (const path of [...routes, ...refreshes]) {
      const handler = await load(path);
      for (const headers of crossSite)
        assert.equal((await handler(post(path, headers))).status, 403, `${path} ${JSON.stringify(headers)}`);
    }
  });
});

test("web api POSTs from this site pass the origin check", async () => {
  await withFlagsOn(async () => {
    for (const path of routes) {
      const handler = await load(path);
      for (const headers of sameSite)
        assert.equal((await handler(post(path, headers))).status, 415, `${path} ${JSON.stringify(headers)}`);
    }
  });
});

// A POST, PUT, PATCH or DELETE added later must not skip the check.
test("every changing route under app/api checks the origin", () => {
  const files = readdirSync("app/api", { recursive: true, encoding: "utf8" }).filter((file) => /(^|[\\/])route\.ts$/.test(file));
  const changing = files.filter((file) => /export (async function|const) (POST|PUT|PATCH|DELETE)\b/.test(readFileSync(join("app/api", file), "utf8")));
  assert.ok(changing.length >= routes.length + refreshes.length);
  for (const file of changing) {
    const source = readFileSync(join("app/api", file), "utf8");
    assert.match(source, /isSameSite\(request\)|guard\(request, true\)/, file);
  }
});