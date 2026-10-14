"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchGuildRanking } from "@/lib/stats/client";
import { fixed, sampleText, whole } from "@/lib/stats/model";
import {
  GUILD_MAX_PAGE,
  GUILD_PAGE_SIZE,
  GUILD_SORTS,
  guildSearch,
  isGuildName,
  type GuildQuery,
} from "@/lib/stats/guild-ranking";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { BasisNote } from "./basis-note";
import { PopularGuilds } from "./popular-guilds";
import { rankingColumns } from "./ranking-columns";
import { RankingTypeTabs, type RankingType } from "./ranking-type-tabs";

const SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
// 순위 · 길드 · 서버 · 아이템 레벨(평균 또는 합) · 확인한 길드원 · 전투력 평균
const COLUMNS = rankingColumns([3.5, 14, 6, 8.5, 7, 9]);

/**
 * Guild ranking (api #302, checklist L36·K28): guilds put together from the
 * characters LOAKraken has seen with the same server and guild name, by
 * their item level average or sum. Every value is over the members seen, so
 * the member column and the note say so; it is never the guild's real size.
 */
export function GuildRankingsView({
  initial,
  types,
  popular = false,
}: {
  initial: GuildQuery;
  types: readonly RankingType[];
  /** POPULAR_GUILDS on this deployment (server flag): the 인기 길드 card. */
  popular?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<GuildQuery>(initial);
  const latest = useRef(initial);
  const serverId = useId();
  const guildId = useId();
  const guildHintId = useId();
  const [guildText, setGuildText] = useState(initial.guild ?? "");
  const guildTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const list = useQuery({
    queryKey: ["guild-rankings", query],
    queryFn: ({ signal }) => fetchGuildRanking(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(list.error);
  const answer = list.data?.data;
  // A link past the last page of a name search (guild=…&page=9) has matches
  // but no rows on that page: show page 1 rather than "not in the ranking".
  // Until page 1 is here the screen reads as still loading — the same first
  // paint as any other link, so nothing moves when the rows land (A6).
  const pastLast = Boolean(query.guild && query.page > 1 && answer && !answer.rows?.length && (answer.matchCount ?? 0) > 0);
  const data = pastLast ? undefined : answer;
  const population = data?.meta?.population ?? 0;
  // A name search pages by the guilds that matched and made the ranking (api #466).
  const counted = query.guild ? (data?.matchCount ?? 0) : population;
  const pages = Math.max(1, Math.min(GUILD_MAX_PAGE, Math.ceil(counted / GUILD_PAGE_SIZE)));
  const ready = data?.meta?.sampleStatus === "READY";

  function apply(next: GuildQuery) {
    latest.current = next;
    setQuery(next);
    router.replace(`?${guildSearch(next)}`, { scroll: false });
  }
  const filter = (patch: Partial<GuildQuery>) => apply({ ...latest.current, ...patch, page: 1 });
  /** A typed name applies 300 ms after the last keystroke; one the backend would refuse waits. */
  const guildTrim = guildText.trim();
  const guildInvalid = guildTrim !== "" && !isGuildName(guildTrim);
  function typeGuild(text: string) {
    setGuildText(text);
    clearTimeout(guildTimer.current);
    const name = text.trim();
    if (name !== "" && !isGuildName(name)) return;
    guildTimer.current = setTimeout(() => filter({ guild: name || undefined }), 300);
  }
  useEffect(() => () => clearTimeout(guildTimer.current), []);
  useEffect(() => {
    if (pastLast) apply({ ...latest.current, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the page turns out empty
  }, [pastLast]);
  const sortLabel = GUILD_SORTS.find((item) => item.id === query.sort)?.label ?? "아이템 레벨 평균";
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
          <p className={styles.kicker}>길드</p>
          <h1 id="rankings-heading">랭킹</h1>
          <p>LOAKraken이 확인한 길드원으로 길드를 묶어 {sortLabel} 순으로 보여줘요.</p>
        </section>
        <RankingTypeTabs value="guilds" types={types} />

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="길드 랭킹 조건">
          <span className={styles.segment} role="group" aria-label="기준">
            {GUILD_SORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={query.sort === item.id}
                onClick={() => filter({ sort: item.id })}
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
          {/* The hint sits beside the label, not in it: the input's name stays
              "길드 찾기" and the hint only describes it. */}
          <span className={styles.guildSearch}>
            <label htmlFor={guildId}>
              길드 찾기
              <input
                id={guildId}
                type="search"
                name="guild"
                value={guildText}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                placeholder="길드 이름 일부…"
                aria-invalid={guildInvalid || undefined}
                aria-describedby={guildInvalid ? guildHintId : undefined}
                onChange={(e) => typeGuild(e.target.value)}
              />
            </label>
            {/* Under the input, out of the row's layout: it never moves the
                table while typing (A7). */}
            <small id={guildHintId} aria-live="polite">
              {guildInvalid ? "글자와 숫자만 찾을 수 있어요." : ""}
            </small>
          </span>
        </form>

        {/* One height for loading, empty and short lists, so the notes below
            never move when the rows arrive (CLS). */}
        {/* Dimmed while a name the backend would refuse is typed: the rows
            are still the last search's (same look as new conditions loading). */}
        <div className={styles.listHold} {...pendingProps({ isPlaceholderData: list.isPlaceholderData || guildInvalid })}>
          {data?.meta && (
            <p key={list.dataUpdatedAt} className={`${styles.notice} ${styles.rankingNotice}`}>
              {sampleText(data.meta, "guild")} · 공식 랭킹이 아니에요
              {!ready && (
                <strong> · 표본 {data.meta.minSample}개 길드가 모이면 순위를 보여 드려요</strong>
              )}
            </p>
          )}
          {list.isError && !data ? (
            <div className={styles.problem}>
              <p>{limit.limited ? countdownText(limit.seconds) : "길드 랭킹을 불러오지 못했어요."}</p>
              <button type="button" onClick={() => list.refetch()} disabled={limit.seconds > 0}>
                {retryLabel(limit.seconds)}
              </button>
            </div>
          ) : !data ? (
            <p className={styles.muted} role="status">
              길드 랭킹을 불러오고 있어요…
            </p>
          ) : !data.rows?.length ? (
            <p className={styles.muted}>
              {population === 0
                ? "길드 표본을 모으는 중이에요."
                : query.guild
                  ? (data.excludedMatches ?? 0) > 0
                    ? `‘${query.guild}’이(가) 들어간 길드 ${whole(data.excludedMatches ?? 0)}개는 확인한 길드원이 ${whole(data.minMembers)}명보다 적어 순위에 없어요.`
                    : `‘${query.guild}’이(가) 들어간 길드가 순위에 없어요.`
                  : "조건에 맞는 길드가 없어요."}
            </p>
          ) : (
            <DataTable
              label={`길드 ${sortLabel} 랭킹 ${query.page}쪽`}
              className={styles.table}
              {...COLUMNS.tableProps}
            >
              <caption className={styles.srOnly}>
                길드 {sortLabel} 랭킹 {query.page}쪽
              </caption>
              {COLUMNS.colgroup}
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col" className={styles.left}>
                    길드
                  </th>
                  <th scope="col" className={styles.left}>
                    서버
                  </th>
                  <th scope="col">{sortLabel}</th>
                  <th scope="col">확인한 길드원</th>
                  <th scope="col">전투력 평균</th>
                </tr>
              </thead>
              <tbody key={list.dataUpdatedAt}>
                {data.rows.map((row) => (
                  <tr key={`${row.serverName}-${row.guildName}`} data-reference={!ready || undefined}>
                    <td>{ready ? whole(row.rank) : "-"}</td>
                    <th scope="row" className={styles.left}>
                      {row.guildName}
                    </th>
                    <td className={styles.left}>{row.serverName}</td>
                    <td data-strong>{fixed(query.sort === "SUM" ? row.itemLevelSum : row.itemLevelAvg)}</td>
                    <td>{whole(row.memberCount)}명</td>
                    <td>
                      {row.combatPowerAvg == null ? (
                        "-"
                      ) : (
                        <>
                          {fixed(row.combatPowerAvg)}
                          {row.combatPowerCount < row.memberCount && (
                            <small>{whole(row.combatPowerCount)}명 기준</small>
                          )}
                        </>
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
        <p className={styles.note}>
          확인한 길드원은 LOAKraken이 최근 확인한 공개 캐릭터 수로, 실제 길드 인원이 아니에요.
          {data && ` 확인한 길드원이 ${whole(data.minMembers)}명보다 적은 길드는 순위에 넣지 않아요`}
          {data && (data.excludedGuilds ?? 0) > 0 && `(이번 조건에서 ${whole(data.excludedGuilds)}개)`}
          {data && "."}
        </p>
        {data?.meta && <BasisNote basis={{ ...data.meta, unit: "개 길드" }} />}
        {/* Last on the page: arriving later, it pushes nothing above it (A6). */}
        {popular && <PopularGuilds server={query.server} />}
      </main>
    </div>
  );
}
