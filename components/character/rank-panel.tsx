"use client";

import { useQuery } from "@tanstack/react-query";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { CharacterQueryError, fetchRank } from "@/lib/character/client";
import {
  METRICS,
  SCOPES,
  conditionsText,
  TIER_LEGEND,
  rankCell,
  rankState,
  scopeLabel,
  type CharacterRank,
  type RankMetric,
} from "@/lib/character/rank";
import { Panel } from "./panel";
import styles from "./rank.module.css";
import { useCrossfade } from "@/lib/motion";

function Cells({ data, metric }: { data: CharacterRank; metric: RankMetric }) {
  return (
    <ul className={styles.cells}>
      {SCOPES.map((scope) => {
        const cell = rankCell(data, metric, scope.id);
        return (
          <li key={scope.id}>
            <span className={styles.scope}>{scopeLabel(data, scope.id)}</span>
            {cell.state === "ready" ? (
              <>
                <strong>{cell.rank}</strong>
                <small>{cell.total}</small>
                <span className={styles.top}>
                  {cell.top ?? "-"}
                  {cell.tier && (
                    <b className={styles.tier} title={cell.tierNote ?? undefined}>
                      {cell.tier}
                    </b>
                  )}
                </span>
              </>
            ) : cell.state === "collecting" ? (
              <>
                <strong className={styles.pending}>집계 중</strong>
                <small>표본 {data.minSample}명 미만</small>
              </>
            ) : (
              <strong className={styles.pending}>-</strong>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * LOAWA-style ranking boxes (F-7): combat power and item level, each over all,
 * the server and the class. Ranks are over the characters LOAKraken has
 * observed (said under the boxes), never the whole game. A hidden character
 * shows only "순위 비공개"; a small sample shows "집계 중", never a 0.
 */
export function RankPanel({ name }: { name: string }) {
  const fade = useCrossfade();
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  const code = query.error instanceof CharacterQueryError ? query.error.info.code : null;
  const state = data ? rankState(data) : null;

  return (
    <Panel title="순위" meta={state === "ranked" ? "LOAKraken 수집 기준" : undefined}>
      {query.isPending ? (
        <p className={styles.muted}>순위를 불러오고 있어요…</p>
      ) : !data ? (
        <div className={styles.muted}>
          <p>
            {limit.limited
              ? countdownText(limit.seconds)
              : code === "STATS_CHARACTER_NOT_OBSERVED"
                ? "아직 순위 집계에 들어가지 않은 캐릭터예요."
                : "순위를 불러오지 못했어요."}
          </p>
          {code !== "STATS_CHARACTER_NOT_OBSERVED" && (
            <button
              type="button"
              className={styles.retry}
              onClick={() => query.refetch()}
              disabled={limit.seconds > 0}
            >
              {retryLabel(limit.seconds)}
            </button>
          )}
        </div>
      ) : state === "hidden" ? (
        <p className={styles.hidden}>순위 비공개</p>
      ) : (
        <>
          {METRICS.map((metric) => (
            <section
              key={metric.id}
              {...fade(styles.metric)}
              aria-label={`${metric.label} 순위`}
            >
              <h3>{metric.label}</h3>
              {state === "excluded" ? (
                <p className={styles.muted}>-</p>
              ) : (
                <Cells data={data} metric={metric.id} />
              )}
            </section>
          ))}
          <p className={styles.note}>
            {state === "excluded"
              ? `순위 집계 조건에 들지 않아요(${conditionsText(data)}).`
              : `${conditionsText(data)}이에요. 게임 전체 순위와 다를 수 있어요.`}
          </p>
          {state === "ranked" && <p className={styles.note}>티어: {TIER_LEGEND}</p>}
        </>
      )}
    </Panel>
  );
}
