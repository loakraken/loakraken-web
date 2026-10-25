"use client";
// 스펙업 tab (PM-프론트 10-11 16:37 ⑤): loaded when the tab opens, like the
// simulator, so the other tabs do not carry it.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { Character } from "@/lib/character/model";
import { positionOf } from "@/lib/character/detail";
import { fetchSpecUp } from "@/lib/spec-up/client";
import { specUpQuery } from "@/lib/spec-up/model";
import { Panel } from "./panel";
import styles from "./detail.module.css";

const loadGuide = () => import("./spec-up-guide");

const Guide = dynamic(() => loadGuide(), {
  ssr: false,
  loading: () => (
    <p className={styles.specUpLoading} role="status">
      스펙업 가이드를 준비하고 있어요…
    </p>
  ),
});


export function SpecUpTab({ data }: { data: Character }) {
  // The list and the guide's code are fetched side by side, and the guide
  // mounts only once the list is here, so it is laid out once, complete. A
  // list arriving after the guide was laid out during the tab panel's
  // entrance motion and counted as a layout shift.
  // A supporter has no combat-power model: their list is ranked by the
  // supporter score per 100,000 gold (api #722, 크라켄 점수 순 for a
  // supporter), so that list is the one asked for. An answer that is not
  // scored (an older backend, or no score for this character) keeps the one
  // plain line instead of a list of "not calculated" rows.
  // The same position the header shows (the api's, else read from the build).
  const supporter = positionOf(data) === "SUPPORT";
  const firstSort = supporter ? "KRAKEN" : "EFFICIENCY";
  // The guide's own first query for this list (KRAKEN carries the cooldown-gem
  // choice, off at first), so the two share one cache entry and one request.
  const cooldown = supporter ? false : null;
  useEffect(() => {
    void loadGuide();
  }, []);
  const list = useQuery({
    queryKey: specUpQuery(data.characterName, data.fetchedAt, firstSort, cooldown),
    queryFn: ({ signal }) => fetchSpecUp(data.characterName, firstSort, signal, cooldown),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // Once shown the guide stays: a retry clears the error while it runs, and
  // unmounting then would start the request again in a loop.
  const [shown, setShown] = useState(false);
  if (!shown && (list.data || list.error)) setShown(true);
  const answer = list.data?.data;
  const supporterScored = !!answer && answer.sort === "KRAKEN" && !answer.krakenSortUnavailableReason;
  if (supporter && answer && !supporterScored)
    return (
      <Panel title="스펙업 가이드" wide>
        <p className={styles.specUpSupporter}>
          <strong>서포터 스펙업은 준비 중이에요.</strong> 서포터 점수 계산이 들어오면 후보를 보여 드릴게요.
        </p>
      </Panel>
    );
  return (
    <Panel title="스펙업 가이드" wide>
      <div className={styles.specUpBody}>
        {shown ? (
          <Guide data={data} supporter={supporter} />
        ) : (
          <p className={styles.specUpLoading} role="status">
            스펙업 가이드를 준비하고 있어요…
          </p>
        )}
      </div>
    </Panel>
  );
}
