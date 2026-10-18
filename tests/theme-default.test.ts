import assert from "node:assert/strict";
import test from "node:test";
import { themeInitScript } from "../components/ui/theme-toggle";

// The pre-paint script run against a stand-in page: what it puts on <html>
// for a stored value (or none) and the OS setting (user decision 10-18:
// nothing stored = follow the system; was light).
function run(stored: string | null, osDark: boolean, blocked = false) {
  const dataset: Record<string, string> = {};
  const attributes = new Set<string>();
  const root = { dataset, setAttribute: (name: string) => attributes.add(name) };
  const listeners: (() => void)[] = [];
  const media = { matches: osDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) };
  const storage = {
    getItem: (key: string) => {
      if (blocked) throw new Error("blocked");
      return key === "loakraken-theme" ? stored : null;
    },
  };
  new Function("document", "localStorage", "matchMedia", themeInitScript)({ documentElement: root }, storage, () => media);
  return { dataset, media, listeners };
}

test("nothing stored: the system theme, light or dark as the OS is", () => {
  assert.deepEqual(run(null, false).dataset, { themeChoice: "system" });
  assert.deepEqual(run(null, true).dataset, { themeChoice: "system", theme: "dark" });
  // An unknown old value reads as nothing stored.
  assert.deepEqual(run("sepia", true).dataset, { themeChoice: "system", theme: "dark" });
  // Storage blocked (private mode): the system theme too.
  assert.deepEqual(run(null, true, true).dataset, { themeChoice: "system", theme: "dark" });
});

test("a stored choice stays as it is, whatever the OS", () => {
  assert.deepEqual(run("light", true).dataset, { themeChoice: "light" });
  assert.deepEqual(run("dim", false).dataset, { themeChoice: "dim", theme: "dim" });
  assert.deepEqual(run("dark", false).dataset, { themeChoice: "dark", theme: "dark" });
  assert.deepEqual(run("system", true).dataset, { themeChoice: "system", theme: "dark" });
});

test("with nothing stored the page follows the OS switching", () => {
  const page = run(null, false);
  assert.equal(page.dataset.theme, undefined);
  page.media.matches = true;
  page.listeners.forEach((fn) => fn());
  assert.equal(page.dataset.theme, "dark");
  // A stored light does not follow it.
  const light = run("light", false);
  light.media.matches = true;
  light.listeners.forEach((fn) => fn());
  assert.equal(light.dataset.theme, undefined);
});
