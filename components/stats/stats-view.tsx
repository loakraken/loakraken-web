"use client";

import Link from "next/link";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { useTallest } from "@/components/ui/use-tallest";
import { classBuildsPath } from "@/lib/stats/class-builds";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { PillTab, PillTabs, PillTabsPanel } from "@/components/ui/pill-tabs";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { TIER_LABEL } from "@/lib/character/rank";
import { coarsen } from "@/lib/stats/bins";
import {
  fetchBestCombatPower,
  fetchGemLevels,
  fetchLevelCombatPower,
  fetchStats,
  fetchTitleEquip,
  isAbsent,
} from "@/lib/stats/client";
import { gemBinLabel, type GemLevelsEnvelope } from "@/lib/stats/gem-levels";
import gemStyles from "./gem-levels.module.css";
import { LevelCombatPowerChart } from "./level-combat-power-chart";
import { equipShare, titleEquipQuery } from "@/lib/stats/title-equip";
import {
  DISTRIBUTION_WIDTH,
  distributionKey,
  fixed,
  parseDistributionView,
  percent,
  quantileScale,
  share,
  sampleText,
  statsKey,
  statsSearch,
  whole,
  writeDistributionView,
  type QuantileRow,
  type Metric,
  type StatsQuery,
} from "@/lib/stats/model";
import { PopulationTab } from "./population-tab";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { ClassIcon } from "./class-icon";
import { CompositionBlock } from "./composition";
import { BasisNote } from "./basis-note";
import { StatsFilters } from "./stats-filters";
import { rankingColumns } from "./ranking-columns";

// Reference structure (PM 총괄 11-01): 직업 순위 · 분포 · 서버 · 전체 인구, then
// 칭호. 최고 전투력 is a block at the end of 분포 (?tab=best opens 분포).
const TABS = [
  { id: "classes", label: "직업 순위" },
  { id: "distribution", label: "분포" },
  { id: "servers", label: "서버" },
  { id: "population", label: "전체 인구" },
  { id: "titles", label: "칭호" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const quiet = { retry: false, refetchOnWindowFocus: false } as const;

/** Debounced copy of a value (filters typed as numbers, 300 ms). */
function useDebounced<T>(value: T, ms = 300) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

function Problem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const limit = useRateLimit(error);
  return (
    <div className={styles.problem}>
      <p>{limit.limited ? countdownText(limit.seconds) : "통계를 불러오지 못했어요."}</p>
      <button type="button" onClick={onRetry} disabled={limit.seconds > 0}>
        {retryLabel(limit.seconds)}
      </button>
    </div>
  );
}

/**
 * How the numbers are made, right under each tab's own content (QA P2-5): a
 * tab draws it with its answer, so it never sits under the room a taller tab
 * left (the panel keeps the tallest height, A7) and never moves when that
 * answer lands.
 */
function StatsBasis({ query, above }: { query: StatsQuery; above?: number }) {
  const summary = useQuery({
    queryKey: ["stats", "summary", statsKey(query)],
    queryFn: ({ signal }) => fetchStats("summary", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const meta = summary.data?.data.meta;
  if (!meta) return null;
  // Drawn anew per answer, like the cards above (A7) — and per answer of the
  // table above it (`above`), when that one is not redrawn as a whole: its new
  // rows landing before this answer moved the old note with them (titles tab,
  // server change, 0.0033).
  return <BasisNote key={`${summary.dataUpdatedAt}-${above ?? 0}`} basis={meta} stale={summary.isPlaceholderData} />;
}

function SummaryCards({ query }: { query: StatsQuery }) {
  const summary = useQuery({
    queryKey: ["stats", "summary", statsKey(query)],
    queryFn: ({ signal }) => fetchStats("summary", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const s = summary.data?.data;
  if (summary.isError && !s) return <Problem error={summary.error} onRetry={() => summary.refetch()} />;
  if (!s) return <p className={styles.muted}>통계를 불러오고 있어요…</p>;
  const roles = s.dealers + s.supports;
  const dealerShare = roles ? (s.dealers / roles) * 100 : 0;
  // A filter narrower than the sample minimum: the numbers still show, in gray
  // with "참고값" (user 23:50, backend #274); the top 10% stays "-".
  const reference = s.meta.sampleStatus !== "READY";
  return (
    // Drawn anew per answer: numbers and the 참고값 tag rewritten in place
    // moved the cards' text on a server change (0.001~0.0016, A7).
    <dl key={summary.dataUpdatedAt} className={styles.cards} data-reference={reference || undefined} {...pendingProps(summary)}>
      <div>
        <dt>표본</dt>
        <dd>
          <span>{whole(s.meta.population)}</span>
          <span className={styles.unit}>명</span>
        </dd>
        <small>최근 {s.meta.conditions.activeDays}일 안에 확인한 캐릭터</small>
      </div>
      <div>
        <dt>평균 아이템 레벨{reference && <span className={styles.refTag}>참고값</span>}</dt>
        <dd>{fixed(s.itemLevelMean)}</dd>
        <small>중앙값 {fixed(s.itemLevelMedian)}</small>
      </div>
      <div>
        <dt>전투력 중앙값{reference && <span className={styles.refTag}>참고값</span>}</dt>
        <dd>{fixed(s.combatPowerMedian)}</dd>
        <small>상위 10% {fixed(s.combatPowerP90)} 이상</small>
      </div>
      <div>
        <dt>딜러 : 서포터</dt>
        <dd>{roles ? `${share(dealerShare)} : ${share(100 - dealerShare)}` : "-"}</dd>
        {/* Two shares of one bar; the counts are the legend under it. */}
        <span className={styles.roleBar} aria-hidden="true">
          <i style={{ width: `${dealerShare}%` }} />
        </span>
        <small className={styles.roleLegend}>
          <span data-role="dealer">딜러 {whole(s.dealers)}</span>
          <span data-role="support">서포터 {whole(s.supports)}</span>
          {s.unknownRole > 0 && <span>미확인 {whole(s.unknownRole)}</span>}
        </small>
      </div>
      <div>
        <dt>보석 평균 레벨{reference && <span className={styles.refTag}>참고값</span>}</dt>
        <dd>{fixed(s.gemMeanLevel, 2)}</dd>
        <small>4티어 보석, 캐릭터별 평균</small>
      </div>
    </dl>
  );
}

/**
 * One progress line over a table instead of "집계 중" in every row (user,
 * 11:20): how many rows already have the sample minimum. Hidden once all do.
 */
function SampleProgress({ ready, total, unit, minSample }: { ready: number; total: number; unit: string; minSample: number }) {
  if (!total || ready >= total) return null;
  return (
    <div className={styles.progress}>
      <p>
        <b>표본 수집 중</b> · {minSample}명 이상 모인 {unit} {ready}/{total}개
      </p>
      <span
        className={styles.progressBar}
        role="progressbar"
        aria-label={`표본 ${minSample}명 이상 모인 ${unit}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={ready}
        aria-valuetext={`${total}개 중 ${ready}개`}
      >
        <i className="k-grow-x" style={{ width: `${(ready / total) * 100}%` }} />
      </span>
    </div>
  );
}

/**
 * Quantile bar: p10–p90 thin line, p25–p75 box, median tick. It
 * grows from the left the first time its tab is shown on a visit (user report
 * 10-31; back on the tab it stands still), 30ms apart up to 8 rows; only the first 12
 * rows move (PM 12-item cap), the rest are simply there.
 */
function Quantiles({
  row,
  scale,
  index,
  label = "전투력",
  shortNote = "참고값",
}: {
  row: QuantileRow;
  scale: ((v: number) => number) | null;
  index: number;
  /** What the spread is of, read aloud. */
  label?: string;
  /** After "표본 N명" under the minimum; null when no value is shown at all. */
  shortNote?: string | null;
}) {
  const p = row.combatPower;
  // Under the sample minimum: the median as a dot only (user, 23:50) — the
  // spread needs the full sample. "표본 N명 · 참고값" says why.
  if (row.sampleStatus !== "READY")
    return (
      <span className={styles.shortCell}>
        {p?.p50 != null && scale ? (
          <span className={styles.quantile} role="img" aria-label={`${label} 중앙값 ${whole(p.p50)} (참고값)`}>
            <em style={{ left: `${scale(p.p50)}%` }} />
          </span>
        ) : null}
        <small>
          표본 {whole(row.count)}명{shortNote && ` · ${shortNote}`}
        </small>
      </span>
    );
  if (!p || !scale) return <span className={styles.muted}>-</span>;
  return (
    <span
      className={index < 12 ? `${styles.quantile} k-grow-x` : styles.quantile}
      style={index < 12 ? ({ "--i": index } as CSSProperties) : undefined}
      role="img"
      aria-label={`${label} 하위 10% ${whole(p.p10)}, 중간 50% ${whole(p.p25)}~${whole(p.p75)}, 상위 10% ${whole(p.p90)}`}
    >
      <i style={{ left: `${scale(p.p10)}%`, width: `${scale(p.p90) - scale(p.p10)}%` }} />
      <b style={{ left: `${scale(p.p25)}%`, width: `${Math.max(1, scale(p.p75) - scale(p.p25))}%` }} />
      <em style={{ left: `${scale(p.p50)}%` }} />
    </span>
  );
}

// # · 직업 · 인원 · 비율 · 서포터 · 평균 레벨 · 보석 · 전투력 분포 · 중앙값
// 직업 is 10em: the 20px icon + 6px gap and the longest name (디스트로이어) whole.
const CLASS_COLUMNS = rankingColumns([3, 10, 6, 5.5, 5.5, 7, 4.5, 13, 7]);
// 서버 · 인원 · 비율 · 아이템 레벨 중앙값 · 전투력 중앙값 · 표본
const SERVER_COLUMNS = rankingColumns([6.5, 6.5, 5.5, 11, 8.5, 10]);
// # · 직업 · 인원 · 평균 · 최고 전투력 분포 · 중앙값 · 최고
const BEST_COLUMNS = rankingColumns([3, 10, 6, 7.5, 13, 7.5, 7.5]);

function ClassesTab({ query }: { query: StatsQuery }) {
  const classes = useQuery({
    queryKey: ["stats", "classes", statsKey(query)],
    queryFn: ({ signal }) => fetchStats("classes", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  // Every class, in the backend order (user, 23:23: no folded rows).
  const rows = classes.data?.data.rows ?? [];
  const ready = rows.filter((row) => row.sampleStatus === "READY").length;
  if (classes.isError && !classes.data) return <Problem error={classes.error} onRetry={() => classes.refetch()} />;
  if (!classes.data) return <p className={styles.muted}>직업 통계를 불러오고 있어요…</p>;
  const scale = quantileScale(rows);
  const minSample = classes.data.data.meta.minSample;
  return (
    // Fixed column widths, so another server's numbers do not size the
    // columns again (the headings would slide even when drawn anew), and
    // drawn anew per answer (the previous one stays, dimmed, while the next
    // loads) so text rewritten in place does not count as moving (A7, #791).
    <div key={classes.dataUpdatedAt} {...pendingProps(classes)}>
      <SampleProgress ready={ready} total={rows.length} unit="직업" minSample={minSample} />
      {rows.length > 0 && (
        <DataTable label="직업별 인원과 전투력 분포" className={styles.table} {...CLASS_COLUMNS.tableProps}>
          <caption className={styles.srOnly}>직업별 인원과 전투력 분포</caption>
          {CLASS_COLUMNS.colgroup}
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className={styles.left}>직업</th>
              <th scope="col">인원</th>
              <th scope="col">비율</th>
              <th scope="col">서포터</th>
              <th scope="col">평균 레벨</th>
              <th scope="col">보석</th>
              <th scope="col" className={styles.wide}>전투력 분포</th>
              <th scope="col">중앙값</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.className} data-short={row.sampleStatus !== "READY" || undefined}>
                <td>{i + 1}</td>
                <th scope="row">
                  {/* The class page (M12): its builds over the same sample. */}
                  <span className={styles.classCell}>
                    <ClassIcon name={row.className} size={20} />
                    <Link href={classBuildsPath(row.className)} prefetch={false}>
                      {row.className}
                    </Link>
                  </span>
                </th>
                <td>{whole(row.count)}</td>
                <td className={styles.share}>{share(row.share)}</td>
                <td>{row.supports > 0 ? percent(row.supportShare) : "-"}</td>
                <td>{fixed(row.itemLevelMean)}</td>
                <td>{fixed(row.gemMeanLevel, 1)}</td>
                <td className={styles.wide}>
                  <Quantiles row={row} scale={scale} index={i} />
                </td>
                <td>{whole(row.combatPower?.p50)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      <p className={styles.note}>
        분포 막대: 옅은 선 하위 10%~상위 10%, 진한 칸 가운데 50%, 세로선 중앙값. 표본이 {minSample}명 미만인 직업은 분포 대신 중앙값 점만 찍고, 다른 값은 참고값(회색)으로 보여요.
      </p>
      <CompositionBlock rows={rows} composition={classes.data.data.composition} />
      <StatsBasis query={query} />
    </div>
  );
}

function DistributionTab({ query }: { query: StatsQuery }) {
  // Opened from the address (reload, back, a shared link); the page fetched
  // this same view for the first HTML.
  const params = useSearchParams();
  const [opened] = useState(() => parseDistributionView(params));
  const [metric, setMetric] = useState<Metric>(opened.metric);
  const [mine, setMine] = useState(opened.percentileOf != null ? String(opened.percentileOf) : "");
  const [asTable, setAsTable] = useState(opened.asTable);
  const value = useDebounced(mine);
  const percentileOf = value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  // The address follows the choices (a plain replaceState: no server round
  // trip; the filters around it stay).
  useEffect(() => {
    const next = writeDistributionView({ metric, percentileOf, asTable }, new URLSearchParams(window.location.search));
    const search = next.size ? `?${next}` : "";
    if (search !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [metric, percentileOf, asTable]);
  const dist = useQuery({
    queryKey: distributionKey(query, metric, percentileOf),
    queryFn: ({ signal }) =>
      fetchStats("distribution", { ...query, metric, width: DISTRIBUTION_WIDTH[metric], percentileOf }, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const inputId = useId();
  const data = dist.data?.data;
  // A wide sample joins into round widths: at most about 40 bars on a phone (A5).
  const bins = coarsen(data?.bins ?? []);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const label = metric === "ITEM_LEVEL" ? "아이템 레벨" : "전투력";
  const fmt = metric === "ITEM_LEVEL" ? (n: number) => whole(n) : (n: number) => whole(n);
  const p = data?.percentileOf;
  return (
    <div className={styles.dist}>
      <div className={styles.toolbar}>
        <span className={styles.segment} role="group" aria-label="지표">
          {(["COMBAT_POWER", "ITEM_LEVEL"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>
              {m === "ITEM_LEVEL" ? "아이템 레벨" : "전투력"}
            </button>
          ))}
        </span>
        <label htmlFor={inputId} className={styles.lookup}>
          내 {label}
          <input
            id={inputId}
            name="percentileOf"
            inputMode="decimal"
            autoComplete="off"
            value={mine}
            onChange={(e) => setMine(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={metric === "ITEM_LEVEL" ? "1720" : "3200"}
          />
        </label>
        {/* An action named for what it does next (no aria-pressed: "그래프로 보기, 눌림" read the opposite). */}
        <button type="button" className={styles.textButton} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "그래프로 보기" : "표로 보기"}
        </button>
      </div>
      <p className={styles.result} aria-live="polite" {...pendingProps(dist)}>
        {p ? (
          <>
            {label} {fmt(p.value)}은 상위 <strong>{percent(p.topPercent)}</strong>
            {p.tier && TIER_LABEL[p.tier] && <> <b className={styles.tier}>{TIER_LABEL[p.tier]}</b></>} ({whole(p.rank)}위 /{" "}
            {whole(p.total)}명)
          </>
        ) : percentileOf !== undefined && data ? (
          "이 값의 순위를 계산하지 못했어요."
        ) : (
          `${label}을 넣으면 표본 안에서 상위 몇 %인지 알려 드려요.`
        )}
      </p>
      {dist.isError && !data ? (
        <Problem error={dist.error} onRetry={() => dist.refetch()} />
      ) : !data ? (
        <p className={styles.histogramWait} role="status">
          분포를 불러오고 있어요…
        </p>
      ) : asTable ? (
        <DataTable label={`${label} 구간별 인원`} className={styles.table} {...pendingProps(dist)}>
            <caption className={styles.srOnly}>{label} 구간별 인원</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.left}>구간</th>
                <th scope="col">인원</th>
              </tr>
            </thead>
            <tbody key={dist.dataUpdatedAt}>
              {bins.map((bin) => (
                <tr key={bin.from}>
                  <th scope="row">
                    {fmt(bin.from)} ~ {fmt(bin.to)}
                  </th>
                  <td>{whole(bin.count)}</td>
                </tr>
              ))}
            </tbody>
        </DataTable>
      ) : (
        // Drawn anew per answer: another server's bins are other ranges, and
        // the same bar moved across the axis in place (A7, #791).
        <ol key={dist.dataUpdatedAt} className={styles.histogram} aria-label={`${label} 구간별 인원`} {...pendingProps(dist)}>
          {bins.map((bin, i) => {
            const hit = p && p.value >= bin.from && p.value < bin.to;
            return (
              <li key={bin.from} title={`${fmt(bin.from)} ~ ${fmt(bin.to)} · ${whole(bin.count)}명`} data-hit={hit || undefined}>
                {/* Each bar grows from the axis on the tab's first showing (data-drawn after). */}
                <i className="k-grow" style={{ height: `${(bin.count / max) * 100}%`, "--i": i } as CSSProperties} />
                <span className={styles.srOnly}>
                  {fmt(bin.from)} ~ {fmt(bin.to)}: {whole(bin.count)}명
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {/* The axis line is there before the bars too (its height held), so they land without moving the note under it. */}
      {data && bins.length > 0 ? (
        <p className={styles.axis} aria-hidden="true" {...pendingProps(dist)}>
          <span>{fmt(bins[0].from)}</span>
          <span>{fmt(bins.at(-1)!.to)}</span>
        </p>
      ) : (
        !data && !dist.isError && (
          <p className={styles.axis} aria-hidden="true">
            {" "}
          </p>
        )
      )}
      {data && <StatsBasis query={query} />}
      {/* After the main answer (and its basis note above): landing first, they were pushed down by it. */}
      {data && <ExtraCharts query={query} asTable={asTable} />}
    </div>
  );
}

/**
 * The gem and level charts (B2·B3) at the end of the tab, below the basis
 * note, so nothing is under them to push. They wait for both answers and then
 * show at once (one landing after the other would move it). An api without
 * the endpoint (404, before it ships) leaves that chart out with no trace; a
 * real failure shows the retry box in its place (PM-프론트 10-31).
 */
function ExtraCharts({ query, asTable }: { query: StatsQuery; asTable: boolean }) {
  const gems = useQuery({
    queryKey: ["stats", "gem-levels", statsKey(query)],
    queryFn: ({ signal }) => fetchGemLevels(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const levels = useQuery({
    queryKey: ["stats", "level-combat-power", statsKey(query)],
    queryFn: ({ signal }) => fetchLevelCombatPower(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  if (gems.isPending || levels.isPending) return null;
  return (
    <>
      {!isAbsent(gems.error) && <GemLevelsChart gems={gems} asTable={asTable} />}
      {!isAbsent(levels.error) && (
        <LevelCombatPowerChart
          levels={levels}
          asTable={asTable}
          problem={(error, retry) => <Problem error={error} onRetry={retry} />}
        />
      )}
      {/* Last of all: it may land after the charts, with nothing under it. */}
      <BestBlock query={query} />
    </>
  );
}

/**
 * 보석 레벨 분포 (B2): 12 fixed bins of the gem average, as bars or as a
 * table (the same 표로 보기 switch). Only characters whose gems were seen are
 * in it, so the caption names that count.
 */
function GemLevelsChart({ gems, asTable }: { gems: UseQueryResult<GemLevelsEnvelope>; asTable: boolean }) {
  const data = gems.data?.data;
  const label = "보석 평균 레벨 구간별 인원";
  const max = Math.max(1, ...(data?.bins ?? []).map((b) => b.count));
  return (
    // The whole block dims while another filter loads: its caption carries the sample count too.
    <section className={gemStyles.block} aria-labelledby="stats-gem-levels" {...pendingProps(gems)}>
      <h2 id="stats-gem-levels" className={gemStyles.title}>
        보석 레벨 분포
      </h2>
      {!data ? (
        // A real failure (not a missing endpoint): the retry box in the bars' place.
        <div className={styles.histogramWait}>
          <Problem error={gems.error} onRetry={() => gems.refetch()} />
        </div>
      ) : asTable ? (
        <DataTable label={label} className={styles.table} {...pendingProps(gems)}>
          <caption className={styles.srOnly}>{label}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.left}>보석 평균 레벨</th>
              <th scope="col">인원</th>
            </tr>
          </thead>
          <tbody key={gems.dataUpdatedAt}>
            {data.bins.map((bin) => (
              <tr key={gemBinLabel(bin)}>
                <th scope="row">{gemBinLabel(bin)}</th>
                <td>{whole(bin.count)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <ol key={gems.dataUpdatedAt} className={styles.histogram} aria-label={label} {...pendingProps(gems)}>
          {data.bins.map((bin, i) => (
            <li key={gemBinLabel(bin)} title={`${gemBinLabel(bin)} · ${whole(bin.count)}명`}>
              <i className="k-grow" style={{ height: `${(bin.count / max) * 100}%`, "--i": i } as CSSProperties} />
              <span className={styles.srOnly}>
                {gemBinLabel(bin)}: {whole(bin.count)}명
              </span>
            </li>
          ))}
        </ol>
      )}
      {/* Kept on a failure too, so the retry box sits where the bars and axis would. */}
      <p className={styles.axis} aria-hidden="true" {...pendingProps(gems)}>
        <span>{data && !asTable ? gemBinLabel(data.bins[0]) : " "}</span>
        <span>{data && !asTable ? gemBinLabel(data.bins.at(-1)!) : ""}</span>
      </p>
      <p className={styles.note}>
        {data
          ? `보석이 확인된 ${whole(data.gemSample)}명 기준이에요(표본 ${whole(data.meta.population)}명). 4티어 보석 평균 레벨을 0.5 단위로 묶었어요.`
          : " "}
      </p>
    </section>
  );
}

function ServersTab({ query }: { query: StatsQuery }) {
  const servers = useQuery({
    queryKey: ["stats", "servers", statsKey(query)],
    queryFn: ({ signal }) => fetchStats("servers", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  if (servers.isError && !servers.data) return <Problem error={servers.error} onRetry={() => servers.refetch()} />;
  if (!servers.data) return <p className={styles.muted}>서버 통계를 불러오고 있어요…</p>;
  // Every server (user, 23:23: no folded rows).
  const rows = servers.data.data.rows;
  const ready = rows.filter((row) => row.sampleStatus === "READY").length;
  return (
    // Fixed columns and drawn anew per answer, like the class table (A7, #791).
    <div key={servers.dataUpdatedAt} {...pendingProps(servers)}>
      <SampleProgress ready={ready} total={rows.length} unit="서버" minSample={servers.data.data.meta.minSample} />
      {rows.length > 0 && (
      <DataTable label="서버별 인원과 중앙값" className={styles.table} {...SERVER_COLUMNS.tableProps}>
          <caption className={styles.srOnly}>서버별 인원과 중앙값</caption>
          {SERVER_COLUMNS.colgroup}
          <thead>
            <tr>
              <th scope="col" className={styles.left}>서버</th>
              <th scope="col">인원</th>
              <th scope="col">비율</th>
              <th scope="col">아이템 레벨 중앙값</th>
              <th scope="col">전투력 중앙값</th>
              {/* Named by aria-label, not a visually hidden span: positioned
                  out of the flow, that span left the scrolling table box and
                  widened the page at 360 (#811). */}
              <th scope="col" aria-label="표본" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serverName} data-short={row.sampleStatus !== "READY" || undefined}>
                <th scope="row">{row.serverName}</th>
                <td>{whole(row.count)}</td>
                <td className={styles.share}>{share(row.share)}</td>
                {/* Values show from one character up (user, 23:50); a short
                    sample is marked at the row end instead of hidden. */}
                <td>{fixed(row.itemLevelMedian)}</td>
                <td>{fixed(row.combatPowerMedian)}</td>
                <td className={styles.share}>
                  {row.sampleStatus !== "READY" && `표본 ${whole(row.count)}명 · 참고값`}
                </td>
              </tr>
            ))}
          </tbody>
      </DataTable>
    )}
      <StatsBasis query={query} />
    </div>
  );
}

/**
 * 칭호 (api #314, checklist L44): every title seen worn, by how many of the
 * rosters LOAKraken has seen had a character wearing it. Worn only: the
 * official profile does not list titles that are owned but not worn.
 * Server and days apply; role, level and representative do not (said).
 */
// 순위 · 칭호 · 장착 원정대 · 비율
const TITLE_COLUMNS = rankingColumns([3.5, 18, 8, 6.5]);

/**
 * 최고 전투력 (L5): each character's highest combat power over its whole
 * history, overall and per class, over the same sample and filters. A cell
 * under the sample minimum has its count only. A block at the end of 분포
 * since the reference structure (PM 총괄 11-01): nothing under it to push.
 */
function BestBlock({ query }: { query: StatsQuery }) {
  const best = useQuery({
    queryKey: ["stats", "best", statsKey({ ...query, metric: undefined, width: undefined, percentileOf: undefined })],
    queryFn: ({ signal }) => fetchBestCombatPower(query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  if (best.isError && !best.data) return isAbsent(best.error) ? null : <Problem error={best.error} onRetry={() => best.refetch()} />;
  if (!best.data) return null;
  const { meta, overall, classes } = best.data.data;
  const rows = classes.map((row) => ({
    className: row.className,
    count: row.value.count,
    sampleStatus: row.value.sampleStatus,
    combatPower: row.value.percentiles,
    mean: row.value.mean,
    max: row.value.max,
  }));
  const scale = quantileScale(rows);
  const ready = rows.filter((row) => row.sampleStatus === "READY").length;
  const short = overall.sampleStatus !== "READY";
  return (
    <section className={gemStyles.block} aria-labelledby="stats-best" {...pendingProps(best)}>
      <h2 id="stats-best" className={gemStyles.title}>
        최고 전투력 기록
      </h2>
      {/* Drawn anew per answer: numbers rewritten in place move (A7). */}
      <div key={best.dataUpdatedAt}>
        <p className={styles.notice}>
          조건에 맞는 캐릭터 {whole(meta.population)}명 중 최고 전투력 기록이 있는 {whole(overall.count)}명의, LOAKraken이
          확인한 이력에서 가장 높았던 전투력이에요.
          {(query.combatPowerMin != null || query.combatPowerMax != null) && " 전투력 범위 조건은 지금 전투력에 걸려요."}
          {short && ` 표본이 ${meta.minSample}명 미만이라 값은 보여 드리지 않아요.`}
        </p>
        <dl className={styles.bestSummary}>
          {[
            ["평균", overall.mean],
            ["중앙값", overall.percentiles?.p50],
            ["상위 10%", overall.percentiles?.p90],
            ["최고", overall.max],
          ].map(([name, value]) => (
            <div key={name as string}>
              <dt>{name}</dt>
              <dd>{value == null ? "-" : whole(value as number)}</dd>
            </div>
          ))}
        </dl>
        <SampleProgress ready={ready} total={rows.length} unit="직업" minSample={meta.minSample} />
        {rows.length > 0 && (
          <DataTable label="직업별 최고 전투력" className={styles.table} {...BEST_COLUMNS.tableProps}>
            <caption className={styles.srOnly}>직업별 최고 전투력</caption>
            {BEST_COLUMNS.colgroup}
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className={styles.left}>직업</th>
                <th scope="col">인원</th>
                <th scope="col">평균</th>
                <th scope="col" className={styles.wide}>최고 전투력 분포</th>
                <th scope="col">중앙값</th>
                <th scope="col">최고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.className} data-short={row.sampleStatus !== "READY" || undefined}>
                  <td>{i + 1}</td>
                  <th scope="row">
                    <span className={styles.classCell}>
                      <ClassIcon name={row.className} size={20} />
                      {row.className}
                    </span>
                  </th>
                  <td>{whole(row.count)}</td>
                  <td>{whole(row.mean)}</td>
                  <td className={styles.wide}>
                    {/* Under the minimum the backend gives no value: the count only. */}
                    <Quantiles row={row} scale={scale} index={i} label="최고 전투력" shortNote={null} />
                  </td>
                  <td>{whole(row.combatPower?.p50)}</td>
                  <td>{whole(row.max)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
      <p className={styles.note}>
        분포 막대: 옅은 선 하위 10%~상위 10%, 진한 칸 가운데 50%, 세로선 중앙값. 표본이 {meta.minSample}명 미만인 칸은
        인원만 보여요.
      </p>
    </section>
  );
}

function TitlesTab({ query }: { query: StatsQuery }) {
  const titleQuery = titleEquipQuery(query);
  const titles = useQuery({
    queryKey: ["title-equip", titleQuery],
    queryFn: ({ signal }) => fetchTitleEquip(titleQuery, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  if (titles.isError && !titles.data) return <Problem error={titles.error} onRetry={() => titles.refetch()} />;
  if (!titles.data) return <p className={styles.muted}>칭호 통계를 불러오고 있어요…</p>;
  const { meta, titles: rows } = titles.data.data;
  const ready = meta.sampleStatus === "READY";
  return (
    <div {...pendingProps(titles)}>
      {/* Fixed columns and a note of fixed height, drawn anew per answer: a
          server change moves nothing (A7, same as the ranking tables). */}
      <p key={titles.dataUpdatedAt} className={`${styles.notice} ${styles.rankingNotice}`}>
        {sampleText(meta, "roster")} 중 그 칭호를 장착한 캐릭터가 있는 원정대의 비율이에요. 장착하지 않은 칭호는 알 수
        없어 세지 않아요{!ready && ` · 표본 ${meta.minSample}개 원정대 미만이라 참고값`}.
        {(query.role || query.itemLevelMin != null || query.representativeOnly) && " 역할·아이템 레벨·대표 캐릭터 조건은 이 표에 쓰지 않아요."}
      </p>
      {rows.length === 0 ? (
        <p className={styles.muted}>아직 확인한 칭호가 없어요.</p>
      ) : (
        <DataTable label="칭호 장착 원정대 비율" className={styles.table} {...TITLE_COLUMNS.tableProps}>
          <caption className={styles.srOnly}>칭호 장착 원정대 비율</caption>
          {TITLE_COLUMNS.colgroup}
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col" className={styles.left}>칭호</th>
              <th scope="col">장착 원정대</th>
              <th scope="col">비율</th>
            </tr>
          </thead>
          <tbody key={titles.dataUpdatedAt}>
            {rows.map((row, i) => (
              <tr key={row.title}>
                <td>{whole(i + 1)}</td>
                <th scope="row">{row.title}</th>
                <td>{whole(row.equippedRosters)}개</td>
                <td data-strong>{equipShare(row)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      <StatsBasis query={query} above={titles.dataUpdatedAt} />
    </div>
  );
}

/**
 * Statistics (B-3): summary + class quantile table + distribution and
 * server tabs, and a filter row. Filters live in the URL (shareable) and
 * apply at once; numbers are debounced.
 */
export function StatsView({
  initial,
  initialTab,
  titles = true,
  population = false,
}: {
  initial: StatsQuery;
  initialTab: Tab;
  /** TITLE_STATS on this deployment (server flag): the '칭호' tab. */
  titles?: boolean;
  /** POPULATION_STATS on this deployment (server flag): the '전체 인구' tab. */
  population?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<StatsQuery>(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  // A menu link to another tab changes the URL without remounting the page:
  // follow it here (remounting replayed every chart twice on a tab click).
  const [urlTab, setUrlTab] = useState<Tab>(initialTab);
  // Tabs already shown on this visit: their bars come back at rest, not
  // regrown from the axis (user report 10-31: back and forth, every chart
  // shrank and grew again). Marked when left, so the first draw is not cut.
  const [drawn, setDrawn] = useState<ReadonlySet<Tab>>(() => new Set());
  const leave = (from: Tab) => {
    if (!drawn.has(from)) setDrawn(new Set(drawn).add(from));
  };
  if (initialTab !== urlTab) {
    setUrlTab(initialTab);
    leave(tab);
    setTab(initialTab);
  }
  const [panelRef, tallest] = useTallest();

  function apply(next: StatsQuery, nextTab = tab) {
    setQuery(next);
    const params = statsSearch(next);
    if (nextTab !== "classes") params.set("tab", nextTab);
    // A filter changed on the distribution tab keeps its metric, value and view.
    if (nextTab === "distribution")
      writeDistributionView(parseDistributionView(new URLSearchParams(window.location.search)), params);
    router.replace(params.size ? `?${params}` : "?", { scroll: false });
  }
  // 전체 인구 counts every stored character (no filters): no bar, no cards.
  const filtered = tab !== "population";

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#stats-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="stats-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="stats-heading">
          <p className={styles.kicker}>통계</p>
          <h1 id="stats-heading">캐릭터 통계</h1>
          <p>LOAKraken이 확인한 캐릭터로 직업·전투력·서버 분포를 보여줘요.</p>
        </section>

        <PillTabs
          aria-label="통계 보기"
          listClassName={styles.tabs}
          value={tab}
          onValueChange={(next) => {
            if (next !== tab) leave(tab);
            setTab(next as Tab);
            apply(query, next as Tab);
          }}
          panels={
            <PillTabsPanel value={tab} className={styles.panel}>
              <div
                ref={panelRef}
                style={tallest ? { minHeight: tallest } : undefined}
                data-drawn={drawn.has(tab) || undefined}
              >
                {/* Inside the room the panel keeps: on a tab change the bar
                    and cards stay put or leave with the tab's content, so
                    nothing that stays moves (A7). */}
                {filtered && <StatsFilters query={query} apply={(next) => apply(next)} />}
                {filtered && <SummaryCards query={query} />}
                {tab === "classes" ? (
                  <ClassesTab query={query} />
                ) : tab === "distribution" ? (
                  <DistributionTab query={query} />
                ) : tab === "titles" ? (
                  <TitlesTab query={query} />
                ) : tab === "population" ? (
                  <PopulationTab server={query.server} problem={(error, retry) => <Problem error={error} onRetry={retry} />} />
                ) : (
                  <ServersTab query={query} />
                )}
              </div>
            </PillTabsPanel>
          }
        >
          {TABS.filter((t) => (titles || t.id !== "titles") && (population || t.id !== "population")).map((t) => (
            <PillTab key={t.id} value={t.id}>
              {t.label}
            </PillTab>
          ))}
        </PillTabs>
      </main>
    </div>
  );
}

export const STATS_TABS = TABS.map((t) => t.id);
export type StatsTab = Tab;
