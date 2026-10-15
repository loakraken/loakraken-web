"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { useTallest } from "@/components/ui/use-tallest";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { CloseCircle, TickCircle } from "@/components/ui/icons";
import { DataTable } from "@/components/ui/data-table";
import {
  BUILD_DAYS,
  COMBAT_STATS,
  MAX_FIXES,
  classBuildTopKey,
  classBuildsKey,
  classBuildsSearch,
  fixCount,
  fixItems,
  hasFix,
  hiddenText,
  toggleFix,
  type BuildFix,
  type ClassBuilds,
  type ClassBuildHidden,
  type ClassBuildsQuery,
  type FixItem,
  type FixPoint,
} from "@/lib/stats/class-builds";
import { fetchClassBuilds, fetchClassBuildTop, StatsQueryError } from "@/lib/stats/client";
import { whole } from "@/lib/stats/model";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import own from "./class-builds.module.css";
import { BasisNote } from "./basis-note";
import { BuildCompare } from "./build-compare";

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const percent = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type Row = { label: string; count: number; share: number | null; fix?: FixItem };

/** 고정 (M26 stage 2): what is fixed now and how to change it, shared by every section. */
type Fixing = { fix: BuildFix | undefined; onFix: (item: FixItem) => void };

/** One section: a definition line, share bars and what was hidden; rows that can be fixed are buttons. */
function Section({
  title,
  definition,
  rows,
  hidden,
  people,
  note,
  unit = "명",
  wrap = false,
  fixing,
}: {
  title: string;
  definition?: string;
  rows: Row[];
  hidden?: ClassBuildHidden | null;
  /** Whether a cell counts each character once (then the hidden sum is people). */
  people: boolean;
  note?: string | null;
  unit?: string;
  /** Long names that are the point (engraving sets, card sets) wrap instead of cutting off. */
  wrap?: boolean;
  fixing?: Fixing;
}) {
  const hide = hiddenText(hidden, people);
  const headingId = useId();
  const full = fixCount(fixing?.fix) >= MAX_FIXES;
  const cells = (row: Row) => (
    <>
      <span className={own.label}>
        {row.fix && hasFix(fixing?.fix, row.fix) && <TickCircle size={14} className={own.fixMark} aria-hidden="true" />}
        {row.label}
      </span>
      <span className={own.track} aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.min(100, row.share ?? 0) / 100})` }} />
      </span>
      <b>{percent(row.share)}</b>
      <small>
        {whole(row.count)}
        {unit}
      </small>
    </>
  );
  return (
    <section className={own.section} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {definition && <p className={own.definition}>{definition}</p>}
      {rows.length ? (
        <ol className={own.bars} data-wrap={wrap || undefined} data-fixable={(fixing && rows.some((row) => row.fix)) || undefined}>
          {rows.map((row) => {
            if (!row.fix || !fixing) return <li key={row.label}>{cells(row)}</li>;
            const fixed = hasFix(fixing.fix, row.fix);
            // Past three, an unfixed row cannot be pressed and says why (not by colour alone).
            const blocked = !fixed && full;
            const item = row.fix;
            return (
              <li key={row.label}>
                <button
                  type="button"
                  className={own.fixRow}
                  aria-pressed={fixed}
                  aria-disabled={blocked || undefined}
                  aria-label={`${row.label} 고정${blocked ? " — 고정은 3개까지예요" : ""}`}
                  title={blocked ? "고정은 3개까지예요" : fixed ? "누르면 고정을 풀어요" : "이 세팅을 쓰는 캐릭터만 남겨 다시 세요"}
                  onClick={() => !blocked && fixing.onFix(item)}
                >
                  {cells(row)}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.muted}>보여 드릴 칸이 아직 없어요.</p>
      )}
      {(hide || note) && <p className={own.foot}>{[note, hide].filter(Boolean).join(" · ")}</p>}
    </section>
  );
}

const names = (
  cells: { name: string; count: number; share?: number | null }[] | undefined,
  fix?: (name: string) => FixItem | undefined,
): Row[] => (cells ?? []).map((cell) => ({ label: cell.name, count: cell.count, share: cell.share ?? null, fix: fix?.(cell.name) }));
const values = (
  cells: { value: number; count: number; share?: number | null }[] | undefined,
  label: (value: number) => string,
  fix?: (value: number) => FixItem | undefined,
): Row[] =>
  (cells ?? []).map((cell) => ({ label: label(cell.value), count: cell.count, share: cell.share ?? null, fix: fix?.(cell.value) }));
const isStat = (name: string) => (COMBAT_STATS as readonly string[]).includes(name);

/** From the whole class sample whatever the filter, so it stands even when the filter's sample is short. */
function ClassEngravings({ data }: { data: ClassBuilds }) {
  return (
    <Section
      title="직업 각인"
      definition={data.definitions?.classEngravings}
      rows={names(data.classEngravings?.cells)}
      hidden={data.classEngravings?.hidden}
      people
    />
  );
}

/** The sections a filter with enough sample shows, by name (Sections below, after 직업 각인). */
const SECTION_NAMES = [
  "각인 조합",
  "각인 채용률",
  "주력 전투 특성",
  "아크 패시브 진화",
  "아크 패시브 깨달음",
  "아크 패시브 도약",
  "카드 세트",
  "피해 증가 보석",
  "재사용 대기시간 감소 보석",
  "팔찌 전투 특성",
] as const;

/**
 * A short sample's room (held at a screen's height) is not left blank: the
 * sections that come once the sample is enough, by name, as quiet cards.
 * Compact, so they fit the held room at 360 without growing it.
 */
function UpcomingSections() {
  return (
    <ul className={own.upcoming} aria-label="표본이 모이면 보여 드릴 항목">
      {SECTION_NAMES.map((name) => (
        <li key={name}>
          <b>{name}</b>
          <small>표본이 모이면 보여요</small>
        </li>
      ))}
    </ul>
  );
}

function Sections({ data, fixing }: { data: ClassBuilds; fixing: Fixing }) {
  const d = data.definitions ?? {};
  const ap = data.arkPassivePoints;
  const point = (kind: FixPoint) => (value: number) => ({ kind, value }) as FixItem;
  return (
    <div className={own.grid}>
      <ClassEngravings data={data} />
      <Section
        title="각인 조합"
        definition={d.engravingCombos}
        rows={(data.engravingCombos?.cells ?? []).map((cell) => ({
          label: cell.engravings.join(" · "),
          count: cell.count,
          share: cell.share ?? null,
        }))}
        hidden={data.engravingCombos?.hidden}
        people
        wrap
      />
      <Section
        title="각인 채용률"
        definition={d.engravings}
        rows={names(data.engravings?.cells, (value) => ({ kind: "engraving", value }))}
        hidden={data.engravings?.hidden}
        people={false}
        fixing={fixing}
      />
      <Section
        title="주력 전투 특성"
        definition={d.topStats}
        rows={names(data.topStats?.cells, (value) => (isStat(value) ? { kind: "topStat", value } : undefined))}
        fixing={fixing}
        hidden={data.topStats?.hidden}
        people
        note={data.topStats && data.topStats.ties > 0 ? `가장 큰 특성이 둘 이상인 ${whole(data.topStats.ties)}명은 치명→특화→신속→제압→인내→숙련 순으로 골랐어요` : null}
      />
      <Section
        title="아크 패시브 진화"
        definition={d.arkPassivePoints}
        rows={values(ap?.evolution?.cells, (v) => `${whole(v)} 포인트`, point("evolution"))}
        hidden={ap?.evolution?.hidden}
        people
        fixing={fixing}
      />
      <Section
        title="아크 패시브 깨달음"
        rows={values(ap?.enlightenment?.cells, (v) => `${whole(v)} 포인트`, point("enlightenment"))}
        hidden={ap?.enlightenment?.hidden}
        people
        fixing={fixing}
      />
      <Section
        title="아크 패시브 도약"
        rows={values(ap?.leap?.cells, (v) => `${whole(v)} 포인트`, point("leap"))}
        hidden={ap?.leap?.hidden}
        people
        fixing={fixing}
      />
      <Section
        title="카드 세트"
        definition={d.cardSets}
        rows={(data.cardSets?.cells ?? []).map((cell) => ({
          label: `${cell.set} ${cell.pieces}세트${cell.awakening != null ? ` · 각성 ${cell.awakening}` : ""}`,
          count: cell.count,
          share: cell.share ?? null,
          // Fixed by the set's name (any size and awakening), as the backend fixes it.
          fix: { kind: "cardSet", value: cell.set },
        }))}
        hidden={data.cardSets?.hidden}
        people
        wrap
        fixing={fixing}
      />
      <Section
        title="피해 증가 보석"
        definition={d.gems}
        rows={values(data.gems?.damage?.cells, (v) => `${v}레벨`)}
        hidden={data.gems?.damage?.hidden}
        people={false}
        unit="개"
      />
      <Section
        title="재사용 대기시간 감소 보석"
        rows={values(data.gems?.cooldown?.cells, (v) => `${v}레벨`)}
        hidden={data.gems?.cooldown?.hidden}
        people={false}
        unit="개"
      />
      <Section
        title="팔찌 전투 특성"
        definition={d.braceletStats}
        rows={names(data.braceletStats?.cells, (value) => (isStat(value) ? { kind: "bracelet", value } : undefined))}
        hidden={data.braceletStats?.hidden}
        people={false}
        fixing={fixing}
        note={[
          `아이템 레벨 ${whole(Number(data.braceletItemLevelMin))} 이상`,
          data.braceletStats && data.braceletStats.unread > 0 ? `팔찌를 못 읽은 ${whole(data.braceletStats.unread)}명 제외` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    </div>
  );
}

/**
 * What is fixed, each freed on its own, or all at once. One line high from the
 * first paint (a hint when nothing is fixed) and scrolled sideways rather than
 * wrapped, so fixing or freeing never moves the sections under it (A7).
 */
function FixBar({ fixing, onClear, population }: { fixing: Fixing; onClear: () => void; population: number | null }) {
  const items = fixItems(fixing.fix);
  const bar = useRef<HTMLDivElement>(null);
  // The pressed chip goes away: keep the focus in the bar rather than losing it.
  const free = (act: () => void) => {
    act();
    bar.current?.focus({ preventScroll: true });
  };
  return (
    <div ref={bar} className={own.fixBar} role="group" aria-label="고정한 세팅" tabIndex={-1}>
      {/* Drawn anew for each set of fixes: chips sliding over to fill a freed
          one's place counted as moving (A7); new chips are just drawn. */}
      <span key={items.map((item) => `${item.kind}-${item.value}`).join("|")} className={own.fixItems}>
        {items.length ? (
          <>
            {items.map((item) => (
              <button
                key={`${item.kind}-${item.value}`}
                type="button"
                className={own.fixChip}
                aria-label={`${item.label} 고정 풀기`}
                onClick={() => free(() => fixing.onFix(item))}
              >
                {item.label}
                <CloseCircle size={14} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className={own.fixClear} onClick={() => free(onClear)}>
              모두 풀기
            </button>
            <span className={own.fixNote}>
              {population != null ? `이 세팅을 쓰는 ${whole(population)}명으로 다시 셌어요` : "이 세팅을 쓰는 캐릭터로 다시 세요"}
              {items.length >= MAX_FIXES ? " · 고정은 3개까지" : ""}
            </span>
          </>
        ) : (
          <span className={own.fixHint}>세팅을 누르면 그 세팅을 쓰는 캐릭터만 남겨 다시 세요(3개까지)</span>
        )}
      </span>
    </div>
  );
}

const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

/**
 * 이 세팅을 쓰는 상위 30명 (api #503): the highest observed combat power among
 * the characters the conditions and fixes keep. Held at its tallest, redrawn
 * per answer, so another fix's list lands without moving the page (A7).
 */
function TopCharacters({ query }: { query: ClassBuildsQuery }) {
  const top = useQuery({
    queryKey: classBuildTopKey(query),
    queryFn: ({ signal }) => fetchClassBuildTop(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const [ref, height] = useTallest();
  const data = top.data?.data;
  const headingId = useId();
  return (
    <section className={own.top} aria-labelledby={headingId}>
      <h2 id={headingId}>이 세팅을 쓰는 상위 30명</h2>
      <p className={own.definition}>
        조건{fixCount(query.fix) ? "과 고정한 세팅" : ""}에 맞는 캐릭터를 LOAKraken이 마지막으로 확인한 전투력 높은 순으로 보여 드려요.
      </p>
      <div ref={ref} style={height ? { minHeight: height } : undefined} {...pendingProps(top)}>
        {top.isError && !data ? (
          <p className={styles.muted}>목록을 불러오지 못했어요. 잠시 뒤 새로 고쳐 주세요.</p>
        ) : !data ? (
          <p className={styles.muted} role="status">
            목록을 불러오고 있어요…
          </p>
        ) : data.meta.sampleStatus === "COLLECTING" || !data.rows.length ? (
          <p key={top.dataUpdatedAt} className={styles.muted}>
            이 조건의 캐릭터가 {whole(data.meta.minSample)}명보다 적어 목록을 보여 드리지 않아요.
          </p>
        ) : (
          <DataTable label="이 세팅을 쓰는 상위 30명" className={own.topTable}>
            <colgroup>
              <col style={{ width: "3em" }} />
              <col />
              <col style={{ width: "6em" }} />
              <col style={{ width: "6.5em" }} />
              <col style={{ width: "7.5em" }} />
              <col style={{ width: "4.5em" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col" className={own.left}>
                  캐릭터
                </th>
                <th scope="col" className={own.left}>
                  서버
                </th>
                <th scope="col">아이템 레벨</th>
                <th scope="col">전투력</th>
                <th scope="col">확인</th>
              </tr>
            </thead>
            <tbody key={top.dataUpdatedAt}>
              {data.rows.map((row) => (
                <tr key={`${row.rank}-${row.characterName}`}>
                  <td>{row.rank}</td>
                  <th scope="row" className={own.left}>
                    <Link href={`/character/${encodeURIComponent(row.characterName)}`}>{row.characterName}</Link>
                  </th>
                  <td className={own.left}>{row.serverName}</td>
                  <td>{row.itemLevel.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>{row.combatPower.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</td>
                  <td>{row.observedAt ? day.format(new Date(row.observedAt)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </section>
  );
}

/**
 * 직업 상세 (api #468, checklist M12): one class's builds over LOAKraken's
 * sample — class engravings, engraving sets, engravings, ark passive points,
 * gems, card sets, the main stat and bracelet stats. Every number says its
 * sample; cells too small are hidden and said so (never as people when a
 * character counts in several cells).
 */
export function ClassBuildsView({
  initial,
  compare,
  compareMissing = false,
}: {
  initial: ClassBuildsQuery;
  /** 대세 빌드 비교 (M26): this character's setting beside the most chosen ones. */
  compare?: string | null;
  /** The server already found no record of that character (not asked again). */
  compareMissing?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<ClassBuildsQuery>(initial);
  const latest = useRef(initial);
  const builds = useQuery({
    queryKey: classBuildsKey(query),
    queryFn: ({ signal }) => fetchClassBuilds(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(builds.error);
  const data = builds.data?.data;
  const meta = data?.meta;
  const collecting = meta?.sampleStatus === "COLLECTING";
  // Whether the first answer (in the first HTML) was a short sample: only then
  // is there no tallest height yet to hold the sections' room.
  const [startedShort] = useState(collecting);
  // The filter's sample can be short while the whole class is not (api #468).
  const classEngravingsShown = data?.classEngravingStatus === "READY" && !!data.classEngravings?.cells.length;
  // Another filter's shorter sections keep the room (A7).
  const [sectionsRef, sectionsHeight] = useTallest();
  // The comparison keeps its tallest too: another filter may list fewer rows.
  const [compareRef, compareHeight] = useTallest();
  const [noticeRef, noticeHeight] = useTallest();

  function apply(patch: Partial<ClassBuildsQuery>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setQuery(next);
    const params = classBuildsSearch(next);
    // The comparison stays on while the filters change.
    if (compare) params.set("character", compare);
    const search = params.toString();
    router.replace(search ? `?${search}` : "?", { scroll: false });
  }
  // The class engravings come from the whole class sample, the same under any filter.
  const engravings = (data?.classEngravings?.cells ?? []).map((cell) => cell.name);
  // 고정: kept in the address like the filters; no fix left reads as none.
  const fixing: Fixing = {
    fix: query.fix,
    onFix: (item) => {
      const next = toggleFix(latest.current.fix, item);
      apply({ fix: fixCount(next) ? next : undefined });
    },
  };
  // An old link's fix this class's statistics do not have (400): said, with the way out.
  const unknownFix = builds.error instanceof StatsQueryError && builds.error.info.code === "STATS_UNKNOWN_FIX";

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#class-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="class-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="class-heading">
          <p className={styles.kicker}>
            <Link href="/stats">직업 통계</Link>
          </p>
          <h1 id="class-heading">{query.className}</h1>
          <p>LOAKraken이 확인한 {query.className} 캐릭터가 마지막으로 보인 장비로 센 빌드 통계예요.</p>
        </section>

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="직업 통계 조건">
          <span className={styles.segment} role="group" aria-label="직업 각인">
            <button type="button" aria-pressed={!query.classEngraving} onClick={() => apply({ classEngraving: undefined })}>
              전체
            </button>
            {engravings.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={query.classEngraving === name}
                onClick={() => apply({ classEngraving: name })}
              >
                {name}
              </button>
            ))}
          </span>
          <span className={styles.segment} role="group" aria-label="최근 확인">
            {BUILD_DAYS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={query.activeDays === days}
                onClick={() => apply({ activeDays: days })}
              >
                {days}일
              </button>
            ))}
          </span>
        </form>

        {meta && data && (
          // Held at its tallest: another fix's sample count (more or fewer
          // digits) can wrap the line differently on a phone, which moved the
          // fixed settings and the sections under it (A7, #844 CI at 360).
          <div ref={noticeRef} style={noticeHeight ? { minHeight: noticeHeight } : undefined}>
            {/* Drawn anew when what it says changes: text rewritten in place moves (A7). */}
            <p
              key={`${meta.population}-${data.classPopulation}-${meta.conditions?.itemLevelMin}-${meta.conditions?.activeDays}-${meta.aggregatedAt}`}
              className={styles.notice}
            >
              표본 {whole(meta.population ?? 0)}명(장비를 확인한 캐릭터) · {query.className} 전체 {whole(data.classPopulation)}명 ·
              아이템 레벨 {whole(Number(meta.conditions?.itemLevelMin ?? 1680))} 이상 · 최근 {meta.conditions?.activeDays ?? query.activeDays}일 ·{" "}
              {kst.format(new Date(meta.aggregatedAt))} 기준 · 공식 통계가 아니에요
              {collecting && <strong> · 표본 {whole(meta.minSample)}명이 모이면 보여 드려요</strong>}
            </p>
          </div>
        )}

        {/* One room for the comparison whatever the filter: a short sample
            says so inside it, held at the comparison's height, so the
            sections under it do not jump up and back (A7). */}
        {compare && data && (
          <div ref={compareRef} style={compareHeight ? { minHeight: compareHeight } : undefined} {...pendingProps(builds)}>
            {collecting ? (
              <p key={builds.dataUpdatedAt} className={styles.muted}>
                표본이 {whole(meta?.minSample ?? 30)}명보다 적어 대세와 비교하지 않아요.
              </p>
            ) : (
              <BuildCompare
                key={builds.dataUpdatedAt}
                name={compare}
                className={query.className}
                activeDays={query.activeDays}
                missing={compareMissing}
                builds={data}
              />
            )}
          </div>
        )}

        <FixBar fixing={fixing} onClear={() => apply({ fix: undefined })} population={fixCount(query.fix) && meta ? (meta.population ?? null) : null} />

        {/* Opened on a short sample: a screen's height from the first HTML on,
            so the sections another filter brings do not push the visible note
            and footer down (A7). Opened on sections, the tallest height holds. */}
        <div
          ref={sectionsRef}
          className={own.held}
          data-short={startedShort || undefined}
          style={sectionsHeight ? { minHeight: sectionsHeight } : undefined}
          {...pendingProps(builds)}
        >
          {unknownFix ? (
            <div className={styles.problem}>
              <p>고정한 세팅 가운데 지금 이 조건의 통계에 없는 것이 있어요.</p>
              <button type="button" onClick={() => apply({ fix: undefined })}>
                고정 모두 풀기
              </button>
            </div>
          ) : builds.isError && !data ? (
            <div className={styles.problem}>
              <p>{limit.limited ? countdownText(limit.seconds) : "직업 통계를 불러오지 못했어요."}</p>
              <button type="button" onClick={() => builds.refetch()} disabled={limit.seconds > 0}>
                {retryLabel(limit.seconds)}
              </button>
            </div>
          ) : !data ? (
            <p className={styles.muted} role="status">
              직업 통계를 불러오고 있어요…
            </p>
          ) : collecting ? (
            // Drawn anew per answer like the sections (A7).
            <div key={builds.dataUpdatedAt} className={own.collecting}>
              <p className={styles.muted}>
                {!meta?.population
                  ? "아직 이 직업의 표본이 없어요."
                  : query.classEngraving && classEngravingsShown
                    ? `${query.classEngraving} 표본이 아직 ${whole(meta.population)}명이라 항목은 보여 드리지 않아요. 직업 각인 비율은 직업 전체 표본으로 보여 드려요.`
                    : `아직 표본이 ${whole(meta.population)}명이라 보여 드리지 않아요.`}
              </p>
              {classEngravingsShown && (
                <div className={own.grid}>
                  <ClassEngravings data={data} />
                </div>
              )}
              <UpcomingSections />
            </div>
          ) : (
            // Drawn anew when an answer lands: counts rewritten in place (right
            // aligned) start elsewhere and count as moving (A7).
            <Sections key={builds.dataUpdatedAt} data={data} fixing={fixing} />
          )}
        </div>
        {!unknownFix && <TopCharacters query={query} />}
        {meta && data && (
          <BasisNote
            basis={{
              ...meta,
              population: meta.population ?? null,
              unit: "명",
              // Here nothing is shown as a reference value: a short sample shows no sections, a small cell is hidden.
              belowMin: `표본이 ${meta.minSample}명 미만이면 항목을 보여 드리지 않고, 인원(보석은 개수)이 ${data.minCell} 미만인 칸은 숨겨요.`,
            }}
          />
        )}
      </main>
    </div>
  );
}
