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
import { fetchRosterRanking } from "@/lib/stats/client";
import { fixed, sampleText, whole } from "@/lib/stats/model";
import {
  ROSTER_AGGREGATES,
  ROSTER_BASES,
  ROSTER_MAX_PAGE,
  ROSTER_PAGE_SIZE,
  rosterSearch,
  type RosterQuery,
  type RosterRow,
} from "@/lib/stats/roster-ranking";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { rankingColumns } from "./ranking-columns";
import { BasisNote } from "./basis-note";
import { RankingTypeTabs, type RankingType } from "./ranking-type-tabs";
import { MoreDetail } from "@/components/ui/more-detail";

const ROSTER_COLUMNS = rankingColumns([3.5, 14, 6, 7.5, 4.5, 16]);

const SERVERS = [
  "루페온",
  "실리안",
  "아만",
  "아브렐슈드",
  "카단",
  "카마인",
  "카제로스",
  "니나브",
];

/**
 * Roster ranking (backend #298): rosters LOAKraken has observed, by the top
 * six characters' average (식스맨) or sum, or every character's average, of
 * combat power or item level. Each row shows the representative character,
 * how many characters made the value, and the members on demand.
 */
export function RosterRankingsView({ initial, types }: { initial: RosterQuery; types: readonly RankingType[] }) {
  const router = useRouter();
  const [query, setQuery] = useState<RosterQuery>(initial);
  const latest = useRef(initial);
  const serverId = useId();
  const list = useQuery({
    queryKey: ["roster-rankings", query],
    queryFn: ({ signal }) => fetchRosterRanking(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(list.error);
  const data = list.data?.data;
  const population = data?.meta?.population ?? 0;
  const pages = Math.max(
    1,
    Math.min(ROSTER_MAX_PAGE, Math.ceil(population / ROSTER_PAGE_SIZE)),
  );
  const ready = data?.meta?.sampleStatus === "READY";

  function apply(next: RosterQuery) {
    latest.current = next;
    setQuery(next);
    router.replace(`?${rosterSearch(next)}`, { scroll: false });
  }
  const filter = (patch: Partial<RosterQuery>) =>
    apply({ ...latest.current, ...patch, page: 1 });
  const basisLabel =
    ROSTER_BASES.find((item) => item.id === query.basis)?.label ?? "전투력";
  const aggregateLabel =
    ROSTER_AGGREGATES.find((item) => item.id === query.aggregate)?.label ??
    "식스맨 평균";
  const value = (row: RosterRow) => fixed(row.value);
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
          <p className={styles.kicker}>원정대</p>
          <h1 id="rankings-heading">랭킹</h1>
          <p>
            LOAKraken이 확인한 원정대를 {basisLabel} {aggregateLabel} 순으로
            보여줘요.
          </p>
        </section>
        <RankingTypeTabs value="roster" types={types} />

        <form
          className={styles.filters}
          onSubmit={(e) => e.preventDefault()}
          aria-label="원정대 랭킹 조건"
        >
          <span className={styles.segment} role="group" aria-label="기준">
            {ROSTER_BASES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={query.basis === item.id}
                onClick={() => filter({ basis: item.id })}
              >
                {item.label}
              </button>
            ))}
          </span>
          <span className={styles.segment} role="group" aria-label="계산">
            {ROSTER_AGGREGATES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={query.aggregate === item.id}
                onClick={() => filter({ aggregate: item.id })}
              >
                {item.label}
              </button>
            ))}
          </span>
          <label htmlFor={serverId}>
            서버
            <Select
              id={serverId}
              value={query.server ?? ""}
              onValueChange={(v) => filter({ server: v || undefined })}
              items={[{ value: "", label: "전체" }, ...SERVERS.map((s) => ({ value: s, label: s }))]}
            />
          </label>
        </form>

        {/* One height for loading, empty and short lists, so the notes below
            never move when the rows arrive (CLS). */}
        <div className={styles.listHold} {...pendingProps(list)}>
          {data?.meta && (
            <p key={list.dataUpdatedAt} className={`${styles.notice} ${styles.rankingNotice}`}>
              {sampleText(data.meta, "roster")} ·
              공식 랭킹이 아니에요
              {!ready && (
                <strong>
                  {" "}
                  · 표본 {data.meta.minSample}개 원정대가 모이면 순위를 보여
                  드려요
                </strong>
              )}
            </p>
          )}
          {list.isError && !data ? (
            <div className={styles.problem}>
              <p>
                {limit.limited
                  ? countdownText(limit.seconds)
                  : "원정대 랭킹을 불러오지 못했어요."}
              </p>
              <button
                type="button"
                onClick={() => list.refetch()}
                disabled={limit.seconds > 0}
              >
                {retryLabel(limit.seconds)}
              </button>
            </div>
          ) : !data ? (
            <p className={styles.muted} role="status">
              원정대 랭킹을 불러오고 있어요…
            </p>
          ) : !data.rows?.length ? (
            <p className={styles.muted}>
              {population === 0
                ? "원정대 표본을 모으는 중이에요."
                : "조건에 맞는 원정대가 없어요."}
            </p>
          ) : (
            <DataTable
              label={`원정대 ${aggregateLabel} 랭킹 ${query.page}쪽`}
              className={styles.table}
              {...ROSTER_COLUMNS.tableProps}
            >
              <caption className={styles.srOnly}>
                원정대 {basisLabel} {aggregateLabel} 랭킹 {query.page}쪽
              </caption>
              {ROSTER_COLUMNS.colgroup}
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">대표 캐릭터</th>
                  <th scope="col" className={styles.left}>
                    서버
                  </th>
                  <th scope="col">{aggregateLabel}</th>
                  <th scope="col">인원</th>
                  <th scope="col" className={styles.left}>
                    구성
                  </th>
                </tr>
              </thead>
              <tbody key={list.dataUpdatedAt}>
                {data.rows.map((row) => (
                  <tr
                    key={`${row.serverName}-${row.characterName}`}
                    data-reference={!ready || undefined}
                  >
                    <td>{ready ? whole(row.rank) : "-"}</td>
                    <th scope="row">
                      <Link
                        href={`/character/${encodeURIComponent(row.characterName)}?tab=siblings`}
                        className={styles.charLink}
                        aria-label={`${row.characterName} 원정대 보기`}
                      >
                        {row.characterName}
                      </Link>
                      {row.className && (
                        <span className={styles.role}> · {row.className}</span>
                      )}
                    </th>
                    <td className={styles.left}>{row.serverName}</td>
                    <td data-strong>{value(row)}</td>
                    <td>
                      {row.usedCharacters < row.characterCount &&
                      query.aggregate !== "ALL_AVG"
                        ? `${row.usedCharacters} / ${row.characterCount}명`
                        : `${row.usedCharacters}명`}
                    </td>
                    <td className={styles.left}>
                      <details className={styles.rosterMembers}>
                        <summary>{row.composition.length}명 보기</summary>
                        <ol>
                          {row.composition.map((member) => (
                            <li key={member.characterName}>
                              <Link
                                href={`/character/${encodeURIComponent(member.characterName)}`}
                              >
                                {member.characterName}
                              </Link>
                              {member.className && (
                                <span className={styles.role}>
                                  {" "}
                                  · {member.className}
                                </span>
                              )}
                              <b>{fixed(member.value)}</b>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>

        {data && pages > 1 && (
          <nav className={styles.pager} aria-label="쪽 이동">
            <button
              type="button"
              disabled={query.page <= 1}
              onClick={() => apply({ ...query, page: query.page - 1 })}
            >
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
        {/* One line on the page, the counting rules folded (#1112): nothing removed. */}
        <p className={styles.note}>
          원정대는 서버를 고르면 그 서버, 고르지 않으면 대표 캐릭터의 서버
          캐릭터만 세요(인원·전체 평균도 그 서버 기준이에요).
        </p>
        <MoreDetail className={styles.note}>
          식스맨은 그중 아이템 레벨이 높은 6명이고, 식스맨 평균은 이 6명의 {basisLabel} 합을 6으로
          나눠요. 6명보다 적어도 6으로 나눠요.
        </MoreDetail>
        {data?.meta && <BasisNote basis={{ ...data.meta, unit: "개 원정대" }} />}
      </main>
    </div>
  );
}
