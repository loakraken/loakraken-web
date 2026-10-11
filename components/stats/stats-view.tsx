"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { TIER_LABEL } from "@/lib/character/rank";
import { fetchStats } from "@/lib/stats/client";
import {
  fixed,
  percent,
  quantileScale,
  share,
  sampleConditions,
  statsSearch,
  whole,
  type ClassRow,
  type Metric,
  type StatsMeta,
  type StatsQuery,
} from "@/lib/stats/model";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";

const SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
const TABS = [
  { id: "classes", label: "직업" },
  { id: "distribution", label: "분포" },
  { id: "servers", label: "서버" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const WIDTH: Record<Metric, number> = { ITEM_LEVEL: 10, COMBAT_POWER: 100 };
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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
 * Whose numbers these are, before any number (user, 23:23): LOAKraken's
 * observed characters, never the game's population. Conditions under it.
 */
function Notice({ meta }: { meta: StatsMeta }) {
  return (
    <div className={styles.basis} role="note">
      <p>
        <strong>LOAKraken이 확인한 캐릭터 {whole(meta.population)}명 기준</strong>
        <span>(게임 전체 인구 아님)</span>
      </p>
      <p className={styles.notice}>
        {sampleConditions(meta)} · {kst.format(new Date(meta.aggregatedAt))} 집계
        {meta.sampleStatus !== "READY" && ` · 표본 ${meta.minSample}명이 모이면 분포를 보여 드려요`}
      </p>
    </div>
  );
}

function SummaryCards({ query }: { query: StatsQuery }) {
  const summary = useQuery({
    queryKey: ["stats", "summary", query],
    queryFn: ({ signal }) => fetchStats("summary", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const s = summary.data?.data;
  if (summary.isError && !s) return <Problem error={summary.error} onRetry={() => summary.refetch()} />;
  if (!s) return <p className={styles.muted}>통계를 불러오고 있어요…</p>;
  const roles = s.dealers + s.supports;
  // A filter narrower than the sample minimum: the numbers still show, in gray
  // with "참고값" (user 23:50, backend #274); the top 10% stays "-".
  const reference = s.meta.sampleStatus !== "READY";
  return (
    <>
      <Notice meta={s.meta} />
      <dl className={styles.cards} data-reference={reference || undefined}>
        <div>
          <dt>표본</dt>
          <dd>{whole(s.meta.population)}명</dd>
        </div>
        <div>
          <dt>아이템 레벨{reference && <span className={styles.refTag}>참고값</span>}</dt>
          <dd>{fixed(s.itemLevelMean)}</dd>
          <small>중앙값 {fixed(s.itemLevelMedian)}</small>
        </div>
        <div>
          <dt>전투력 중앙값{reference && <span className={styles.refTag}>참고값</span>}</dt>
          <dd>{fixed(s.combatPowerMedian)}</dd>
          <small>상위 10% {fixed(s.combatPowerP90)}</small>
        </div>
        <div>
          <dt>딜러 : 서포터</dt>
          <dd>
            {roles ? `${Math.round((s.dealers / roles) * 100)} : ${Math.round((s.supports / roles) * 100)}` : "-"}
          </dd>
          <small>
            {whole(s.dealers)} : {whole(s.supports)}
            {s.unknownRole > 0 && ` · 미확인 ${whole(s.unknownRole)}`}
          </small>
        </div>
        <div>
          <dt>보석 평균 레벨{reference && <span className={styles.refTag}>참고값</span>}</dt>
          <dd>{fixed(s.gemMeanLevel, 1)}</dd>
          <small>{whole(s.gemSample)}명 기준</small>
        </div>
      </dl>
    </>
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
 * ILOA-style quantile bar: p10–p90 thin line, p25–p75 box, median tick. It
 * grows from the left each time the tab is shown (motion rule 10-10: on every
 * entry, not on in-place updates), 30ms apart up to 8 rows; only the first 12
 * rows move (PM 12-item cap), the rest are simply there.
 */
function Quantiles({ row, scale, index }: { row: ClassRow; scale: ((v: number) => number) | null; index: number }) {
  const p = row.combatPower;
  // Under the sample minimum: the median as a dot only (user, 23:50) — the
  // spread needs the full sample. "표본 N명 · 참고값" says why.
  if (row.sampleStatus !== "READY")
    return (
      <span className={styles.shortCell}>
        {p?.p50 != null && scale ? (
          <span className={styles.quantile} role="img" aria-label={`전투력 중앙값 ${whole(p.p50)} (참고값)`}>
            <em style={{ left: `${scale(p.p50)}%` }} />
          </span>
        ) : null}
        <small>표본 {whole(row.count)}명 · 참고값</small>
      </span>
    );
  if (!p || !scale) return <span className={styles.muted}>-</span>;
  return (
    <span
      className={index < 12 ? `${styles.quantile} k-grow-x` : styles.quantile}
      style={index < 12 ? ({ "--i": index } as CSSProperties) : undefined}
      role="img"
      aria-label={`전투력 하위 10% ${whole(p.p10)}, 중간 50% ${whole(p.p25)}~${whole(p.p75)}, 상위 10% ${whole(p.p90)}`}
    >
      <i style={{ left: `${scale(p.p10)}%`, width: `${scale(p.p90) - scale(p.p10)}%` }} />
      <b style={{ left: `${scale(p.p25)}%`, width: `${Math.max(1, scale(p.p75) - scale(p.p25))}%` }} />
      <em style={{ left: `${scale(p.p50)}%` }} />
    </span>
  );
}

function ClassesTab({ query }: { query: StatsQuery }) {
  const classes = useQuery({
    queryKey: ["stats", "classes", query],
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
    <div>
      <SampleProgress ready={ready} total={rows.length} unit="직업" minSample={minSample} />
      {rows.length > 0 && (
        <DataTable label="직업별 인원과 전투력 분포" className={styles.table}>
          <caption className={styles.srOnly}>직업별 인원과 전투력 분포</caption>
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
                <th scope="row">{row.className}</th>
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
    </div>
  );
}

function DistributionTab({ query }: { query: StatsQuery }) {
  const [metric, setMetric] = useState<Metric>("COMBAT_POWER");
  const [mine, setMine] = useState("");
  const [asTable, setAsTable] = useState(false);
  const value = useDebounced(mine);
  const percentileOf = value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  const dist = useQuery({
    queryKey: ["stats", "distribution", query, metric, percentileOf],
    queryFn: ({ signal }) =>
      fetchStats("distribution", { ...query, metric, width: WIDTH[metric], percentileOf }, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const inputId = useId();
  const data = dist.data?.data;
  const max = Math.max(1, ...(data?.bins.map((b) => b.count) ?? [1]));
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
            inputMode="decimal"
            value={mine}
            onChange={(e) => setMine(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={metric === "ITEM_LEVEL" ? "1720" : "3200"}
          />
        </label>
        <button type="button" className={styles.textButton} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "그래프로 보기" : "표로 보기"}
        </button>
      </div>
      <p className={styles.result} aria-live="polite">
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
        <p className={styles.muted}>분포를 불러오고 있어요…</p>
      ) : asTable ? (
        <DataTable label={`${label} 구간별 인원`} className={styles.table}>
            <caption className={styles.srOnly}>{label} 구간별 인원</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.left}>구간</th>
                <th scope="col">인원</th>
              </tr>
            </thead>
            <tbody>
              {data.bins.map((bin) => (
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
        <ol className={styles.histogram} aria-label={`${label} 구간별 인원`}>
          {data.bins.map((bin, i) => {
            const hit = p && p.value >= bin.from && p.value < bin.to;
            return (
              <li key={bin.from} title={`${fmt(bin.from)} ~ ${fmt(bin.to)} · ${whole(bin.count)}명`} data-hit={hit || undefined}>
                {/* Each bar grows from the axis on every entry (motion rule 10-10). */}
                <i className="k-grow" style={{ height: `${(bin.count / max) * 100}%`, "--i": i } as CSSProperties} />
                <span className={styles.srOnly}>
                  {fmt(bin.from)} ~ {fmt(bin.to)}: {whole(bin.count)}명
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {data && data.bins.length > 0 && (
        <p className={styles.axis} aria-hidden="true">
          <span>{fmt(data.bins[0].from)}</span>
          <span>{fmt(data.bins.at(-1)!.to)}</span>
        </p>
      )}
    </div>
  );
}

function ServersTab({ query }: { query: StatsQuery }) {
  const servers = useQuery({
    queryKey: ["stats", "servers", query],
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
    <div>
      <SampleProgress ready={ready} total={rows.length} unit="서버" minSample={servers.data.data.meta.minSample} />
      {rows.length > 0 && (
      <DataTable label="서버별 인원과 중앙값" className={styles.table}>
          <caption className={styles.srOnly}>서버별 인원과 중앙값</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.left}>서버</th>
              <th scope="col">인원</th>
              <th scope="col">비율</th>
              <th scope="col">아이템 레벨 중앙값</th>
              <th scope="col">전투력 중앙값</th>
              <th scope="col"><span className={styles.srOnly}>표본</span></th>
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
    </div>
  );
}

/**
 * Statistics (B-3): ILOA's summary + class quantile table + distribution and
 * server tabs, LOAWA's filter row. Filters live in the URL (shareable) and
 * apply at once; numbers are debounced.
 */
export function StatsView({ initial, initialTab }: { initial: StatsQuery; initialTab: Tab }) {
  const router = useRouter();
  const [query, setQuery] = useState<StatsQuery>(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  // A menu link to another tab changes the URL without remounting the page:
  // follow it here (remounting replayed every chart twice on a tab click).
  const [urlTab, setUrlTab] = useState<Tab>(initialTab);
  if (initialTab !== urlTab) {
    setUrlTab(initialTab);
    setTab(initialTab);
  }
  const [levelText, setLevelText] = useState(initial.itemLevelMin != null ? String(initial.itemLevelMin) : "");
  const latest = useRef(initial);
  const levelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ids = { server: useId(), role: useId(), days: useId(), level: useId() };

  function apply(next: StatsQuery, nextTab = tab) {
    latest.current = next;
    setQuery(next);
    const params = statsSearch(next);
    if (nextTab !== "classes") params.set("tab", nextTab);
    router.replace(params.size ? `?${params}` : "?", { scroll: false });
  }
  /** Typed levels apply 300 ms after the last keystroke, with the filters current then. */
  function typeLevel(text: string) {
    setLevelText(text);
    clearTimeout(levelTimer.current);
    levelTimer.current = setTimeout(() => {
      const n = text.trim() ? Number(text) : undefined;
      if (n !== undefined && !(Number.isFinite(n) && n >= 0 && n <= 2000)) return;
      if (n !== latest.current.itemLevelMin) apply({ ...latest.current, itemLevelMin: n });
    }, 300);
  }
  useEffect(() => () => clearTimeout(levelTimer.current), []);

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

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="통계 조건">
          <label htmlFor={ids.server}>
            서버
            <select
              id={ids.server}
              value={query.server ?? ""}
              onChange={(e) => apply({ ...query, server: e.target.value || undefined })}
            >
              <option value="">전체</option>
              {SERVERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label htmlFor={ids.role}>
            역할
            <select
              id={ids.role}
              value={query.role ?? ""}
              onChange={(e) => apply({ ...query, role: (e.target.value || undefined) as StatsQuery["role"] })}
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
              onChange={(e) => apply({ ...query, activeDays: Number(e.target.value) as 7 | 30 | 90 })}
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
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={!!query.representativeOnly}
              onChange={(e) => apply({ ...query, representativeOnly: e.target.checked || undefined })}
            />
            원정대 대표 캐릭터만
          </label>
        </form>

        <SummaryCards query={query} />

        <div className={styles.tabs} role="tablist" aria-label="통계 보기">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                apply(query, t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <section role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className={styles.panel}>
          {tab === "classes" ? (
            <ClassesTab query={query} />
          ) : tab === "distribution" ? (
            <DistributionTab query={query} />
          ) : (
            <ServersTab query={query} />
          )}
        </section>
      </main>
    </div>
  );
}

export const STATS_TABS = TABS.map((t) => t.id);
export type StatsTab = Tab;
