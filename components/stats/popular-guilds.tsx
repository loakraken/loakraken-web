"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { countdownText } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchPopularGuilds } from "@/lib/stats/client";
import { POPULAR_GUILD_PERIODS, type PopularGuildsPeriod } from "@/lib/stats/popular-guilds";
import { useTallest } from "@/components/ui/use-tallest";
import home from "@/components/home/home.module.css";
import styles from "./popular-guilds.module.css";

/**
 * 인기 길드 (api #467, checklist M21) under the guild ranking: rank, guild and
 * server for the ranking's server choice, last 24 hours or 7 days. The views
 * behind the order stay hidden (like the popular characters); the line under
 * the list says what is counted.
 */
export function PopularGuilds({ server }: { server?: string }) {
  const [period, setPeriod] = useState<PopularGuildsPeriod>("24h");
  const query = useQuery({
    queryKey: ["popular-guilds", period, server ?? null],
    queryFn: ({ signal }) => fetchPopularGuilds({ period, server }, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  // The other period's loading line or a shorter list keeps the room (A7).
  const [bodyRef, bodyHeight] = useTallest();
  return (
    <section className={`${home.panel} ${styles.card}`} aria-labelledby="popular-guilds-heading">
      <div className={home.panelHead}>
        <h2 id="popular-guilds-heading">인기 길드{server ? ` · ${server}` : ""}</h2>
        <span className={home.noticeTabs} role="group" aria-label="인기 길드 기간">
          {POPULAR_GUILD_PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <div ref={bodyRef} style={bodyHeight ? { minHeight: bodyHeight } : undefined}>
        {query.isPending ? (
          <p className={home.muted}>순위를 불러오고 있어요…</p>
        ) : !data ? (
          <p className={home.muted}>{limit.limited ? countdownText(limit.seconds) : "순위를 불러오지 못했어요."}</p>
        ) : data.sampleStatus === "COLLECTING" || data.items.length === 0 ? (
          <p className={home.muted}>아직 순위를 집계하고 있어요.</p>
        ) : (
          // Drawn anew per period and server: rows rewritten in place would
          // count as moving when their text starts elsewhere (A7).
          <ol key={`${period}-${server ?? ""}`} className={home.popular} aria-label="인기 길드 순위">
            {data.items.map((item) => (
              <li key={`${item.serverName}-${item.guildName}`}>
                <span className={styles.row}>
                  <b className={home.rank} data-top={item.rank <= 3 || undefined}>
                    {item.rank}
                  </b>
                  <span className={home.recentName}>
                    <strong>{item.guildName}</strong>
                    <small>{item.serverName}</small>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className={home.note}>
        LOAKraken 검색 기준 · 길드원 캐릭터 조회를 합한 순위예요. 같은 사람의 반복 조회는 하루 한 번만 셉니다.
      </p>
    </section>
  );
}
