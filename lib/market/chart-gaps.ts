// Days with no record on a chart drawn by date (최저가 추이 · 시세 추이, user 11-16): nothing is filled
// in, but the gap must read as meant. Each calendar day between the first reading and the last is a
// slot the crosshair can stop on; a slot with no reading says '이날은 기록이 없어요', and a faint dashed
// bridge joins the readings on either side (a line that is visibly not data).

const DAY = 86_400_000;

/** One calendar day on a dated chart: its time, and the index of its reading (null: no record that day). */
export type DaySlot = { t: number; reading: number | null };

/** Every day from the first reading to the last (times are UTC midnights, oldest first). */
export function daySlots(times: readonly number[]): DaySlot[] {
  if (!times.length) return [];
  const slots: DaySlot[] = [];
  let next = 0;
  for (let t = times[0]; t <= times[times.length - 1]; t += DAY) {
    if (next < times.length && times[next] === t) slots.push({ t, reading: next++ });
    else slots.push({ t, reading: null });
  }
  return slots;
}

/** The readings on either side of each gap ([before, after] indexes): where a dashed bridge goes. */
export function gapBridges(times: readonly number[]): [number, number][] {
  const bridges: [number, number][] = [];
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > DAY) bridges.push([i - 1, i]);
  return bridges;
}

/** A slot's date as YYYY-MM-DD (the readings' own day key). */
export const slotDate = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Whether any day without a record falls before `since` (YYYY-MM-DD): the warmup note's condition. */
export function gapsBefore(times: readonly number[], since: string | null | undefined): boolean {
  if (!since) return false;
  return daySlots(times).some((slot) => slot.reading == null && slotDate(slot.t) < since);
}

export const GAP_TEXT = "이날은 기록이 없어요";
