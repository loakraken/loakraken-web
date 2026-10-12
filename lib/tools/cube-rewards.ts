// 큐브 보상 (빈 정보 E40): per Ebony Cube stage, the rewards for one entry
// (1배 입장). Only stages whose source postdates the last official change to
// them carry values (PM 총괄 10-12 08:26 · 08:31); the rest are null with a
// reason. Sources stay in the data file and are never shown.
import raw from "./data/cube-rewards.json";

export type CubeReward = { item: string; count: number; unit?: string; note?: string };
export type HiddenRoom = { room: string; rewards: CubeReward[] | null; reason: string | null };
export type StageRewards = {
  clear: CubeReward[];
  hiddenCommon: CubeReward[];
  hiddenRooms: HiddenRoom[];
  megaLucky: CubeReward[] | null;
  megaLuckyReason: string | null;
};
export type CubeStage = {
  id: string;
  name: string;
  entryLevel: number;
  source?: string;
  basis?: string;
  rewards: StageRewards | null;
  reason: string | null;
};
export type CubeSource = {
  title: string;
  url: string;
  date: string;
  checkedAt: string;
  kind: "OFFICIAL" | "COMMUNITY";
  note: string;
};
export type CubeData = {
  version: string;
  checkedAt: string;
  sources: Record<string, CubeSource>;
  boxProbability: { values: null; reason: string };
  stages: CubeStage[];
};

export const CUBE_DATA = raw as CubeData;

/** "보석 11개(2레벨 환산)": the unit says what the count was converted to. */
export const rewardText = (reward: CubeReward) =>
  `${reward.item} ${reward.count.toLocaleString("ko-KR")}개${reward.unit ? `(${reward.unit})` : ""}`;

/** Consistency problems; the test suite expects none. */
export function checkCubeData(data: CubeData): string[] {
  const problems: string[] = [];
  for (const [id, source] of Object.entries(data.sources)) {
    if (!/^https:\/\//.test(source.url)) problems.push(`source ${id}: url must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.date)) problems.push(`source ${id}: bad date`);
  }
  let level = 0;
  for (const stage of data.stages) {
    if (stage.entryLevel <= level) problems.push(`${stage.id}: entry levels must rise`);
    level = stage.entryLevel;
    if (stage.rewards === null) {
      if (!stage.reason?.trim()) problems.push(`${stage.id}: no rewards and no reason`);
      continue;
    }
    if (stage.reason !== null) problems.push(`${stage.id}: reason set but rewards present`);
    if (!stage.source || !data.sources[stage.source]) problems.push(`${stage.id}: unknown source`);
    if (!stage.basis) problems.push(`${stage.id}: no entry basis (1배/3배)`);
    const { clear, hiddenCommon, hiddenRooms, megaLucky, megaLuckyReason } = stage.rewards;
    const all = [...clear, ...hiddenCommon, ...hiddenRooms.flatMap((r) => r.rewards ?? []), ...(megaLucky ?? [])];
    for (const reward of all)
      if (!Number.isInteger(reward.count) || reward.count <= 0)
        problems.push(`${stage.id}: bad count for ${reward.item}`);
    for (const room of hiddenRooms)
      if ((room.rewards === null) === !room.reason?.trim())
        problems.push(`${stage.id} ${room.room}: rewards xor reason`);
    if ((megaLucky === null) === !megaLuckyReason?.trim()) problems.push(`${stage.id}: megaLucky xor reason`);
  }
  return problems;
}
