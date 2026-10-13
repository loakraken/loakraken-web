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
            <dt>아이템 레벨 최고 · 최저</dt>
            <dd>
              {two(summary.itemLevelMax)} · {two(summary.itemLevelMin)}
            </dd>
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
      <Panel title="길드원" wide meta={`아이템 레벨 높은 순 · ${whole(detail.members.length)}명`}>
        <div className={styles.tableWrap}>
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
            <tbody>
              {detail.members.map((member) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
        <h3>{guildName}</h3>
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
