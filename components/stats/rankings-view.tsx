"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { TIER_LABEL } from "@/lib/character/rank";
import { fetchRankings } from "@/lib/stats/client";
import { fixed, percent, sampleText, whole } from "@/lib/stats/model";
import { MAX_PAGE, PAGE_SIZE, rankingSearch, type RankingQuery } from "@/lib/stats/rankings";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { BasisNote } from "./basis-note";

const SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
const CLASSES = [
  "버서커", "디스트로이어", "워로드", "홀리나이트", "슬레이어", "발키리", "배틀마스터", "인파이터", "기공사",
  "창술사", "스트라이커", "브레이커", "데빌헌터", "블래스터", "호크아이", "스카우터", "건슬링어", "바드",
  "서머너", "아르카나", "소서리스", "블레이드", "데모닉", "리퍼", "소울이터", "도화가", "기상술사", "환수사",
];

/**
 * LOAWA-style ranking (backend #100): combat power or item level, filtered
 * like the statistics page, 50 per page. The list is LOAKraken's sample, not
 * the official ranking, and hidden characters never appear.
 */
export function RankingsView({ initial }: { initial: RankingQuery }) {
  const router = useRouter();
  const [query, setQuery] = useState<RankingQuery>(initial);
  const [levelText, setLevelText] = useState(initial.itemLevelMin != null ? String(initial.itemLevelMin) : "");
  const latest = useRef(initial);
  const levelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ids = { server: useId(), role: useId(), cls: useId(), days: useId(), level: useId() };
  const list = useQuery({
    queryKey: ["rankings", query],
    queryFn: ({ signal }) => fetchRankings(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(list.error);
  const data = list.data?.data;
  const pages = data ? Math.max(1, Math.min(MAX_PAGE, Math.ceil(data.meta.population / PAGE_SIZE))) : 1;

  function apply(next: RankingQuery) {
    latest.current = next;
    setQuery(next);
    const params = rankingSearch(next);
    router.replace(params.size ? `?${params}` : "?", { scroll: false });
  }
  const filter = (patch: Partial<RankingQuery>) => apply({ ...latest.current, ...patch, page: 1 });
  function typeLevel(text: string) {
    setLevelText(text);
    clearTimeout(levelTimer.current);
    levelTimer.current = setTimeout(() => {
      const n = text.trim() ? Number(text) : undefined;
      if (n !== undefined && !(Number.isFinite(n) && n >= 0 && n <= 2000)) return;
      if (n !== latest.current.itemLevelMin) filter({ itemLevelMin: n });
    }, 300);
  }
  useEffect(() => () => clearTimeout(levelTimer.current), []);

  const metricLabel = query.metric === "ITEM_LEVEL" ? "아이템 레벨" : "전투력";
  const pageWindow = Array.from({ length: Math.min(pages, 7) }, (_, i) => {
    const start = Math.min(Math.max(1, query.page - 3), Math.max(1, pages - 6));
    return start + i;
  });

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#rankings-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="rankings-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="rankings-heading">
          <p className={styles.kicker}>캐릭터</p>
          <h1 id="rankings-heading">랭킹</h1>
          <p>LOAKraken이 확인한 캐릭터를 {metricLabel} 순으로 보여줘요.</p>
        </section>

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="랭킹 조건">
          <span className={styles.segment} role="group" aria-label="기준">
            {(["COMBAT_POWER", "ITEM_LEVEL"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={query.metric === m} onClick={() => filter({ metric: m })}>
                {m === "ITEM_LEVEL" ? "아이템 레벨" : "전투력"}
              </button>
            ))}
          </span>
          <label htmlFor={ids.server}>
            서버
            <select id={ids.server} value={query.server ?? ""} onChange={(e) => filter({ server: e.target.value || undefined })}>
              <option value="">전체</option>
              {SERVERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label htmlFor={ids.cls}>
            직업
            <select id={ids.cls} value={query.className ?? ""} onChange={(e) => filter({ className: e.target.value || undefined })}>
              <option value="">전체</option>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label htmlFor={ids.role}>
            역할
            <select
              id={ids.role}
              value={query.role ?? ""}
              onChange={(e) => filter({ role: (e.target.value || undefined) as RankingQuery["role"] })}
            >
              <option value="">전체</option>
              <option value="DEALER">딜러</option>
              <option value="SUPPORT">서포터</option>
            </select>
          </label>
          <label htmlFor={ids.days}>
            최근 확인
            <select
              id={ids.days}
              value={query.activeDays ?? 30}
              onChange={(e) => filter({ activeDays: Number(e.target.value) as 7 | 30 | 90 })}
            >
              <option value={7}>7일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
            </select>
          </label>
          <label htmlFor={ids.level}>
            아이템 레벨 이상
            <input
              id={ids.level}
              inputMode="decimal"
              value={levelText}
              placeholder="1640"
              onChange={(e) => typeLevel(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </label>
        </form>

        {data && (
          <p className={styles.notice}>
            {sampleText(data.meta)} · 공식 랭킹이 아니에요
            {data.meta.sampleStatus !== "READY" && <strong> · 표본 {data.meta.minSample}명이 모이면 순위를 보여 드려요</strong>}
          </p>
        )}

        {list.isError && !data ? (
          <div className={styles.problem}>
            <p>{limit.limited ? countdownText(limit.seconds) : "랭킹을 불러오지 못했어요."}</p>
            <button type="button" onClick={() => list.refetch()} disabled={limit.seconds > 0}>
              {retryLabel(limit.seconds)}
            </button>
          </div>
        ) : !data ? (
          // Holds most of the screen so the note below starts out of view and
          // the 50-row table arriving moves nothing visible (user 10-11).
          <p className={`${styles.muted} ${styles.listHold}`} role="status">
            랭킹을 불러오고 있어요…
          </p>
        ) : data.rows.length === 0 ? (
          <p className={styles.muted}>조건에 맞는 캐릭터가 없어요.</p>
        ) : (
          <DataTable label={`${metricLabel} 랭킹 ${query.page}쪽`} className={styles.table}>
            <caption className={styles.srOnly}>
              {metricLabel} 랭킹 {query.page}쪽
            </caption>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">캐릭터</th>
                <th scope="col" className={styles.left}>서버</th>
                <th scope="col" className={styles.left}>직업</th>
                <th scope="col">아이템 레벨</th>
                <th scope="col">전투력</th>
                <th scope="col">상위</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.serverName}-${row.characterName}`}>
                  <td>{whole(row.rank)}</td>
                  <th scope="row">
                    <Link href={`/character/${encodeURIComponent(row.characterName)}`} className={styles.charLink}>
                      {row.characterName}
                    </Link>
                  </th>
                  <td className={styles.left}>{row.serverName}</td>
                  <td className={styles.left}>
                    {row.className}
                    {row.position === "SUPPORT" && <span className={styles.role}> · 서포터</span>}
                  </td>
                  <td data-strong={query.metric === "ITEM_LEVEL" || undefined}>{fixed(row.itemLevel)}</td>
                  <td data-strong={query.metric === "COMBAT_POWER" || undefined}>{fixed(row.combatPower)}</td>
                  <td>
                    {percent(row.topPercent)}
                    {row.tier && TIER_LABEL[row.tier] && <> <b className={styles.tier}>{TIER_LABEL[row.tier]}</b></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {data && pages > 1 && (
          <nav className={styles.pager} aria-label="쪽 이동">
            <button type="button" disabled={query.page <= 1} onClick={() => apply({ ...query, page: query.page - 1 })}>
              이전
            </button>
            {pageWindow.map((p) => (
              <button
                key={p}
                type="button"
                aria-current={p === query.page ? "page" : undefined}
                onClick={() => apply({ ...query, page: p })}
              >
                {p}
              </button>
            ))}
            <button type="button" disabled={query.page >= pages} onClick={() => apply({ ...query, page: query.page + 1 })}>
              다음
            </button>
          </nav>
        )}
        <p className={styles.note}>
          순위는 LOAKraken이 조회·갱신한 캐릭터 기준이며, 순위 비공개로 설정된 캐릭터는 나오지 않아요. 티어: 크라켄 상위 1% · 해구 5% · 심해 10% · 대양 25% · 연안 50%
        </p>
        {data && <BasisNote basis={data.meta} />}
      </main>
    </div>
  );
}
