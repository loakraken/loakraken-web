// The official SkillType code on each skill (backend #773): 0 normal, 1 각성기,
// 100 and 101 the two 초각성 kinds. Which of 100/101 is 초각성 스킬 and which
// 초각성기 is not confirmed yet, so both read "초각성". Any other value, a
// missing field (a server before #773) or null (an old cache) is a normal skill.
export function awakeningLabel(skillType: number | null | undefined): "각성기" | "초각성" | null {
  if (skillType === 1) return "각성기";
  if (skillType === 100 || skillType === 101) return "초각성";
  return null;
}
