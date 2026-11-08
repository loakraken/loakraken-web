import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ENGRAVING_ICON_FILES, ENGRAVING_ICON_HASH, ENGRAVING_ICON_SOURCE, engravingIcon } from "../lib/character/engraving-icons";

const dir = join(process.cwd(), "public", "engravings");

test("engraving icons: every name has its own file, and every file a name", () => {
  const files = Object.values(ENGRAVING_ICON_FILES);
  assert.equal(new Set(files).size, files.length, "one file per name");
  for (const file of files) assert.ok(existsSync(join(dir, file)), `${file} in public/engravings`);
  const onDisk = readdirSync(dir).filter((name) => name.endsWith(".webp"));
  assert.deepEqual(onDisk.sort(), [...files].sort(), "no file without a name");
  assert.equal(files.length, 95);
  assert.equal(ENGRAVING_ICON_SOURCE, "게임 리소스 (사용자 제공, 2026-11-08)");
});

test("engraving icons: the engravings our samples use all have one", () => {
  // The names the character and stats samples (tests/mock-backend.mjs) show.
  for (const name of ["원한", "아드레날린", "예리한 둔기", "돌격대장", "질량 증가", "기습의 대가", "타격의 대가", "광기", "버스트", "절정", "잔재된 기운", "분노의 망치"])
    assert.match(engravingIcon(name) ?? "", /^\/engravings\/\d{2}\.webp\?v=[0-9a-f]{8}$/, name);
});

test("engraving icons: each address carries its file's content hash (a replaced file gets a new address)", () => {
  const files = Object.values(ENGRAVING_ICON_FILES);
  assert.deepEqual(Object.keys(ENGRAVING_ICON_HASH).sort(), [...files].sort(), "a hash for every file");
  for (const file of files) {
    const hash = createHash("sha256").update(readFileSync(join(dir, file))).digest("hex").slice(0, 8);
    assert.equal(ENGRAVING_ICON_HASH[file], hash, `${file}: the file changed, update its hash`);
  }
});

test("engraving icons: an unknown or empty name has none (the box stays, empty)", () => {
  assert.equal(engravingIcon("없는 각인"), null);
  assert.equal(engravingIcon(""), null);
  assert.equal(engravingIcon(null), null);
  assert.equal(engravingIcon(" 원한 "), engravingIcon("원한"));
  // Not a prototype key.
  assert.equal(engravingIcon("toString"), null);
});
