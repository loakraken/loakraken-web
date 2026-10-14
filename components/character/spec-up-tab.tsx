"use client";
// 스펙업 tab (PM-프론트 10-11 16:37 ⑤): loaded when the tab opens, like the
// simulator, so the other tabs do not carry it.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { Character } from "@/lib/character/model";
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
  useEffect(() => {
    void loadGuide();
  }, []);
  const list = useQuery({
    queryKey: specUpQuery(data.characterName, data.fetchedAt, "EFFICIENCY"),
    queryFn: ({ signal }) => fetchSpecUp(data.characterName, "EFFICIENCY", signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // Once shown the guide stays: a retry clears the error while it runs, and
  // unmounting then would start the request again in a loop.
  const [shown, setShown] = useState(false);
  if (!shown && (list.data || list.error)) setShown(true);
  return (
    <Panel title="스펙업 가이드" wide>
      <div className={styles.specUpBody}>
        {shown ? (
          <Guide data={data} />
        ) : (
          <p className={styles.specUpLoading} role="status">
            스펙업 가이드를 준비하고 있어요…
          </p>
        )}
      </div>
    </Panel>
  );
}
