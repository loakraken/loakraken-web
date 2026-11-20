// v0.3.15 readiness (PM 총괄 11-21 04:45): '시뮬레이터에서 열기' on the real path answers of api develop c76685dc
// (#1019 level jumps, #1029 armor/완갑 by score, #1033 상재), names blinded in tests/spec-up-fixtures/v0315.
// A jump step opens at its target level; armor refine and 상급 재련 stay out (the simulator does not take them until
// the armor combat-power gate opens); the weapon's refine and the arm guard go in; karma only where KARMA_SIM is on.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { simulatorPath, type GoalStep } from "../lib/spec-up/goal";
import type { SpecUpChange } from "../lib/spec-up/model";

const dir = new URL("./spec-up-fixtures/v0315/", import.meta.url);
const answers = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, data: JSON.parse(readFileSync(new URL(f, dir), "utf8")).data as { steps: GoalStep[] } }));
// The official loadout order the samples' steps index (as the e2e mock's '실표본' gear): 0 weapon, then the armour.
const GEAR = ["무기", "투구", "상의", "하의", "장갑", "어깨", "완갑"];
const gearType = (index: number) => GEAR[index];
const changesOf = (step: GoalStep) => ((step.changes?.length ? step.changes : [step.change]) as SpecUpChange[]).filter(Boolean);
// Armour 재련 · 상급 재련 open only with ARMOR_CP_SIM (#1843); the weapon's 상급 재련 never (this gear is not 업화).
const closed = (c: SpecUpChange, karma: boolean, armor: boolean) =>
  (c.kind === "EQUIPMENT_ADVANCED_REFINE" && (c.index === 0 || !armor)) ||
  (c.kind === "EQUIPMENT_REFINE" && c.index !== 0 && !armor) ||
  (c.kind === "ARK_PASSIVE_POINT" && !karma) ||
  !["GEM_LEVEL", "ENGRAVING_LEVEL", "STONE_ENGRAVING", "POLISH", "ARM_GUARD", "EQUIPMENT_REFINE", "ARK_PASSIVE_POINT", "EQUIPMENT_ADVANCED_REFINE"].includes(c.kind);

test("the real v0.3.15 answers are here and carry the new shapes", () => {
  assert.equal(answers.length, 12);
  const steps = answers.flatMap((a) => a.data.steps);
  const level = (text: string) => Number(/(\d+)/.exec(text)?.[1]);
  // Jumps (#1019): a gem step raising more than one level, a refine to +25, an engraving 0 → 4.
  assert.ok(steps.some((s) => s.kind === "GEM_LEVEL" && level(s.to) - level(s.from) > 1), "gem jump");
  assert.ok(steps.some((s) => s.kind === "EQUIPMENT_REFINE" && s.to === "+25" && level(s.to) - level(s.from) > 1), "refine jump");
  assert.ok(steps.some((s) => s.kind === "ENGRAVING_LEVEL" && level(s.to) - level(s.from) > 1), "engraving jump");
  assert.ok(steps.some((s) => s.kind === "EQUIPMENT_ADVANCED_REFINE"), "상재 step (#1033)");
  assert.ok(steps.some((s) => s.kind === "ARM_GUARD"), "완갑 step (#1029)");
});

for (const karma of [false, true])
  for (const armor of [false, true])
    test(`open in simulator on the real answers (KARMA_SIM ${karma ? "on" : "off"}, ARMOR_CP_SIM ${armor ? "on" : "off"}): jumps at their target`, () => {
      for (const { file, data } of answers) {
        const path = simulatorPath(data.steps, gearType, karma, armor);
        const skipped = data.steps.filter((s) => changesOf(s).some((c) => closed(c, karma, armor))).length;
        assert.equal(path.skipped, skipped, `${file} skipped`);
        assert.equal(path.changes.some((c) => closed(c, karma, armor)), false, `${file}: a closed change went in`);
        // Every open gem, refine and arm guard step goes in at its own target (the last one per slot wins).
        for (const step of data.steps.filter((s) => !changesOf(s).some((c) => closed(c, karma, armor))))
          for (const c of changesOf(step)) {
            if (c.kind === "GEM_LEVEL") {
              const last = data.steps.filter((s) => s.change?.kind === "GEM_LEVEL" && s.change.slot === c.slot).at(-1)!.change!;
              assert.ok(path.changes.some((x) => x.kind === "GEM_LEVEL" && x.slot === c.slot && x.level === last.level), `${file} gem slot ${c.slot}`);
            }
            if (c.kind === "EQUIPMENT_REFINE")
              assert.ok(path.changes.some((x) => x.kind === "EQUIPMENT_REFINE" && x.index === c.index && x.refine === c.refine), `${file} refine ${c.index}`);
            if (c.kind === "ARM_GUARD") assert.ok(path.changes.some((x) => x.kind === "ARM_GUARD" && x.level === c.level), `${file} arm guard`);
          }
      }
    });

test("the e2e build's counts (KARMA_SIM and ARMOR_CP_SIM on) and the armour-off server's, as the e2e legs pin them", () => {
  const skips = (file: string, armor: boolean) => simulatorPath(answers.find((a) => a.file === file)!.data.steps, gearType, true, armor);
  // 점수 효율: the five armour refine steps open with the gate, stay out without it; 실표본2's weapon 상급 재련 always out.
  for (const [file, off] of [["1-KRAKEN.json", 5], ["3-KRAKEN.json", 5], ["4-KRAKEN.json", 5], ["2-KRAKEN.json", 1]] as const) {
    assert.equal(skips(file, true).skipped, file === "2-KRAKEN.json" ? 1 : 0, `${file} on`);
    assert.equal(skips(file, false).skipped, off, `${file} off`);
  }
  assert.equal(skips("1-KRAKEN.json", true).changes.length, 19);
  assert.equal(skips("1-KRAKEN.json", false).changes.length, 14);
});
