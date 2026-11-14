// Self-test of the e2e helper shiftsUntilQuiet (a7-controls waits with it instead of a fixed 1.2 s after every
// press): a shift that comes after a slow answer or a short timer is still caught, and a press that changes
// nothing returns early. A small page served by the test itself, no app screen.
import { test, expect } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsUntilQuiet, watchShifts } from "../support/shifts.mjs";

const HTML = `<!doctype html><body style="margin:0;font:16px sans-serif">
<button id="slow">slow</button><button id="timer">timer</button><button id="late">late</button><button id="anim">anim</button><button id="spin">spin</button><button id="none">none</button>
<style>#top { height: 0; } #top.tall { height: 80px; transition: height 200ms 600ms; } #spin.on { transition: transform 900ms; transform: rotate(90deg); }</style>
<div id="top"></div><p>text below that moves</p>
<script>
const grow = () => { document.getElementById("top").style.height = "80px"; };
document.getElementById("slow").onclick = () => fetch("/answer").then((r) => r.text()).then(grow);
document.getElementById("timer").onclick = () => setTimeout(grow, 300);
document.getElementById("late").onclick = () => setTimeout(grow, 700);
document.getElementById("anim").onclick = () => document.getElementById("top").classList.add("tall");
document.getElementById("spin").onclick = () => document.getElementById("spin").classList.add("on");
document.getElementById("none").onclick = () => {};
</script></body>`;

const open = async (page) => {
  await page.route("http://quiet.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: HTML });
    if (path === "/answer") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({ body: "ok" });
    }
    return route.fulfill({ status: 204 });
  });
  await watchShifts(page);
  await page.goto("http://quiet.test/");
};

test.describe("shiftsUntilQuiet @regression", () => {
  test("waits for a slow answer (800 ms) and catches what it moves", async ({ page }) => {
    await open(page);
    expect((await shiftsUntilQuiet(page, () => page.click("#slow"))).all).toBeGreaterThan(0);
  });

  test("catches a move 300 ms after the press with no request", async ({ page }) => {
    await open(page);
    expect((await shiftsUntilQuiet(page, () => page.click("#timer"))).all).toBeGreaterThan(0);
  });

  test("catches a move 700 ms after the press, past the 400 ms quiet window (a pending timer holds the wait)", async ({ page }) => {
    await open(page);
    expect((await shiftsUntilQuiet(page, () => page.click("#late"))).all).toBeGreaterThan(0);
  });

  test("catches a height transition that starts 600 ms after the press (a running layout animation holds the wait)", async ({ page }) => {
    await open(page);
    expect((await shiftsUntilQuiet(page, () => page.click("#anim"))).all).toBeGreaterThan(0);
  });

  test("a transform-only animation (no layout shift possible) does not hold the wait", async ({ page }) => {
    await open(page);
    const started = Date.now();
    expect((await shiftsUntilQuiet(page, () => page.click("#spin"))).all).toBe(0);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("returns well before 1.2 s when the press changes nothing", async ({ page }) => {
    await open(page);
    const started = Date.now();
    expect((await shiftsUntilQuiet(page, () => page.click("#none"))).all).toBe(0);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("control: a 300 ms fixed wait misses the slow answer (the first test can fail)", async ({ page }) => {
    await open(page);
    expect((await shiftsDuring(page, () => page.click("#slow"), 300)).all).toBe(0);
  });
});
