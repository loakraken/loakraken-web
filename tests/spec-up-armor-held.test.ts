// PM 총괄 11-22: one notice above the 스펙업 list when the api held armour rows (ARMOR_CP_RESIDUAL_HIGH).
import assert from "node:assert/strict";
import test from "node:test";
import { ARMOR_HELD_POINTER, armorHeldNotice, splitCandidates, type Candidate } from "../lib/spec-up/model";

const TEXT = "장비로 계산한 전투력이 공식 전투력과 맞지 않아 방어구 재련 · 상급 재련 · 완갑 전투력은 계산하지 않았어요.";

const row = (id: string, kind: string, status: string, reasonCode: string | null, reason: string | null) =>
  ({
    id,
    kind,
    target: "+19 테스트 투구",
    from: "+19",
    to: "+20",
    icon: null,
    grade: null,
    skillName: null,
    suggestedTo: null,
    change: null,
    status,
    deltaCombatPower: status === "OK" ? 10 : null,
    deltaPercent: null,
    cost: null,
    combatPowerPer10kGold: null,
    reasonCode,
    reason,
    reasonDetail: null,
  }) as Candidate;

test("held armour rows: the api sentence once and where they are, from the folded group", () => {
  const { folded } = splitCandidates([
    row("GEM_LEVEL:0:8", "GEM_LEVEL", "OK", null, null),
    row("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "UNSUPPORTED", "ARMOR_CP_RESIDUAL_HIGH", TEXT),
    row("EQUIPMENT_ADVANCED_REFINE:1:11", "EQUIPMENT_ADVANCED_REFINE", "UNSUPPORTED", "ARMOR_CP_RESIDUAL_HIGH", TEXT),
    row("ARM_GUARD:0:1", "ARM_GUARD", "UNSUPPORTED", "MODEL_UNCONFIRMED", "이 항목은 아직 계산하지 않았어요."),
  ]);
  assert.equal(armorHeldNotice(folded), `${TEXT} ${ARMOR_HELD_POINTER}`);
});

test("no held armour row (gate off or inside it): no notice", () => {
  const { folded } = splitCandidates([
    row("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "OK", null, null),
    row("ARM_GUARD:0:1", "ARM_GUARD", "UNSUPPORTED", "MODEL_UNCONFIRMED", "이 항목은 아직 계산하지 않았어요."),
  ]);
  assert.equal(armorHeldNotice(folded), null);
  assert.equal(armorHeldNotice([]), null);
});

// codex #1902 P3: an empty or blank api sentence fell through as is, so the notice read only the pointer.
test("a blank or spaced api sentence: trimmed, and the known sentence for the code when nothing is left", () => {
  // ASCII spaces, a no-break space (U+00A0), an ideographic space (U+3000) and tab/newline (codex #1907 P3).
  for (const blank of ["", "   ", " ", "　", "\t\n", "  　\t\n "]) {
    const { folded } = splitCandidates([
      row("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "UNSUPPORTED", "ARMOR_CP_RESIDUAL_HIGH", blank),
      row("ARM_GUARD:0:1", "ARM_GUARD", "UNSUPPORTED", "MODEL_UNCONFIRMED", blank),
    ]);
    assert.deepEqual(
      folded.map((g) => [g.code, g.reason]),
      [
        ["ARMOR_CP_RESIDUAL_HIGH", TEXT],
        ["MODEL_UNCONFIRMED", "이 항목은 아직 계산하지 않았어요."],
      ],
    );
    assert.equal(armorHeldNotice(folded), `${TEXT} ${ARMOR_HELD_POINTER}`);
  }
  const { folded } = splitCandidates([row("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "UNSUPPORTED", "ARMOR_CP_RESIDUAL_HIGH", ` ${TEXT} `)]);
  assert.equal(armorHeldNotice(folded), `${TEXT} ${ARMOR_HELD_POINTER}`);
});