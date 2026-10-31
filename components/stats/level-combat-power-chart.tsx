"use client";

// 레벨별 전투력 (stats B3): the combat power median per 5-level item level
// bucket as one line, under the gem chart on the distribution tab. A bucket
// under 30 people has no median: no point on the line (it breaks there), only
// a faint mark on the axis whose hover says how many people it has.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { pendingProps } from "@/lib/api/pending";
import { fetchLevelCombatPower } from "@/lib/stats/client";
import { linePoints, type LevelBucket } from "@/lib/stats/level-combat-power";
import { statsKey, whole, type StatsQuery } from "@/lib/stats/model";
import gemStyles from "./gem-levels.module.css";
import styles from "./stats.module.css";

const W = 600;
const H = 200;
const range = (b: LevelBucket) => `${whole(b.from)}~${whole(b.to)}`;
const describe = (b: LevelBucket, minSample: number) =>
  b.median == null
    ? `아이템 레벨 ${range(b)} · ${whole(b.count)}명(${minSample}명 미만이라 중앙값 없음)`
    : `아이템 레벨 ${range(b)} · 전투력 중앙값 ${whole(b.median)} · ${whole(b.count)}명`;

export function LevelCombatPowerChart({
  query,
  asTable,
  problem,
}: {
  query: StatsQuery;
  asTable: boolean;
  /** The tab's own retry box, for a failed answer in the chart's place. */
  problem: (error: unknown, retry: () => void) => React.ReactNode;
}) {
  const levels = useQuery({
    queryKey: ["stats", "level-combat-power", statsKey(query)],
    queryFn: ({ signal }) => fetchLevelCombatPower(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = levels.data?.data;
  const label = "아이템 레벨 구간별 전투력 중앙값";
  const minSample = data?.meta.minSample ?? 30;
  const line = data && data.buckets.length ? linePoints(data.buckets, W, H, 12) : null;
  return (
    <section className={gemStyles.block} aria-labelledby="stats-level-combat-power">
      <h2 id="stats-level-combat-power" className={gemStyles.title}>
        아이템 레벨별 전투력
      </h2>
      {levels.isError && !data ? (
        <div className={gemStyles.lineBox}>{problem(levels.error, () => levels.refetch())}</div>
      ) : !data ? (
        <p className={`${gemStyles.lineBox} ${styles.muted}`} role="status">
          레벨별 전투력을 불러오고 있어요…
        </p>
      ) : asTable ? (
        <DataTable label={label} className={styles.table} {...pendingProps(levels)}>
          <caption className={styles.srOnly}>{label}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.left}>아이템 레벨</th>
              <th scope="col">전투력 중앙값</th>
              <th scope="col">인원</th>
            </tr>
          </thead>
          <tbody key={levels.dataUpdatedAt}>
            {data.buckets.map((b) => (
              <tr key={b.from}>
                <th scope="row">{range(b)}</th>
                <td>{b.median == null ? "-" : whole(b.median)}</td>
                <td>{whole(b.count)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : !line ? (
        <p className={`${gemStyles.lineBox} ${styles.muted}`}>이 조건에서는 전투력이 확인된 캐릭터가 없어요.</p>
      ) : (
        <div key={levels.dataUpdatedAt} className={gemStyles.lineWrap} {...pendingProps(levels)}>
          <p className={gemStyles.yAxis} aria-hidden="true">
            <span>{whole(line.hi)}</span>
            <span>{whole(line.lo)}</span>
          </p>
          {/* The line stretches with the box (its stroke does not); the points are
              fixed-size marks placed in % over it, so they stay 8px on a phone. */}
          <div className={gemStyles.lineBox} role="img" aria-label={label}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
              {/* No .k-draw: its pathLength dashes do not hold under a non-scaling stroke. */}
              {line.path && <path className={gemStyles.line} d={line.path} />}
            </svg>
            {line.points.map((p) => (
              <span
                key={p.bucket.from}
                className={p.y == null ? gemStyles.short : gemStyles.point}
                style={{ left: `${(p.x / W) * 100}%`, top: p.y == null ? "100%" : `${(p.y / H) * 100}%` }}
                title={describe(p.bucket, minSample)}
              />
            ))}
          </div>
          <p className={styles.axis} aria-hidden="true">
            <span>{whole(line.first)}</span>
            <span>{whole(line.last)}</span>
          </p>
          <ul className={styles.srOnly}>
            {data.buckets.map((b) => (
              <li key={b.from}>{describe(b, minSample)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.note}>
        {data
          ? `아이템 레벨 5 단위 구간마다 전투력 중앙값을 이었어요. ${minSample}명이 안 되는 구간은 점을 찍지 않고 축 위에 옅게 표시해요.`
          : " "}
      </p>
    </section>
  );
}
