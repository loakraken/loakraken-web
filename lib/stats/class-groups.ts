// 직업군 (stats B4): the official class page's groups, read 2026-10-31 from
// https://lostark.game.onstove.com/Class (headings 전사(남)·전사(여)·무도가(남)·
// 무도가(여)·헌터(남)·헌터(여)·마법사·암살자·스페셜리스트(여)·스페셜리스트(남)·
// 가디언나이트). The gendered headings merge into one group here; a class
// missing below (a new one) counts under '기타' until it is added.
export const CLASS_GROUPS = ["전사", "무도가", "헌터", "마법사", "암살자", "스페셜리스트", "가디언나이트"] as const;
export type ClassGroup = (typeof CLASS_GROUPS)[number] | "기타";

const GROUP_OF: Record<string, ClassGroup> = {
  디스트로이어: "전사",
  워로드: "전사",
  버서커: "전사",
  홀리나이트: "전사",
  슬레이어: "전사",
  발키리: "전사",
  스트라이커: "무도가",
  브레이커: "무도가",
  배틀마스터: "무도가",
  인파이터: "무도가",
  기공사: "무도가",
  창술사: "무도가",
  데빌헌터: "헌터",
  블래스터: "헌터",
  호크아이: "헌터",
  스카우터: "헌터",
  건슬링어: "헌터",
  바드: "마법사",
  서머너: "마법사",
  아르카나: "마법사",
  소서리스: "마법사",
  블레이드: "암살자",
  데모닉: "암살자",
  리퍼: "암살자",
  소울이터: "암살자",
  도화가: "스페셜리스트",
  기상술사: "스페셜리스트",
  환수사: "스페셜리스트",
  차원술사: "스페셜리스트",
  가디언나이트: "가디언나이트",
};

export const classGroup = (className: string): ClassGroup =>
  Object.hasOwn(GROUP_OF, className) ? GROUP_OF[className] : "기타";

/**
 * Classes that can play support (api #779: the backend judges their role;
 * every other class counts as a dealer by class alone).
 */
export const SUPPORT_CLASSES = ["바드", "홀리나이트", "도화가", "발키리"] as const;

/** Each group's characters and share of all rows, largest first; empty groups left out. */
export function groupShares(rows: readonly { className: string; count: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const counts = new Map<ClassGroup, number>();
  for (const row of rows) counts.set(classGroup(row.className), (counts.get(classGroup(row.className)) ?? 0) + row.count);
  const order: ClassGroup[] = [...CLASS_GROUPS, "기타"];
  return [...counts]
    .filter(([, count]) => count > 0)
    .map(([group, count]) => ({ group, count, share: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.group) - order.indexOf(b.group));
}
