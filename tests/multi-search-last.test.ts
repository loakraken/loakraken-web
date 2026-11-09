// 멀티서치 지난번 명단(사용자 11-08): 탭마다 sessionStorage에 두고, 열린 탭끼리 BroadcastChannel로
// 나눈다(새 탭이 물으면 명단이 있는 탭이 답함, 바뀌면 모두에게). 브라우저에 오래 남던 예전 명단
// (localStorage)은 한 번 지운다. 저장이 막히거나 BroadcastChannel이 없어도 오류 없이 탭 혼자.
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

const KEY = "loakraken:multi-search";
const CHANNEL = "loakraken:multi-search";

class FakeStorage {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const g = globalThis as unknown as { localStorage: unknown; sessionStorage: unknown };
const local = new FakeStorage();
const session = new FakeStorage();
local.setItem(KEY, "예전1,예전2"); // a list saved per browser before 11-08
g.localStorage = local;
g.sessionStorage = session;

type Last = typeof import("../lib/multi-search/last");
type Share = typeof import("../lib/multi-search/share");
let last: Last;
let share: Share;
// "Another open tab": its own channel object on the same name (Node has BroadcastChannel).
const other = new BroadcastChannel(CHANNEL);
const heard: unknown[] = [];
other.onmessage = (event) => heard.push(event.data);
let stopListening = () => {};

before(async () => {
  last = await import("../lib/multi-search/last");
  share = await import("../lib/multi-search/share");
});
after(() => {
  stopListening();
  other.close();
  share.closeChannelForTests();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("예전 localStorage 명단은 돌아오지 않고, 첫 읽기에서 지워진다", () => {
  assert.deepEqual(last.readLastNames(), []);
  assert.equal(local.getItem(KEY), null);
});

test("저장은 이 탭의 sessionStorage에, 그리고 열린 탭들에 알린다(localStorage에는 쓰지 않음)", async () => {
  last.saveLastNames(["비교1", "비교2"]);
  assert.equal(session.getItem(KEY), "비교1,비교2");
  assert.equal(local.getItem(KEY), null);
  assert.deepEqual(last.readLastNames(), ["비교1", "비교2"]);
  await settle();
  assert.deepEqual(heard.at(-1), { type: "list", list: "비교1,비교2" });
});

test("명단이 있는 탭은 새 탭의 물음에 답하고, 다른 탭이 바꾼 명단을 받는다", async () => {
  stopListening = share.listenForOpenTabs();
  heard.length = 0;
  other.postMessage({ type: "ask" });
  await settle();
  assert.deepEqual(heard, [{ type: "answer", list: "비교1,비교2" }]);
  other.postMessage({ type: "list", list: "비교3" });
  await settle();
  assert.deepEqual(last.readLastNames(), ["비교3"]);
  other.postMessage({ type: "list", list: "" }); // 다른 탭에서 '모두 지우기'
  await settle();
  assert.equal(session.getItem(KEY), null);
});

test("명단이 없는 탭은 물어서 첫 답을 받는다", async () => {
  const answering = (event: MessageEvent) => {
    if (event.data?.type === "ask") other.postMessage({ type: "answer", list: "비교4,비교5" });
  };
  other.addEventListener("message", answering);
  try {
    assert.deepEqual(await last.askLastNames(), ["비교4", "비교5"]);
    assert.equal(session.getItem(KEY), "비교4,비교5");
  } finally {
    other.removeEventListener("message", answering);
  }
});

test("물은 사이 이 탭에서 명단을 비교했으면 늦은 답이 덮지 않는다", async () => {
  session.removeItem(KEY);
  const asking = last.askLastNames(200);
  last.saveLastNames(["내명단1", "내명단2"]); // the visitor compares while the tabs answer
  other.postMessage({ type: "answer", list: "다른탭1" });
  assert.deepEqual(await asking, ["내명단1", "내명단2"]);
  assert.equal(session.getItem(KEY), "내명단1,내명단2");
});

test("다른 탭에서 온 명단은 화면이 비교하는 수까지만, 터무니없이 긴 것은 버린다", async () => {
  const { MULTI_SEARCH_LIMIT } = await import("../lib/multi-search/model");
  assert.equal(share.SHARED_NAMES_MAX, MULTI_SEARCH_LIMIT);
  other.postMessage({ type: "list", list: "가1,가2,가3,가4,가5,가6,가7,가8,가9,가10" });
  await settle();
  assert.equal(session.getItem(KEY), "가1,가2,가3,가4,가5,가6");
  other.postMessage({ type: "list", list: "나".repeat(5000) });
  other.postMessage({ type: "list", list: 42 });
  await settle();
  assert.equal(session.getItem(KEY), "가1,가2,가3,가4,가5,가6");
  session.removeItem(KEY);
  const answering = (event: MessageEvent) => {
    if (event.data?.type === "ask") other.postMessage({ type: "answer", list: "다1,다2,다3,다4,다5,다6,다7" });
  };
  other.addEventListener("message", answering);
  try {
    assert.deepEqual(await last.askLastNames(), ["다1", "다2", "다3", "다4", "다5", "다6"]);
  } finally {
    other.removeEventListener("message", answering);
  }
});

test("답하는 탭이 없으면 기다린 뒤 빈 명단", async () => {
  session.removeItem(KEY);
  const started = Date.now();
  assert.deepEqual(await last.askLastNames(60), []);
  assert.ok(Date.now() - started >= 50);
});

test("빈 명단 저장은 지우기(모두 지우기)", () => {
  last.saveLastNames(["비교1"]);
  last.saveLastNames([]);
  assert.equal(session.getItem(KEY), null);
  assert.deepEqual(last.readLastNames(), []);
});

test("예전 키 지우기는 한 번만: 그 뒤 다른 곳이 쓴 값은 건드리지 않는다", () => {
  local.setItem(KEY, "다른값");
  last.readLastNames();
  assert.equal(local.getItem(KEY), "다른값");
  local.removeItem(KEY);
});

test("저장이 막혀도 오류 없이 빈 명단", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  g.sessionStorage = blocked;
  try {
    assert.doesNotThrow(() => last.saveLastNames(["비교1"]));
    assert.deepEqual(last.readLastNames(), []);
  } finally {
    g.sessionStorage = session;
  }
});

test("BroadcastChannel이 없는 브라우저: 탭 혼자 기억하고, 물음은 바로 빈 명단", async () => {
  const saved = globalThis.BroadcastChannel;
  share.closeChannelForTests();
  stopListening();
  // @ts-expect-error -- an old browser without BroadcastChannel
  delete globalThis.BroadcastChannel;
  try {
    last.saveLastNames(["비교6"]);
    assert.equal(session.getItem(KEY), "비교6");
    session.removeItem(KEY);
    assert.deepEqual(await last.askLastNames(), []);
    assert.doesNotThrow(() => share.listenForOpenTabs()());
  } finally {
    globalThis.BroadcastChannel = saved;
    share.closeChannelForTests();
  }
});
