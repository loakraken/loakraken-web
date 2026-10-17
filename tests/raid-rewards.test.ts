import assert from "node:assert/strict";
import test from "node:test";
import {
  RAID_DATA,
  checkRaidData,
  modeTotals,
  type RaidData,
} from "../lib/tools/raid-rewards";

const mode = (raidId: string, difficulty: string) =>
  RAID_DATA.raids.find((r) => r.id === raidId)!.modes.find((m) => m.difficulty === difficulty)!;

test("raid reward data is internally consistent", () => {
  assert.deepEqual(checkRaidData(RAID_DATA), []);
});

test("official values match the notices they cite", () => {
  // 2026-06-24 notice (13472): 종막 노말 11,000 (5,500 bound) + 21,000 (10,500 bound).
  assert.deepEqual(modeTotals(mode("kazeros-final", "NORMAL")), {
    gold: 32000,
    boundGold: 16000,
    tradableGold: 16000,
    moreCost: 3520 + 6720,
  });
  // 2025-12-10 notice (13307): 3막 하드 5,000 + 8,000 + 14,000.
  assert.equal(modeTotals(mode("kazeros-act3", "HARD"))?.gold, 27000);
  // 서막 노말 is fully bound since 2025-12-10.
  const prologue = modeTotals(mode("kazeros-prologue", "NORMAL"))!;
  assert.equal(prologue.tradableGold, 0);
  // Extreme has no bonus reward cost.
  assert.equal(modeTotals(mode("kazeros-act3-extreme", "HARD"))?.moreCost, null);
});

test("measured gates fill the old legion raids and the kazeros single modes (M7·E2·E3)", () => {
  const gates = (id: string, d: string) => mode(id, d).gates.map((g) => [g.gold, g.boundGold, g.moreCost]);
  assert.deepEqual(gates("abrelshud", "HARD"), [[1200, 1200, 400], [1200, 1200, 400], [1200, 1200, 500], [2000, 2000, 800]]);
  assert.equal(modeTotals(mode("abrelshud", "NORMAL"))?.gold, 4600);
  assert.equal(modeTotals(mode("kouku", "NORMAL"))?.moreCost, 1500);
  assert.equal(modeTotals(mode("valtan", "HARD"))?.gold, 1800);
  assert.equal(modeTotals(mode("vykas", "NORMAL"))?.gold, 1600);
  // 2막~종막 싱글 = 노말 (같은 골드·더보기, 귀속 50%).
  for (const id of ["kazeros-act2", "kazeros-act3", "kazeros-act4", "kazeros-final"])
    assert.deepEqual(gates(id, "SINGLE"), gates(id, "NORMAL"), id);
  assert.equal(modeTotals(mode("kazeros-act3", "SINGLE"))?.tradableGold, 10500);
});

test("missing values never turn into zero", () => {
  const valtan = mode("valtan", "NORMAL");
  const empty = { ...valtan, gates: valtan.gates.map((g) => ({ ...g, gold: null, boundGold: null })) };
  assert.equal(modeTotals(empty), null);
});

test("the checker catches the mistakes it is meant to catch", () => {
  const broken = structuredClone(RAID_DATA) as RaidData;
  broken.raids[0].modes[0].gates[0].boundGold = 999999;
  broken.raids[1].modes[0].source = "nowhere";
  broken.raids.find((r) => r.id === "valtan")!.modes[0].status = "UNVERIFIED";
  const problems = checkRaidData(broken);
  assert.ok(problems.some((p) => p.includes("bound gold above gold")));
  assert.ok(problems.some((p) => p.includes("needs a known source")));
  assert.ok(problems.some((p) => p.includes("UNVERIFIED but has values")));
});

test("weekly gold rules come from the official guide", () => {
  assert.equal(RAID_DATA.rules.goldCharactersPerRoster, 6);
  assert.equal(RAID_DATA.rules.endContentGoldClearsPerCharacter, 3);
  assert.ok(RAID_DATA.sources[RAID_DATA.rules.source].url?.startsWith("https://lostark.game.onstove.com/"));
  // Site measurements link nowhere and name no other site (PM-프론트 #277 P2).
  const sites = Object.values(RAID_DATA.sources).filter((s) => s.url === null);
  // Titled by what was measured, never by where (the name list is not kept here).
  assert.ok(sites.length > 0 && sites.every((s) => /^실측 — /.test(s.title)));
});
