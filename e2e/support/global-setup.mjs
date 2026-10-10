// Warm the dev server: the first hit on each route compiles it, which would
// otherwise eat into the first test's timeout.
const ROUTES = [
  "/",
  "/market",
  "/tools/refining",
  "/tools/material-quote",
  "/tools/crit-speed",
  "/tools/auction",
  "/tools",
  `/character/${encodeURIComponent("상세")}`,
  `/api/characters?characterName=${encodeURIComponent("상세")}`,
  "/about",
  "/api/home/schedule",
  "/api/home/news",
  "/api/markets/tabs",
];

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  for (const route of ROUTES) {
    try {
      await fetch(new URL(route, baseURL), { signal: AbortSignal.timeout(120_000) });
    } catch {
      // A failing route is reported by its own test, not here.
    }
  }
}
