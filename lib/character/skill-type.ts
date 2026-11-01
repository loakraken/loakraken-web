// The official SkillType code on each skill (backend #773), checked on real raw
// (11-01: a 100 skill's tooltip reads 각성기): 0 normal, 100 각성기, 101 초각성기,
// 1 초각성 스킬. Any other value, a missing field (a server before #773) or null
// (an old cache) is a normal skill.
export function awakeningLabel(
  skillType: number | null | undefined,
): "각성기" | "초각성기" | "초각성 스킬" | null {
  if (skillType === 100) return "각성기";
  if (skillType === 101) return "초각성기";
  if (skillType === 1) return "초각성 스킬";
  return null;
}

// 각성기 and 초각성기: the source lists both of each pair, all Lv.1 with no
// tripods or rune, and nothing marks the equipped one (real raw 11-01). These
// stay out of the default skill list; a visitor's own pick could bring one
// back later.
export function isAwakeningPair(skillType: number | null | undefined): boolean {
  return skillType === 100 || skillType === 101;
}
