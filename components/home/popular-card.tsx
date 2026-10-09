"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPopular } from "@/lib/character/client";
import type { PopularPeriod } from "@/lib/character/popular";
import styles from "./home.module.css";
import { countdownText } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";

const PERIODS: { id: PopularPeriod; label: string }[] = [
  { id: "24h", label: "24시간" },
  { id: "7d", label: "7일" },
];
const level = (value: number | null) =>
  value == null ? "-" : value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * LOAWA-style "인기 검색 캐릭터" (F-10): rank, name, server · class and item
 * level. Search counts stay hidden (PM decision); too few searches yet shows
 * a collecting state instead of a thin list.
 */
export function PopularCard() {
  const [period, setPeriod] = useState<PopularPeriod>("24h");
  const query = useQuery({
    queryKey: ["home-popular", period],
    queryFn: ({ signal }) => fetchPopular(period, signal),
    staleTime: 5 * 60_000,
  });
  const data = query.data?.data;
  const limit = useRateLimit(query.error);

  return (
    <section className={styles.panel} aria-labelledby="popular-heading">
      <div className={styles.panelHead}>
        <h2 id="popular-heading">인기 검색 캐릭터</h2>
        <span className={styles.noticeTabs} role="group" aria-label="기간">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </span>
      </div>
      {query.isPending ? (
        <p className={styles.muted}>순위를 불러오고 있어요…</p>
      ) : !data ? (
        <p className={styles.muted}>
          {limit.limited ? countdownText(limit.seconds) : "순위를 불러오지 못했어요."}
        </p>
      ) : data.sampleStatus === "COLLECTING" || data.items.length === 0 ? (
        <p className={styles.muted}>아직 순위를 집계하고 있어요.</p>
      ) : (
        <ol className={styles.popular}>
          {data.items.map((item) => (
            <li key={`${item.serverName}-${item.characterName}`}>
              <Link href={`/character/${encodeURIComponent(item.characterName)}`}>
                <b className={styles.rank} data-top={item.rank <= 3 || undefined}>
                  {item.rank}
                </b>
                <span className={styles.recentName}>
                  <strong>{item.characterName}</strong>
                  <small>{[item.serverName, item.className].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={styles.recentLevel}>
                  <b>{level(item.itemLevel)}</b>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.note}>LOAKraken 검색 기준 · 같은 사람의 반복 검색은 하루 한 번만 셉니다.</p>
    </section>
  );
}
