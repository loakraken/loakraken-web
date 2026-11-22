"use client";

// (ours, M49) 바꿔 본 젬 순위: each gem swap the user set up in the simulator, computed on its own (one /simulate with
// that one change, api #1079), ranked by its 전투력 increase. The simulator's own answer applies every change in
// order (contributions add up), so a swap's share there depends on the others; here each is measured from the
// character as it is. Costs wait for G5 prices. Phase 2 (automatic candidates over 가공 outcomes, a batch api)
// puts its list in the slot below the user's own (PM 총괄 11-22).
// A7: rows keep their place while a new answer is on its way (the last settled order stays, dimmed), and the list
// reorders only when every answer is in.
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { postSimulation } from "@/lib/combat-power/client";
import { percentText, rankRows, rowOf, type GemSwap } from "@/lib/combat-power/gem-ranking";
import { gemChange } from "@/lib/combat-power/model";
import styles from "./combat-power.module.css";

export function ArkGemRanking({ name, fetchedAt, swaps }: { name: string; fetchedAt: string; swaps: GemSwap[] }) {
  const queries = useQueries({
    queries: swaps.map((item) => {
      const change = gemChange(item.gem, item.swap);
      return {
        // The same change for the same character data is one request (and the simulator's own key shape).
        queryKey: ["combat-power", name, fetchedAt, [change]],
        queryFn: ({ signal }: { signal: AbortSignal }) => postSimulation({ characterName: name, changes: [change] }, signal),
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: false,
      };
    }),
  });
  const settled = queries.every((query) => !query.isFetching);
  const rows = rankRows(swaps.map((item, i) => rowOf(item, queries[i].data?.data, !!queries[i].error)));
  const ranked = rows.map((row) => row.key);
  // Hold the last settled order while answers are on their way, so rows do not jump one by one (A7): kept rows stay
  // where they were, a new swap joins at the end. Adjusted during render (derived state).
  const [held, setHeld] = useState<string[]>([]);
  if (settled && held.join("|") !== ranked.join("|")) setHeld(ranked);
  const present = new Set(ranked);
  const kept = held.filter((key) => present.has(key));
  const order = settled ? ranked : [...kept, ...ranked.filter((key) => !kept.includes(key))];
  const byKey = new Map(rows.map((row) => [row.key, row]));
  let rank = 0;

  if (swaps.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="cp-gem-ranking" aria-busy={!settled || undefined}>
      <header className={styles.cardHead}>
        <h2 id="cp-gem-ranking">바꿔 본 젬 순위</h2>
      </header>
      <p className={styles.none}>바꾼 젬을 하나씩 따로 계산해 전투력 증가율이 높은 순으로 보여 줘요.</p>
      <ol className={styles.gemRanking} data-stale={!settled || undefined}>
        {order.map((key) => {
          const row = byKey.get(key);
          if (!row) return null;
          const place = row.state === "OK" ? ++rank : null;
          return (
            <li key={key} className={styles.gemRankRow}>
              <span className={styles.gemRank} aria-label={place ? `${place}위` : undefined}>
                {place ?? "-"}
              </span>
              <span className={styles.gemRankName}>
                {row.label}
                <small className={styles.gemText}>{row.to}</small>
              </span>
              <span className={styles.gemRankValue}>
                {row.state === "OK" ? (
                  <b>{percentText(row.percent)}</b>
                ) : row.state === "WAITING" ? (
                  <span className={styles.pending}>계산 중</span>
                ) : (
                  <span className={styles.pending}>계산하지 않음</span>
                )}
              </span>
              {row.state === "NOT_COMPUTED" && <small className={styles.why}>{row.why}</small>}
            </li>
          );
        })}
      </ol>
      {/* Phase 2 (server-side candidates over 가공 outcomes, PM 총괄 11-22) goes in this slot, under the user's own. */}
    </section>
  );
}
