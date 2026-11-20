import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// e2e.yml의 'Find changes other than text' 단계를 그대로 떼어 bash로 돌려 본다. git은 바뀐 파일 목록을 내는
// 가짜로 바꾸고, 판정이 실패하는 경우는 awk를 실패하는 가짜로 바꿔 만든다. 판정이 실패해도 단계는 통과하고
// run=true여야 한다. 러너는 shell을 안 준 run을 bash -e로 돌리므로 시험도 bash -e로 돌린다.
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
  const dir = mkdtempSync(join(tmpdir(), "e2e-changes-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "git"), '#!/bin/sh\nprintf \'%s\' "$STUB_FILES"\n', { mode: 0o755 });
    if (brokenAwk) writeFileSync(join(bin, "awk"), "#!/bin/sh\nexit 2\n", { mode: 0o755 });
    const script = join(dir, "step.sh");
    const output = join(dir, "output");
    writeFileSync(script, changesStep());
    writeFileSync(output, "");
    const res = spawnSync("bash", ["-e", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        EVENT: "pull_request",
        GITHUB_OUTPUT: output,
        STUB_FILES: files.join("\n"),
      },
    });
    return { status: res.status, log: `${res.stdout}${res.stderr}`, output: readFileSync(output, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
