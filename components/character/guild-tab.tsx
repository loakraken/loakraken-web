"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTallest } from "@/components/ui/use-tallest";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { normalizeCharacterName, type Character } from "@/lib/character/model";
import { fetchGuildDetail, StatsQueryError } from "@/lib/stats/client";
import { GUILD_DAYS, binLabel, guildDetailKey, type GuildDays, type GuildDetail, type GuildBin } from "@/lib/stats/guild-detail";
import stats from "@/components/stats/stats.module.css";
import { Panel } from "./panel";
import styles from "./detail.module.css";
import own from "./guild-tab.module.css";

const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
const kstTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const two = (value: number | string | null | undefined) =>
  value == null ? "-" : Number(value).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (value: number) => value.toLocaleString("ko-KR");

/** Share bars over a list of counted rows (classes, bins). */
function Bars({ rows, label }: { rows: { name: string; count: number }[]; label: string }) {
  const most = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ol className={own.bars} aria-label={label}>
      {rows.map((row) => (
        <li key={row.name}>
          <span className={own.name}>{row.name}</span>
          <span className={own.track} aria-hidden="true">
            <i style={{ transform: `scaleX(${row.count / most})` }} />
          </span>
          <b>{whole(row.count)}명</b>
        </li>
      ))}
    </ol>
  );
}

const binRows = (bins: GuildBin[], width: number, digits: number) =>
  bins.map((bin, i) => ({ name: binLabel(bins, i, width, digits), count: bin.count }));

type MemberRow = GuildDetail["members"][number];

/**
 * Rosters as the backend numbered them in this answer (most members first,
 * then the highest item level). A member alone in the guild, or whose roster
 * is not known, goes into one last group of their own — never under the
 * roster above it (PM-프론트 #788 P2). The numbers mean nothing outside this
 * answer, so they are never shown.
 */
export function rosters(members: MemberRow[]) {
  const known = new Map<number, MemberRow[]>();
  for (const member of members)
    if (member.rosterGroup != null) known.set(member.rosterGroup, [...(known.get(member.rosterGroup) ?? []), member]);
  const shared = [...known.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, rows]) => rows)
    .filter((rows) => rows.length > 1);
  const single = new Set(shared.flat());
  // In the item level order the members came in.
  const rest = members.filter((member) => !single.has(member));
  return { shared, rest };
}

function MemberRows({ rows, current }: { rows: MemberRow[]; current: string }) {
  return rows.map((member) => (
    <tr key={member.characterName} data-current={member.characterName === current || undefined}>
      <th scope="row">
        <Link href={`/character/${encodeURIComponent(normalizeCharacterName(member.characterName))}`} prefetch={false}>
          {member.characterName}
        </Link>
      </th>
      <td>{member.className}</td>
      <td>{two(member.itemLevel)}</td>
      <td>{two(member.combatPower)}</td>
      <td>{member.guildMemberGrade ?? "-"}</td>
      <td>{kst.format(new Date(member.observedAt))}</td>
    </tr>
  ));
}

/** 길드원: by item level, or by roster (K28) — same rows, grouped. */
function Members({ detail, current }: { detail: GuildDetail; current: string }) {
  const [byRoster, setByRoster] = useState(false);
  // The roster view adds a line per roster: going back keeps that room, or a
  // page scrolled to its end would be pulled up (A7).
  const [tableRef, tableHeight] = useTallest();
  const groups = rosters(detail.members);
  const shared = groups.shared.length;
  return (
    <Panel
      title="길드원"
      wide
      meta={
        <span className={stats.segment} role="group" aria-label="길드원 보기">
          <button type="button" aria-pressed={!byRoster} onClick={() => setByRoster(false)}>
            아이템 레벨 순
          </button>
          <button type="button" aria-pressed={byRoster} onClick={() => setByRoster(true)}>
            원정대별
          </button>
        </span>
      }
    >
      {/* The same line in both views, so switching moves nothing (A7). */}
      <p className={own.note}>
        {whole(detail.members.length)}명 · 같은 원정대로 확인한 묶음 {whole(shared)}개(나머지는 혼자이거나 원정대를 아직
        모르는 캐릭터)
      </p>
      {/* Fades at an end where columns are hidden (a phone scrolls the table). */}
      <div
        ref={tableRef}
        className={`${styles.tableWrap} scroll-fade-x`}
        style={tableHeight ? { minHeight: tableHeight } : undefined}
      >
        <table className={own.members}>
          <caption className={styles.srOnly}>{detail.guildName} 길드원</caption>
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">직업</th>
              <th scope="col">아이템 레벨</th>
              <th scope="col">전투력</th>
              <th scope="col">직위</th>
              <th scope="col">마지막 확인</th>
            </tr>
          </thead>
          {/* Drawn anew per view: rows moved in place would count as moving (A7). */}
          {byRoster ? (
            <>
              {groups.shared.map((rows, i) => (
                <tbody key={`roster-${i}`} className={own.roster}>
                  <tr className={own.rosterHead}>
                    <th scope="rowgroup" colSpan={6}>
                      같은 원정대 {rows.length}명
                    </th>
                  </tr>
                  <MemberRows rows={rows} current={current} />
                </tbody>
              ))}
              {groups.rest.length > 0 && (
                <tbody key="rest" className={own.roster}>
                  <tr className={own.rosterHead}>
                    <th scope="rowgroup" colSpan={6}>
                      혼자이거나 원정대를 모르는 길드원 {groups.rest.length}명
                    </th>
                  </tr>
                  <MemberRows rows={groups.rest} current={current} />
                </tbody>
              )}
            </>
          ) : (
            <tbody key="level">
              <MemberRows rows={detail.members} current={current} />
            </tbody>
          )}
        </table>
      </div>
    </Panel>
  );
}

function Body({ detail, current }: { detail: GuildDetail; current: string }) {
  const { meta, summary } = detail;
  const small = meta.sampleStatus !== "READY";
  return (
    <>
      <Panel
        title="길드원 기준"
        wide
        meta={`${detail.serverName} · 확인한 길드원 ${whole(meta.memberCount)}명`}
      >
        <dl className={own.summary}>
          <div>
            <dt>아이템 레벨 평균</dt>
            <dd>{two(summary.itemLevelAvg)}</dd>
          </div>
          <div>
            <dt>아이템 레벨 중앙값</dt>
            <dd>{two(summary.itemLevelMedian)}</dd>
          </div>
          <div>
            <dt>아이템 레벨 최고</dt>
            <dd>{two(summary.itemLevelMax)}</dd>
          </div>
          <div>
            <dt>아이템 레벨 최저</dt>
            <dd>{two(summary.itemLevelMin)}</dd>
          </div>
          <div>
            <dt>전투력 평균</dt>
            <dd>{two(summary.combatPowerAvg)}</dd>
          </div>
          <div>
            <dt>전투력 중앙값</dt>
            <dd>{two(summary.combatPowerMedian)}</dd>
          </div>
        </dl>
        <p className={own.note}>
          LOAKraken이 최근 {meta.activeDays}일 안에 확인한 공개 길드원 {whole(meta.memberCount)}명 기준이에요(실제 길드
          전체가 아니에요). 전투력은 전투력을 확인한 {whole(summary.combatPowerCount)}명으로 셌어요.{" "}
          {kstTime.format(new Date(meta.aggregatedAt))} 기준.
          {small && <strong> 확인한 길드원이 {meta.minMembers}명 미만이라 참고값이에요.</strong>}
        </p>
      </Panel>
      <Panel title="직업">
        <Bars label="직업별 길드원" rows={detail.classes.map((row) => ({ name: row.className, count: row.count }))} />
      </Panel>
      <Panel title="아이템 레벨 분포">
        <Bars label="아이템 레벨 구간별 길드원" rows={binRows(detail.itemLevelBins, 10, 0)} />
      </Panel>
      {detail.combatPowerBins.length > 0 && (
        <Panel title="전투력 분포" meta={`${whole(summary.combatPowerCount)}명`}>
          <Bars label="전투력 구간별 길드원" rows={binRows(detail.combatPowerBins, 100, 0)} />
        </Panel>
      )}
      <Members detail={detail} current={current} />
    </>
  );
}

/**
 * 길드 (L36·K28·M10): the character's guild as LOAKraken has seen it — a
 * sample of its public members, said as such, with the days it covers.
 */
export function GuildTab({ data }: { data: Character }) {
  const [days, setDays] = useState<GuildDays>(30);
  const guildName = data.guildName ?? null;
  const serverName = data.serverName ?? null;
  const query = { serverName: serverName ?? "", guildName: guildName ?? "", activeDays: days };
  const guild = useQuery({
    queryKey: guildDetailKey(query),
    queryFn: ({ signal }) => fetchGuildDetail(query, signal),
    enabled: Boolean(guildName && serverName),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(guild.error);
  // Another span's shorter list keeps the room (A7).
  const [heldRef, held] = useTallest();
  const detail = guild.data?.data;
  const notObserved = guild.error instanceof StatsQueryError && guild.error.info.code === "STATS_GUILD_NOT_OBSERVED";

  if (!guildName || !serverName)
    return (
      <div className={styles.layout}>
        <Panel title="길드" wide>
          <p className={styles.muted}>이 캐릭터는 길드에 들어 있지 않아요.</p>
        </Panel>
      </div>
    );
  return (
    <div className={styles.layout}>
      <div className={own.head}>
        <h2>{guildName}</h2>
        <span className={stats.segment} role="group" aria-label="최근 확인">
          {GUILD_DAYS.map((value) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>
              {value}일
            </button>
          ))}
        </span>
      </div>
      <div ref={heldRef} className={own.held} style={held ? { minHeight: held } : undefined} {...pendingProps(guild)}>
        {detail ? (
          // Drawn anew per answer: numbers rewritten in place move (A7).
          <div key={guild.dataUpdatedAt} className={own.body}>
            <Body detail={detail} current={data.characterName} />
          </div>
        ) : guild.isPending ? (
          <Panel title="길드원 기준" wide>
            <p className={styles.muted} role="status">
              길드 정보를 불러오고 있어요…
            </p>
          </Panel>
        ) : notObserved ? (
          <Panel title="길드원 기준" wide>
            <p className={styles.muted}>
              최근 {days}일 안에 LOAKraken이 확인한 이 길드의 공개 길드원이 아직 없어요. 길드원을 검색할수록 채워져요.
            </p>
          </Panel>
        ) : (
          <Panel title="길드원 기준" wide>
            <div className={styles.problem}>
              <p>{limit.limited ? countdownText(limit.seconds) : "길드 정보를 불러오지 못했어요."}</p>
              <button type="button" className={styles.textButton} onClick={() => guild.refetch()} disabled={limit.seconds > 0}>
                {retryLabel(limit.seconds)}
              </button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
