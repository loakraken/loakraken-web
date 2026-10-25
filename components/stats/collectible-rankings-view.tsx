"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchCollectibleRanking } from "@/lib/stats/client";
import { fixed, sampleText, whole } from "@/lib/stats/model";
import {
  COLLECTIBLE_DAYS,
  COLLECTIBLE_MAX_PAGE,
  COLLECTIBLE_PAGE_SIZE,
  COLLECTIBLE_UNITS,
  collectibleSearch,
  progressText,
  type CollectibleDays,
  type CollectibleQuery,
} from "@/lib/stats/collectible-ranking";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { rankingColumns } from "./ranking-columns";
import { BasisNote } from "./basis-note";
import { RankingTypeTabs, type RankingType } from "./ranking-type-tabs";
import { MoreDetail } from "@/components/ui/more-detail";

const SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
const ROSTER_COLUMNS = rankingColumns([3.5, 14, 6, 6.5, 8, 4.5, 9]);
const CHARACTER_COLUMNS = rankingColumns([3.5, 14, 6, 6.5, 8, 9]);

/**
 * Collectible ranking (backend #295/#304, checklist K33): rosters LOAKraken has
 * observed, by how much of the official collectibles they hold (Σ Point /
 * Σ MaxPoint). Collectibles belong to the roster, so a row is a roster shown
 * by its representative character; the character unit lists each character
 * with its roster's value. Each row opens the per-kind breakdown.
 */
export function CollectibleRankingsView({
  initial,
  types,
}: {
  initial: CollectibleQuery;
  types: readonly RankingType[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState<CollectibleQuery>(initial);
  const latest = useRef(initial);
  const ids = { server: useId(), days: useId() };
  const list = useQuery({
    queryKey: ["collectible-rankings", query],
    queryFn: ({ signal }) => fetchCollectibleRanking(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(list.error);
  const data = list.data?.data;
  const population = data?.meta?.population ?? 0;
  const pages = Math.max(1, Math.min(COLLECTIBLE_MAX_PAGE, Math.ceil(population / COLLECTIBLE_PAGE_SIZE)));
  const ready = data?.meta?.sampleStatus === "READY";
  const roster = query.unit === "ROSTER";
  const columns = roster ? ROSTER_COLUMNS : CHARACTER_COLUMNS;

  function apply(next: CollectibleQuery) {
    latest.current = next;
    setQuery(next);
    router.replace(`?${collectibleSearch(next)}`, { scroll: false });
  }
  const filter = (patch: Partial<CollectibleQuery>) => apply({ ...latest.current, ...patch, page: 1 });
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
          <p className={styles.kicker}>수집품</p>
          <h1 id="rankings-heading">랭킹</h1>
          <p>LOAKraken이 확인한 원정대를 수집품 진행도 순으로 보여줘요.</p>
        </section>
        <RankingTypeTabs value="collectibles" types={types} />

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="수집품 랭킹 조건">
          <span className={styles.segment} role="group" aria-label="단위">
            {COLLECTIBLE_UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={query.unit === item.id}
                onClick={() => filter({ unit: item.id })}
              >
                {item.label}
              </button>
            ))}
          </span>
          <label htmlFor={ids.server}>
            서버
            <Select
              id={ids.server}
              value={query.server ?? ""}
              onValueChange={(v) => filter({ server: v || undefined })}
              items={[{ value: "", label: "전체" }, ...SERVERS.map((s) => ({ value: s, label: s }))]}
            />
          </label>
          <label htmlFor={ids.days}>
            최근 확인
            <Select
              id={ids.days}
              value={query.activeDays}
              onValueChange={(v) => filter({ activeDays: v as CollectibleDays })}
              items={COLLECTIBLE_DAYS.map((d) => ({ value: d, label: `${d}일` }))}
            />
          </label>
        </form>

        {/* One height for loading, empty and short lists, so the notes below
            never move when the rows arrive (CLS). */}
        <div className={styles.listHold} {...pendingProps(list)}>
          {data?.meta && (
            <p key={list.dataUpdatedAt} className={`${styles.notice} ${styles.rankingNotice}`}>
              {/* Fixed words first, as on the character ranking (A7, #594). */}
              공식 랭킹이 아니에요 · {sampleText(data.meta, "roster")}
              {!ready && <strong> · 표본 {data.meta.minSample}개 원정대가 모이면 순위를 보여 드려요</strong>}
            </p>
          )}
          {list.isError && !data ? (
            <div className={styles.problem}>
              <p>{limit.limited ? countdownText(limit.seconds) : "수집품 랭킹을 불러오지 못했어요."}</p>
              <button type="button" onClick={() => list.refetch()} disabled={limit.seconds > 0}>
                {retryLabel(limit.seconds)}
              </button>
            </div>
          ) : !data ? (
            <p className={styles.muted} role="status">
              수집품 랭킹을 불러오고 있어요…
            </p>
          ) : !data.rows?.length ? (
            <p className={styles.muted}>
              {population === 0 ? "원정대 표본을 모으는 중이에요." : "조건에 맞는 원정대가 없어요."}
            </p>
          ) : (
            <DataTable label={`수집품 랭킹 ${query.page}쪽`} className={styles.table} {...columns.tableProps}>
              <caption className={styles.srOnly}>
                {roster ? "원정대" : "캐릭터"} 수집품 랭킹 {query.page}쪽
              </caption>
              {columns.colgroup}
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">{roster ? "대표 캐릭터" : "캐릭터"}</th>
                  <th scope="col" className={styles.left}>
                    서버
                  </th>
                  <th scope="col">아이템 레벨</th>
                  <th scope="col">진행도</th>
                  {roster && <th scope="col">캐릭터</th>}
                  <th scope="col" className={styles.left}>
                    종류별
                  </th>
                </tr>
              </thead>
              <tbody key={list.dataUpdatedAt}>
                {data.rows.map((row) => (
                  <tr key={`${row.serverName}-${row.characterName}`} data-reference={!ready || undefined}>
                    <td>{ready ? whole(row.rank) : "-"}</td>
                    <th scope="row">
                      <Link
                        href={`/character/${encodeURIComponent(row.characterName)}?tab=collectibles`}
                        className={styles.charLink}
                        aria-label={`${row.characterName} 수집품 보기`}
                      >
                        {row.characterName}
                      </Link>
                      {row.className && <span className={styles.role}> · {row.className}</span>}
                    </th>
                    <td className={styles.left}>{row.serverName}</td>
                    <td>{row.itemLevel != null ? fixed(row.itemLevel) : "-"}</td>
                    <td data-strong>
                      {progressText(row.progressPercent)}
                      <small className={styles.points}>
                        {whole(row.point)} / {whole(row.maxPoint)}
                      </small>
                    </td>
                    {roster && <td>{whole(row.characterCount)}명</td>}
                    <td className={styles.left}>
                      {row.types.length > 0 && (
                        <details className={styles.rosterMembers}>
                          <summary>{row.types.length}종 보기</summary>
                          <ol>
                            {row.types.map((kind) => (
                              <li key={kind.type} data-done={(kind.maxPoint > 0 && kind.point >= kind.maxPoint) || undefined}>
                                {kind.type}
                                <b>
                                  {whole(kind.point)} / {whole(kind.maxPoint)}
                                </b>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>

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
            <button
              type="button"
              disabled={query.page >= pages}
              onClick={() => apply({ ...query, page: query.page + 1 })}
            >
              다음
            </button>
          </nav>
        )}
        {/* One line on the page, the rest folded (#1112): nothing removed. */}
        <p className={styles.note}>진행도는 공식 수집품의 모은 점수 합 ÷ 최대 점수 합이에요.</p>
        <MoreDetail className={styles.note}>
          수집품은 원정대가 함께 모으므로 같은 원정대 캐릭터는 같은 값이고, 대표 캐릭터는 원정대에서 아이템 레벨이 가장
          높은 캐릭터예요.
        </MoreDetail>
        {data?.meta && <BasisNote basis={{ ...data.meta, unit: roster ? "개 원정대" : undefined }} />}
      </main>
    </div>
  );
}
