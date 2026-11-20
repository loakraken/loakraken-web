import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// e2e.yml의 'Find changes other than text' 단계를 그대로 떼어 bash로 돌려 본다. git은 바뀐 파일 목록을 내는
// 가짜로 바꾸고, 판정이 실패하는 경우는 awk를 실패하는 가짜로 바꿔 만든다. 판정이 실패해도 단계는 통과하고
// run=true여야 한다. 러너는 shell을 안 준 run을 bash -e로 돌리므로 시험도 bash -e로 돌린다.
// 경로와 환경 변수는 bash로 넘기지 않는다: Windows에서 PowerShell로 돌리면 bash가 WSL의 /bin/bash라 Windows
// 경로(백슬래시)도 PATH · 환경 변수도 받지 못했다(#1808 뒤 로컬 3/3 실패). 단계는 표준 입력으로, 가짜는 셸
// 함수로, 변수는 앞머리에서 정하고, 단계의 출력(GITHUB_OUTPUT)은 표준 출력의 'run=' 줄로 받는다.
const root = fileURLToPath(new URL("..", import.meta.url));

function changesStep(): string {
  const lines = readFileSync(join(root, ".github", "workflows", "e2e.yml"), "utf8").split(/\r?\n/);
  const name = lines.findIndex((l) => l.trim() === "- name: Find changes other than text");
  assert.ok(name >= 0, "e2e.yml에 판정 단계가 없다");
  const run = lines.findIndex((l, i) => i > name && l.trim() === "run: |");
  assert.ok(run > name, "판정 단계에 run 블록이 없다");
  const indent = lines[run].search(/\S/);
  const body: string[] = [];
  for (const l of lines.slice(run + 1)) {
    if (l.trim() && l.search(/\S/) <= indent) break;
    body.push(l);
  }
  const pad = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(pad)).join("\n");
}

function runStep(files: string[], { brokenAwk = false } = {}) {
  for (const file of files) assert.ok(!file.includes("'"), `작은따옴표 없는 이름만: ${file}`);
  const prelude = [
    "EVENT=pull_request",
    // The step's outputs come back on stdout ('run=…' lines), so no file or folder is shared with bash: a temp
    // file of bash's own, printed when the step exits (run_all ends it with exit 0). WSL's bash cannot open
    // /dev/stdout when stdout is a Windows pipe.
    "GITHUB_OUTPUT=$(mktemp)",
    `trap 'cat "$GITHUB_OUTPUT"; rm -f "$GITHUB_OUTPUT"' EXIT`,
    `git() { printf '%s' '${files.join("\n")}'; }`,
    ...(brokenAwk ? ["awk() { return 2; }"] : []),
  ].join("\n");
  const res = spawnSync("bash", ["-e", "-s"], { input: `${prelude}\n${changesStep()}\n`, encoding: "utf8" });
  const output = (res.stdout ?? "").split("\n").filter((line) => line.startsWith("run=")).join("\n");
  return { status: res.status, log: `${res.stdout}${res.stderr}${res.error ?? ""}`, output };
}

test("글만 바뀐 PR은 run=false", () => {
  const res = runStep(["docs/guide.md", "content/notes/a.mdx", "README.md"]);
  assert.equal(res.status, 0, res.log);
  assert.equal(res.output.trim(), "run=false", res.log);
});

test("코드가 바뀐 PR은 run=true", () => {
  const res = runStep(["docs/guide.md", "proxy.ts"]);
  assert.equal(res.status, 0, res.log);
  assert.equal(res.output.trim(), "run=true", res.log);
});

test("판정(awk)이 실패해도 단계는 통과하고 모두 돈다", () => {
  const res = runStep(["proxy.ts"], { brokenAwk: true });
  assert.equal(res.status, 0, res.log);
  assert.equal(res.output.trim(), "run=true", res.log);
  assert.match(res.log, /판정 실패: 모두 돈다/);
});
