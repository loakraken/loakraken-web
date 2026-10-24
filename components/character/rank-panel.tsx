"use client";

import { useQuery } from "@tanstack/react-query";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { CharacterQueryError, fetchRank } from "@/lib/character/client";
import {
  METRICS,
  conditionsText,
  TIER_LEGEND,
  rankCell,
  rankState,
  SCOPES,
  scopeLabel,
  scopesOf,
  type CharacterRank,
  type RankMetric,
} from "@/lib/character/rank";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Panel } from "./panel";
import styles from "./rank.module.css";
import { useCrossfade } from "@/lib/motion";
import { BasisInfo } from "@/components/stats/basis-note";

/**
 * Ranked scopes as boxes; scopes still short of the sample minimum do not get
 * a box each (user, 11:20: "집계 중" everywhere) but one line with their
 * sample sizes. Never a 0 or a made-up rank.
 */
function Cells({ data, metric }: { data: CharacterRank; metric: RankMetric }) {
  const cells = scopesOf(data).map((scope) => ({ scope, cell: rankCell(data, metric, scope.id) }));
  const shown = cells.filter(({ cell }) => cell.state !== "collecting");
  const waiting = cells.flatMap(({ scope, cell }) =>
    cell.state === "collecting" ? [`${scopeLabel(data, scope.id).replace(" · ", " ")} ${cell.total.toLocaleString("ko-KR")}명`] : [],
  );
  return (
    <>
      {shown.length > 0 && (
        <ul className={styles.cells} data-count={shown.length}>
          {shown.map(({ scope, cell }) => (
            <li key={scope.id}>
              <span className={styles.scope}>{scopeLabel(data, scope.id)}</span>
              {cell.state === "ready" ? (
                <>
                  <strong>{cell.rank}</strong>
                  <small>{cell.total}</small>
                  <span className={styles.top}>
                    {/* Its own unshrinking piece: in a narrow box the badge then
                        goes to the next line instead of past the box (A37). */}
                    <span className={styles.share}>{cell.top ?? "-"}</span>
                    {cell.tier && (
                      // Hover or focus explains the name (user 10-12).
                      <Tooltip>
                        <TooltipTrigger className={styles.tier} aria-label={`티어 ${cell.tier}: ${cell.tierNote}`}>
                          {cell.tier}
                        </TooltipTrigger>
                        <TooltipContent>
                          {cell.tier}: {cell.tierNote}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  {/* Every cell keeps these two lines, so cells with and without a
                      next tier stand alike (A7): the words, then the number on
                      its own line, whole, however narrow the box (A37). */}
                  <small className={styles.next}>
                    {cell.next ? (
                      <>
                        {cell.next.slice(0, cell.next.lastIndexOf(" "))}{" "}
                        <span className={styles.nextValue}>{cell.next.slice(cell.next.lastIndexOf(" ") + 1)}</span>
                      </>
                    ) : (
                      "\u00a0"
                    )}
                  </small>
                </>
              ) : (
                <strong className={styles.pending}>-</strong>
              )}
            </li>
          ))}
        </ul>
      )}
      {waiting.length > 0 && (
        <p className={styles.waiting}>
          표본 {waiting.join(", ")} — {data.minSample.toLocaleString("ko-KR")}명이 모이면 순위를 보여 드려요.
        </p>
      )}
    </>
  );
}

/**
 * While the rank loads (only when the page's own 1s wait ran out): the boxes'
 * usual shape, empty, and the notes' lines. The block sits on top of the
 * summary column, so it keeps the room it will take and nothing under it
 * moves when the rank fills in (A7).
 */
function RankPlaceholder() {
  return (
    <>
      {METRICS.map((metric) => (
        <section key={metric.id} className={styles.metric} aria-hidden="true">
          <h3>{metric.label}</h3>
          {/* Four boxes (two rows of two): the backend sends the server-class
              scope for ranked characters, so this is the usual filled shape. */}
          <ul className={styles.cells} data-count={SCOPES.length}>
            {SCOPES.map((scope) => (
              <li key={scope.id}>
                <span className={styles.scope}>{scope.label}</span>
                <strong>{" "}</strong>
                <small>{" "}</small>
                <span className={styles.top}>{" "}</span>
                <small className={styles.next}>{" "}</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className={styles.note} role="status">
        순위를 불러오고 있어요…
      </p>
      <p className={styles.note} aria-hidden="true">
        티어(그 칸 순위에서 상위 몇 %인지): {TIER_LEGEND}
      </p>
    </>
  );
}

/**
 * Ranking boxes (F-7): combat power and item level, each over all,
 * the server and the class. Ranks are over the characters LOAKraken has
 * observed (said under the boxes), never the whole game. A small sample
 * shows its size on one line, never a 0.
 */
export function RankPanel({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const fade = useCrossfade(query.isPending);
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  const code = query.error instanceof CharacterQueryError ? query.error.info.code : null;
  const state = data ? rankState(data) : null;

  return (
    <Panel title="순위" meta={state === "ranked" ? "LOAKraken 수집 기준" : undefined}>
      {query.isPending ? (
        <RankPlaceholder />
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
      ) : (
        <>
          {METRICS.map((metric) => (
            <section
              key={metric.id}
              ref={fade}
              className={styles.metric}
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
              : `${conditionsText(data)}이에요.`}
            <BasisInfo
              basis={{
                population: data.entries.find((e) => e.scope === "ALL")?.total ?? null,
                conditions: data.conditions,
                aggregatedAt: data.aggregatedAt,
                minSample: data.minSample,
              }}
            />
          </p>
          {state === "ranked" && (
            <p className={styles.note}>티어(그 칸 순위에서 상위 몇 %인지): {TIER_LEGEND}</p>
          )}
        </>
      )}
    </Panel>
  );
}
