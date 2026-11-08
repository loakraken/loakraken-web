import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { aboutIntroScript, DECIDED_ATTR, INTRO_CLASS, INTRO_END_EVENT, PLAYED_KEY, startIntro } from "../components/landing/intro-state";

// The /about intro is turned on by the inline script on a full load and by
// startIntro on a client-side visit: both must decide the same way.

type Case = { reduced?: boolean; paused?: boolean; played?: boolean; storageBlocked?: boolean; on?: boolean; decided?: boolean };

function browser(c: Case) {
  const classes = new Set<string>(c.on ? [INTRO_CLASS] : []);
  const attributes = new Set<string>([...(c.paused ? ["data-motion-paused"] : []), ...(c.decided ? [DECIDED_ATTR] : [])]);
  const timers: { run: () => void; ms: number }[] = [];
  const events: string[] = [];
  const env = {
    document: {
      documentElement: {
        classList: { contains: (n: string) => classes.has(n), add: (n: string) => classes.add(n), remove: (n: string) => classes.delete(n) },
        hasAttribute: (n: string) => attributes.has(n),
        setAttribute: (n: string) => attributes.add(n),
      },
    },
    matchMedia: (query: string) => ({ matches: !!c.reduced && query === "(prefers-reduced-motion: reduce)" }),
    sessionStorage: {
      getItem: (key: string) => {
        if (c.storageBlocked) throw new Error("blocked");
        return c.played && key === PLAYED_KEY ? "1" : null;
      },
    },
    setTimeout: (run: () => void, ms: number) => timers.push({ run, ms }),
    dispatchEvent: (event: Event) => events.push(event.type),
    Event,
  };
  return { env, classes, attributes, timers, events };
}

/** Runs `fn` with the fake browser's globals in place (startIntro reads them as globals). */
function withGlobals<T>(env: object, fn: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(env)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  try {
    return fn();
  } finally {
    for (const [key, d] of saved) {
      if (d) Object.defineProperty(globalThis, key, d);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
}

/** Runs one way of deciding in a fresh fake browser, then its safety timer, and reports what it did. */
function decide(how: "script" | "startIntro", c: Case, claim: boolean) {
  const b = browser(c);
  const run = () => {
    if (how === "script") runInNewContext(aboutIntroScript, b.env);
    else startIntro();
    const on = b.classes.has(INTRO_CLASS);
    const timerMs = b.timers.map((t) => t.ms);
    if (claim) b.attributes.add("data-intro-claimed");
    b.timers.forEach((t) => t.run());
    return { on, decided: b.attributes.has(DECIDED_ATTR), timerMs, afterTimer: b.classes.has(INTRO_CLASS), events: b.events };
  };
  return how === "script" ? run() : withGlobals(b.env, run);
}

const cases: [string, Case][] = [
  ["처음 방문", {}],
  ["줄인 동작", { reduced: true }],
  ["멈춤을 고름", { paused: true }],
  ["이 탭에서 이미 봄", { played: true }],
  ["저장소 막힘", { storageBlocked: true }],
];

for (const [name, c] of cases)
  for (const claim of [false, true])
    test(`소개 켜기: 인라인 스크립트와 startIntro가 같다 — ${name}, ${claim ? "소개가 맡음" : "맡지 않음(안전 시계)"}`, () => {
      assert.deepEqual(decide("startIntro", c, claim), decide("script", c, claim));
    });

test("소개 켜기: 처음 방문이면 켜고, 3초 안에 맡지 않으면 끄고 끝 신호", () => {
  assert.deepEqual(decide("startIntro", {}, false), { on: true, decided: true, timerMs: [3000], afterTimer: false, events: [INTRO_END_EVENT] });
  assert.deepEqual(decide("startIntro", {}, true), { on: true, decided: true, timerMs: [3000], afterTimer: true, events: [] });
});

test("소개 켜기: 스크립트가 이미 켠 페이지는 그대로(시계를 하나 더 걸지 않음)", () => {
  assert.deepEqual(decide("startIntro", { on: true, decided: true }, true), { on: true, decided: true, timerMs: [], afterTimer: true, events: [] });
});

test("소개 켜기: 이번 방문이 이미 정해졌으면(안전 시계가 완성된 페이지를 보임) 다시 켜지 않는다", () => {
  // A slow full load: the script turned the intro on, its timer ended it before the
  // page woke. startIntro at hydration must leave the finished page as it is.
  assert.deepEqual(decide("startIntro", { decided: true }, false), { on: false, decided: true, timerMs: [], afterTimer: false, events: [] });
});

test("소개 켜기: 스크립트는 어느 쪽으로 정해도 표시를 남긴다", () => {
  for (const c of [{}, { reduced: true }, { paused: true }, { played: true }])
    assert.equal(decide("script", c, true).decided, true, JSON.stringify(c));
});
