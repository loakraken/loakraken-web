"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "@/components/ui/icons";
import { countdownText } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchStats } from "@/lib/stats/client";
import { fixed, share, whole } from "@/lib/stats/model";
import styles from "./home.module.css";

/**
 * Server info on the home aside (B-3): characters per server and the median
 * item level, from the statistics sample — said plainly, so it is never read
 * as the game's population.
 */
export function ServerCard() {
  const query = useQuery({
    queryKey: ["stats", "servers", {}],
    queryFn: ({ signal }) => fetchStats("servers", {}, signal),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  const rows = [...(data?.rows ?? [])].sort((a, b) => b.count - a.count);

  return (
    <section className={styles.panel} aria-labelledby="server-heading">
      <div className={styles.panelHead}>
        <h2 id="server-heading">서버 정보</h2>
        <Link href="/stats?tab=servers" className={styles.more}>
          통계 더보기 <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <p className={styles.muted}>서버 정보를 불러오고 있어요…</p>
      ) : !data ? (
        <p className={styles.muted}>
          {limit.limited ? countdownText(limit.seconds) : "서버 정보를 불러오지 못했어요."}
        </p>
      ) : (
        <table className={styles.servers}>
          <caption className={styles.srOnly}>서버별 캐릭터 수와 아이템 레벨 중앙값(통계 표본 기준)</caption>
          <thead>
            <tr>
              <th scope="col">서버</th>
              <th scope="col">캐릭터</th>
              <th scope="col">레벨 중앙값</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serverName}>
                <th scope="row">{row.serverName}</th>
                <td>
                  {whole(row.count)}
                  <span className={styles.srOnly}>, </span>
                  <small>{share(row.share)}</small>
                </td>
                <td>
                  {row.sampleStatus === "READY" ? (
                    fixed(row.itemLevelMedian)
                  ) : (
                    // Too few to call a median (user, 11:20): the sample size, dimmed.
                    <span className={styles.sampleSize}>표본 {whole(row.count)}명</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && (
        <p className={styles.serverNote}>
          통계 표본 기준 · 최근 {data.meta.conditions.activeDays}일 안에 LOAKraken이 확인한 캐릭터예요. 서버 전체 인원이 아니에요.
        </p>
      )}
    </section>
  );
}
