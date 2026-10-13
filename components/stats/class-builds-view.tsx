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
import {
  BUILD_DAYS,
  classBuildsKey,
  classBuildsSearch,
  hiddenText,
  type ClassBuilds,
  type ClassBuildHidden,
  type ClassBuildsQuery,
} from "@/lib/stats/class-builds";
import { fetchClassBuilds } from "@/lib/stats/client";
import { whole } from "@/lib/stats/model";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import own from "./class-builds.module.css";
import { BasisNote } from "./basis-note";

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

type Row = { label: string; count: number; share: number | null };

/** One section: a definition line, share bars and what was hidden. */
function Section({
  title,
  definition,
  rows,
  hidden,
  people,
  note,
  unit = "명",
  wrap = false,
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
}) {
  const hide = hiddenText(hidden, people);
  const headingId = useId();
  return (
    <section className={own.section} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {definition && <p className={own.definition}>{definition}</p>}
      {rows.length ? (
        <ol className={own.bars} data-wrap={wrap || undefined}>
          {rows.map((row) => (
            <li key={row.label}>
              <span className={own.label}>{row.label}</span>
              <span className={own.track} aria-hidden="true">
                <i style={{ transform: `scaleX(${Math.min(100, row.share ?? 0) / 100})` }} />
              </span>
              <b>{percent(row.share)}</b>
              <small>
                {whole(row.count)}
                {unit}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>보여 드릴 칸이 아직 없어요.</p>
      )}
      {(hide || note) && <p className={own.foot}>{[note, hide].filter(Boolean).join(" · ")}</p>}
    </section>
  );
}

const names = (cells: { name: string; count: number; share?: number | null }[] | undefined): Row[] =>
  (cells ?? []).map((cell) => ({ label: cell.name, count: cell.count, share: cell.share ?? null }));
const values = (
  cells: { value: number; count: number; share?: number | null }[] | undefined,
  label: (value: number) => string,
): Row[] => (cells ?? []).map((cell) => ({ label: label(cell.value), count: cell.count, share: cell.share ?? null }));

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

function Sections({ data }: { data: ClassBuilds }) {
  const d = data.definitions ?? {};
  const ap = data.arkPassivePoints;
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
        rows={names(data.engravings?.cells)}
        hidden={data.engravings?.hidden}
        people={false}
      />
      <Section
        title="주력 전투 특성"
        definition={d.topStats}
        rows={names(data.topStats?.cells)}
        hidden={data.topStats?.hidden}
        people
        note={data.topStats && data.topStats.ties > 0 ? `가장 큰 특성이 둘 이상인 ${whole(data.topStats.ties)}명은 치명→특화→신속→제압→인내→숙련 순으로 골랐어요` : null}
      />
      <Section
        title="아크 패시브 진화"
        definition={d.arkPassivePoints}
        rows={values(ap?.evolution?.cells, (v) => `${whole(v)} 포인트`)}
        hidden={ap?.evolution?.hidden}
        people
      />
      <Section
        title="아크 패시브 깨달음"
        rows={values(ap?.enlightenment?.cells, (v) => `${whole(v)} 포인트`)}
        hidden={ap?.enlightenment?.hidden}
        people
      />
      <Section
        title="아크 패시브 도약"
        rows={values(ap?.leap?.cells, (v) => `${whole(v)} 포인트`)}
        hidden={ap?.leap?.hidden}
        people
      />
      <Section
        title="카드 세트"
        definition={d.cardSets}
        rows={(data.cardSets?.cells ?? []).map((cell) => ({
          label: `${cell.set} ${cell.pieces}세트${cell.awakening != null ? ` · 각성 ${cell.awakening}` : ""}`,
          count: cell.count,
          share: cell.share ?? null,
        }))}
        hidden={data.cardSets?.hidden}
        people
        wrap
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
        rows={names(data.braceletStats?.cells)}
        hidden={data.braceletStats?.hidden}
        people={false}
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
 * 직업 상세 (api #468, checklist M12): one class's builds over LOAKraken's
 * sample — class engravings, engraving sets, engravings, ark passive points,
 * gems, card sets, the main stat and bracelet stats. Every number says its
 * sample; cells too small are hidden and said so (never as people when a
 * character counts in several cells).
 */
export function ClassBuildsView({ initial }: { initial: ClassBuildsQuery }) {
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
  // The filter's sample can be short while the whole class is not (api #468).
  const classEngravingsShown = data?.classEngravingStatus === "READY" && !!data.classEngravings?.cells.length;
  // Another filter's shorter sections keep the room (A7).
  const [sectionsRef, sectionsHeight] = useTallest();

  function apply(patch: Partial<ClassBuildsQuery>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setQuery(next);
    const search = classBuildsSearch(next).toString();
    router.replace(search ? `?${search}` : "?", { scroll: false });
  }
  // The class engravings come from the whole class sample, the same under any filter.
  const engravings = (data?.classEngravings?.cells ?? []).map((cell) => cell.name);

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
          // Drawn anew when what it says changes: text rewritten in place moves (A7).
          <p
            key={`${meta.population}-${data.classPopulation}-${meta.conditions?.itemLevelMin}-${meta.conditions?.activeDays}-${meta.aggregatedAt}`}
            className={styles.notice}
          >
            표본 {whole(meta.population ?? 0)}명(장비를 확인한 캐릭터) · {query.className} 전체 {whole(data.classPopulation)}명 ·
            아이템 레벨 {whole(Number(meta.conditions?.itemLevelMin ?? 1680))} 이상 · 최근 {meta.conditions?.activeDays ?? query.activeDays}일 ·{" "}
            {kst.format(new Date(meta.aggregatedAt))} 기준 · 공식 통계가 아니에요
            {collecting && <strong> · 표본 {whole(meta.minSample)}명이 모이면 보여 드려요</strong>}
          </p>
        )}

        <div ref={sectionsRef} style={sectionsHeight ? { minHeight: sectionsHeight } : undefined} {...pendingProps(builds)}>
          {builds.isError && !data ? (
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
            </div>
          ) : (
            // Drawn anew when an answer lands: counts rewritten in place (right
            // aligned) start elsewhere and count as moving (A7).
            <Sections key={builds.dataUpdatedAt} data={data} />
          )}
        </div>
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
