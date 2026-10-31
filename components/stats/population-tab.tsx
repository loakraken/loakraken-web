"use client";

// 전체 인구 (stats B5): every character LOAKraken has stored, from the weekly
// snapshot, by server, class or item level. The page's server choice scopes
// 직업별 and 레벨별; no other filter applies here, and the caption says so.
import { useState, type CSSProperties } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { coarsen } from "@/lib/stats/bins";
import { fetchPopulation } from "@/lib/stats/client";
import { whole, share } from "@/lib/stats/model";
import { snapshotText, type PopulationCount } from "@/lib/stats/population";
import { pendingProps } from "@/lib/api/pending";
import { ClassIcon } from "./class-icon";
import styles from "./stats.module.css";
import own from "./population.module.css";

const VIEWS = [
  { id: "servers", label: "서버별" },
  { id: "classes", label: "직업별" },
  { id: "levels", label: "레벨별" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/** 10-level buckets with the empty ones between filled in, then joined to at most 40 bars. */
function levelBars(levels: readonly { from: number; to: number; count: number }[]) {
  if (!levels.length) return [];
  const step = levels[0].to - levels[0].from || 10;
  const byFrom = new Map(levels.map((l) => [l.from, l.count]));
  const filled = [];
  for (let from = levels[0].from; from <= levels.at(-1)!.from; from += step)
    filled.push({ from, to: from + step, count: byFrom.get(from) ?? 0 });
  return coarsen(filled);
}

function CountList({ rows, total, current, icons }: { rows: readonly PopulationCount[]; total: number; current?: string; icons?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ol className={own.list}>
      {rows.map((row, i) => (
        <li key={row.name} data-current={row.name === current || undefined}>
          <span className={own.name}>
            {icons && <ClassIcon name={row.name} size={20} />}
            {row.name}
          </span>
          <span className={own.value}>
            {whole(row.count)}명 <small>{share(total ? (row.count / total) * 100 : 0)}</small>
          </span>
          <span className={own.bar} aria-hidden="true">
            <i className="k-grow-x" style={{ width: `${(row.count / max) * 100}%`, "--i": i } as CSSProperties} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PopulationTab({ server, problem }: { server?: string; problem: (error: unknown, retry: () => void) => React.ReactNode }) {
  const [view, setView] = useState<View>("servers");
  const population = useQuery({
    queryKey: ["stats", "population", server ?? ""],
    queryFn: ({ signal }) => fetchPopulation(server, signal),
    // A weekly snapshot: the same answer all day.
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = population.data?.data;
  // Loading, error and the time before the first snapshot share one held box,
  // so the answer lands without moving the note under it.
  if (population.isError && !data)
    return <div className={own.hold}>{problem(population.error, () => population.refetch())}</div>;
  if (!data)
    return (
      <p className={`${own.hold} ${styles.muted}`} role="status">
        전체 인구를 불러오고 있어요…
      </p>
    );
  // Right after a deploy the weekly job may not have run yet (PM 총괄 10-31): a calm note, not an error.
  if (!data.snapshotDate)
    return (
      <p className={`${own.hold} ${styles.muted}`} role="status">
        첫 집계를 준비 중이에요 · 매주 새벽에 집계해요
      </p>
    );
  const serverTotal = data.servers.reduce((sum, s) => sum + s.count, 0);
  const bars = levelBars(data.levels);
  const barMax = Math.max(1, ...bars.map((b) => b.count));
  const scope = data.server ?? "전체 서버";
  return (
    <div key={population.dataUpdatedAt} {...pendingProps(population)}>
      <div className={own.head}>
        <p className={own.caption}>
          <strong>LOAKraken이 확인한 모든 캐릭터 기준</strong>
          <span>
            집계 기준 {snapshotText(data.snapshotDate)} · {view === "servers" ? `${whole(serverTotal)}명` : `${scope} ${whole(data.total)}명`}
          </span>
        </p>
        <span className={styles.segment} role="group" aria-label="전체 인구 보기">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </span>
      </div>
      {view === "servers" ? (
        <CountList rows={data.servers} total={serverTotal} current={data.server ?? undefined} />
      ) : view === "classes" ? (
        <CountList rows={data.classes} total={data.total} icons />
      ) : (
        <>
          <ol className={styles.histogram} aria-label={`${scope} 아이템 레벨 구간별 인원`}>
            {bars.map((bar, i) => (
              <li key={bar.from} title={`${whole(bar.from)} ~ ${whole(bar.to)} · ${whole(bar.count)}명`}>
                <i className="k-grow" style={{ height: `${(bar.count / barMax) * 100}%`, "--i": i } as CSSProperties} />
                <span className={styles.srOnly}>
                  {whole(bar.from)} ~ {whole(bar.to)}: {whole(bar.count)}명
                </span>
              </li>
            ))}
          </ol>
          {bars.length > 0 && (
            <p className={styles.axis} aria-hidden="true">
              <span>{whole(bars[0].from)}</span>
              <span>{whole(bars.at(-1)!.to)}</span>
            </p>
          )}
        </>
      )}
      <p className={styles.note}>
        역할·최근 확인·아이템 레벨 조건은 쓰지 않고 저장된 모든 캐릭터를 세요. 서버를 고르면 직업별·레벨별이 그 서버 기준으로 바뀌어요.
      </p>
    </div>
  );
}
