import assert from "node:assert/strict";
import test from "node:test";
import { AI_AGENTS, robotsRules } from "../lib/robots";
import { PRODUCTION_URL } from "../lib/site";

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const groups = (url: string, indexable: boolean) => {
  const { rules } = robotsRules(url, indexable);
  return (Array.isArray(rules) ? rules : [rules]) as Rule[];
};
const agents = (rule: Rule) => [rule.userAgent ?? []].flat();

test("robots: AI agents are closed off, search engines keep the open group (user 10-25)", () => {
  const rules = groups(PRODUCTION_URL, true);
  const open = rules.find((r) => agents(r).includes("*"));
  assert.deepEqual(open, { userAgent: "*", allow: "/", disallow: "/api/" });
  const ai = rules.find((r) => agents(r).includes("GPTBot"));
  assert.equal(ai?.disallow, "/");
  for (const name of ["GPTBot", "ClaudeBot", "PerplexityBot", "CCBot", "Google-Extended", "Applebot-Extended", "Bytespider", "meta-externalagent"])
    assert.ok(agents(ai!).includes(name), name);
  // Search engines are named nowhere, so the open group applies to them.
  for (const name of ["Googlebot", "Yeti", "Bingbot", "Applebot", "DuckDuckBot", "Daum"])
    assert.ok(!rules.some((r) => agents(r).some((a) => a.toLowerCase() === name.toLowerCase())), name);
  assert.equal(new Set(AI_AGENTS).size, AI_AGENTS.length);
  assert.equal(robotsRules(PRODUCTION_URL, true).sitemap, `${PRODUCTION_URL}/sitemap.xml`);
});

test("robots: a non-production address is closed to everyone", () => {
  assert.deepEqual(groups("https://staging.example.test", false), [{ userAgent: "*", disallow: "/" }]);
});
