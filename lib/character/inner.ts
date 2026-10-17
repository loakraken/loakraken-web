// Pure helpers for the 내실·아바타 tabs (#74).
import type { Character } from "./model";

type Avatar = Character["avatars"][number];

/** "무기 덧입기 아바타" and "무기 아바타" share the slot "무기". */
export function avatarSlot(avatar: Avatar) {
  return (avatar.type ?? "기타")
    .replace(/\s*덧입기/, "")
    .replace(/\s*아바타$/, "")
    .trim() || "기타";
}

/** The twelve avatar slots in the game's order (reference: 아바타 목록). */
export const AVATAR_SLOTS = [
  "무기",
  "무기 덧입기",
  "상의",
  "상의 덧입기",
  "하의",
  "하의 덧입기",
  "머리",
  "머리 덧입기",
  "얼굴1",
  "얼굴2",
  "악기",
  "이동 효과",
] as const;

/**
 * Every slot in order with what is worn there (null when empty), then any
 * avatar whose slot is not one of the twelve, under its own name.
 */
export function avatarSlots(avatars: Avatar[]) {
  const worn = new Map<string, Avatar>();
  const extra: { slot: string; avatar: Avatar }[] = [];
  for (const avatar of avatars) {
    const inner = avatar.isInner || /덧입기/.test(avatar.type ?? "");
    const slot = `${avatarSlot(avatar)}${inner ? " 덧입기" : ""}`;
    if ((AVATAR_SLOTS as readonly string[]).includes(slot) && !worn.has(slot)) worn.set(slot, avatar);
    else extra.push({ slot, avatar });
  }
  return [...AVATAR_SLOTS.map((slot) => ({ slot, avatar: worn.get(slot) ?? null })), ...extra];
}

/** Sums "민첩 +2.00%" style lines by stat name; other lines are kept as text. */
export function avatarEffectTotals(avatars: Avatar[]) {
  const totals = new Map<string, number>();
  for (const avatar of avatars)
    for (const line of avatar.effects) {
      const match = /^(.+?)\s*\+([\d.]+)%$/.exec(line.trim());
      if (match)
        totals.set(match[1], (totals.get(match[1]) ?? 0) + Number(match[2]));
    }
  return [...totals].map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }));
}

type CollectibleItem = Character["collectibles"][number]["items"][number];

/**
 * 가장 희귀한 보유 (character screen checklist §14.1 ⑧): of the items this
 * character has finished, the one the fewest observed rosters own. Items
 * without a share (not in the sample) are left out; ties keep list order.
 */
export function rarestOwned(items: readonly CollectibleItem[], shareOf: (name: string | null) => number | null) {
  let best: { name: string; share: number } | null = null;
  for (const item of items) {
    const done = item.maxPoint != null && item.point === item.maxPoint;
    const share = shareOf(item.name);
    if (!done || share == null || !item.name) continue;
    if (!best || share < best.share) best = { name: item.name, share };
  }
  return best;
}
