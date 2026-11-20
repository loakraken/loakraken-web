// 스펙업 탭 첫 안내 문장(#1858): 탭 틀이 그려 서버 HTML에 들어간다. 문장은 한 곳(specUpLead)에서 정한다.
import assert from "node:assert/strict";
import test from "node:test";
import { specUpLead } from "../lib/spec-up/model";

test("dealer: 추천 순서 when the path is on, 전투력 증가 order otherwise (no answer needed)", () => {
  assert.match(specUpLead({ supporter: false, pathOpen: true, pathEnabled: true }), /^바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 처음에는 올리는 차례대로/);
  assert.match(specUpLead({ supporter: false, pathOpen: false, pathEnabled: false }), /처음에는 전투력이 많이 오르는 순서로 보여 드려요\. 정렬은 아래에서 바꿀 수 있어요\.$/);
});

test("supporter: 추천 순서 by score only when it runs for them (pathOpen), else 10만 골드당 점수 order", () => {
  assert.match(specUpLead({ supporter: true, pathOpen: true, pathEnabled: true }), /^바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 처음에는 올리는 차례대로/);
  assert.equal(
    specUpLead({ supporter: true, pathOpen: false, pathEnabled: true }),
    "바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 10만 골드당 점수가 높은 순서로 보여 드려요.",
  );
});

test("unknown role (positionOf null): a neutral sentence, neither 전투력 nor 점수 (#1862)", () => {
  const lead = specUpLead({ supporter: false, pathOpen: true, pathEnabled: true, roleKnown: false });
  assert.equal(lead, "바꿨을 때 얼마나 오르는지와 드는 골드를 함께 보여 드려요. 정렬은 아래에서 바꿀 수 있어요.");
  assert.doesNotMatch(lead, /전투력|점수/);
});
