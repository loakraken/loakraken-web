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
