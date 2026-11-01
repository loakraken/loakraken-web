"use client";

import { useEffect, useId, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/select";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { pendingProps } from "@/lib/api/pending";
import { fetchStats } from "@/lib/stats/client";
import { sampleConditions, statsKey, whole, type StatsQuery } from "@/lib/stats/model";
import { HelpInfo } from "./basis-note";
import styles from "./stats.module.css";

export const STATS_SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
/** 1,640 is the backend default (sent as nothing); the rest are the usual cuts. */
const LEVELS = [1640, 1660, 1680, 1700, 1710, 1720, 1730, 1740, 1750];
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The level choices, with a level from a shared link that is not one of them. */
function levelItems(level?: number) {
  const levels = level != null && !LEVELS.includes(level) ? [...LEVELS, level].sort((a, b) => a - b) : LEVELS;
  return levels.map((value) => ({ value: value === 1640 ? "" : String(value), label: `${value} 이상` }));
}

/** A typed combat power: empty is "no bound", anything else must be 0..100,000. */
function bound(text: string): number | undefined | null {
  if (!text.trim()) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? n : null;
}

/**
 * The one condition bar over every filtered tab (reference structure, PM 총괄
 * 11-01): 서버 · 역할 · 기간, then 레벨 · 전투력 range · 대표 캐릭터, and the
 * sample line under them. Choices apply at once; typed combat power 400 ms
 * after the last key, with the conditions current then.
 */
export function StatsFilters({ query, apply }: { query: StatsQuery; apply: (next: StatsQuery) => void }) {
  const ids = { server: useId(), role: useId(), days: useId(), level: useId(), power: useId() };
  const [min, setMin] = useState(query.combatPowerMin != null ? String(query.combatPowerMin) : "");
  const [max, setMax] = useState(query.combatPowerMax != null ? String(query.combatPowerMax) : "");
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  }, [query]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function type(which: "min" | "max", raw: string) {
    const text = raw.replace(/\D/g, "");
    const nextMin = which === "min" ? text : min;
    const nextMax = which === "max" ? text : max;
    (which === "min" ? setMin : setMax)(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const lo = bound(nextMin);
      const hi = bound(nextMax);
      if (lo === null || hi === null) return;
      const now = latest.current;
      if (lo !== now.combatPowerMin || hi !== now.combatPowerMax) apply({ ...now, combatPowerMin: lo, combatPowerMax: hi });
    }, 400);
  }

  return (
    <form className={styles.statsBar} onSubmit={(e) => e.preventDefault()} aria-label="통계 조건">
      <div className={styles.barRow}>
        <span className={styles.field}>
          <label htmlFor={ids.server}>서버</label>
          <Select
            id={ids.server}
            value={query.server ?? ""}
            onValueChange={(v) => apply({ ...query, server: v || undefined })}
            items={[{ value: "", label: "전체 서버" }, ...STATS_SERVERS.map((s) => ({ value: s, label: s }))]}
          />
        </span>
        <span className={styles.field}>
          <span id={ids.role}>역할</span>
          <HelpInfo label="역할 설명" title="역할">
            <p>장착한 직업 각인으로 딜러와 서포터를 나눠요. 서포터 직업이라도 딜러 각인이면 딜러로 세요.</p>
          </HelpInfo>
          <SegmentedControl
            aria-labelledby={ids.role}
            orientation="horizontal"
            value={query.role ?? "ALL"}
            onValueChange={(v) => apply({ ...query, role: v === "ALL" ? undefined : (v as StatsQuery["role"]) })}
          >
            <SegmentedItem value="ALL">전체</SegmentedItem>
            <SegmentedItem value="DEALER">딜러</SegmentedItem>
            <SegmentedItem value="SUPPORT">서포터</SegmentedItem>
          </SegmentedControl>
        </span>
        <span className={styles.field}>
          <span id={ids.days}>기간</span>
          <HelpInfo label="기간 설명" title="기간">
            <p>고른 기간 안에 LOAKraken이 정보를 확인한 캐릭터만 세요.</p>
          </HelpInfo>
          <SegmentedControl
            aria-labelledby={ids.days}
            orientation="horizontal"
            value={String(query.activeDays ?? 30)}
            onValueChange={(v) => apply({ ...query, activeDays: Number(v) as 7 | 30 | 90 })}
          >
            {[7, 30, 90].map((d) => (
              <SegmentedItem key={d} value={String(d)}>
                {d}일
              </SegmentedItem>
            ))}
          </SegmentedControl>
        </span>
      </div>
      <div className={styles.barRow}>
        <span className={styles.field}>
          <label htmlFor={ids.level}>레벨</label>
          <Select
            id={ids.level}
            value={query.itemLevelMin == null || query.itemLevelMin === 1640 ? "" : String(query.itemLevelMin)}
            onValueChange={(v) => apply({ ...query, itemLevelMin: v ? Number(v) : undefined })}
            items={levelItems(query.itemLevelMin)}
          />
        </span>
        <span className={styles.field} role="group" aria-labelledby={ids.power}>
          <span id={ids.power}>전투력</span>
          <span className={styles.range}>
            <input
              aria-label="전투력 최소"
              name="combatPowerMin"
              inputMode="numeric"
              autoComplete="off"
              placeholder="최소"
              value={min}
              onChange={(e) => type("min", e.target.value)}
            />
            <span aria-hidden="true">~</span>
            <input
              aria-label="전투력 최대"
              name="combatPowerMax"
              inputMode="numeric"
              autoComplete="off"
              placeholder="최대"
              value={max}
              onChange={(e) => type("max", e.target.value)}
            />
          </span>
        </span>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!!query.representativeOnly}
            onChange={(e) => apply({ ...query, representativeOnly: e.target.checked || undefined })}
          />
          원정대 대표 캐릭터만
        </label>
      </div>
      <SampleLine query={query} />
    </form>
  );
}

/**
 * Whose numbers these are, before any number (user, 23:23): LOAKraken's
 * observed characters, never the game's population, then the sample and the
 * conditions. One line under the bar; it holds its height before the answer.
 */
function SampleLine({ query }: { query: StatsQuery }) {
  const summary = useQuery({
    queryKey: ["stats", "summary", statsKey(query)],
    queryFn: ({ signal }) => fetchStats("summary", query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const meta = summary.data?.data.meta;
  return (
    // Read out when new conditions land: the count says the answer changed (frontend-a11y).
    <p className={styles.sample} role="note" aria-live="polite" {...pendingProps(summary)}>
      {meta ? (
        // Keyed by what it says (A7): see basis-note.tsx.
        <span key={`${meta.population}-${sampleConditions(meta)}-${meta.aggregatedAt}-${meta.sampleStatus}`}>
          <strong>LOAKraken이 확인한 캐릭터 기준</strong> · 표본 <span>{whole(meta.population)}명</span> ·{" "}
          {sampleConditions(meta)} · {kst.format(new Date(meta.aggregatedAt))} 집계
          {meta.sampleStatus !== "READY" && ` · 표본 ${meta.minSample}명이 모이면 분포를 보여 드려요`}
        </span>
      ) : (
        " "
      )}
    </p>
  );
}
