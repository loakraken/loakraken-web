"use client";
// 추천 순서 (api #794): the first chip of the spec-up list (사용자 결정 layout A,
// 11-02; it was its own section under the list). The backend picks the best
// next step, applies it, measures again, up to 30 steps. Its rows are the
// list's rows — item image, the target opening its detail — one row per step in
// its order (user 11-08: no folding of a target's later steps), with the
// running 전투력 and 골드 under each figure. Asked for while this chip is chosen: each answer is up to a
// thousand simulator runs on the backend (10-minute cache there).
import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RATE_LIMITED, rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import type { Character } from "@/lib/character/model";
import { SpecUpQueryError, fetchSpecUpPath } from "@/lib/spec-up/client";
import { simulatorPath, stepKindLabel } from "@/lib/spec-up/goal";
import {
  PATH_FIRST_ROWS,
  PATH_SORTS,
  extraCosts,
  stepCandidate,
  type PathSort,
  type SpecUpPath as Path,
} from "@/lib/spec-up/path";
import { koreanGold, notCachedText, tryPathParam } from "@/lib/spec-up/model";
import detail from "./detail.module.css";
import styles from "./spec-up-path.module.css";
import { SpecUpRowDetail } from "./spec-up-detail";
import { SpecUpExpired, useMarkExpired } from "./spec-up-expired";
import { SimulatorEnabled } from "./tabs";

const BUSY = "SPEC_UP_BUSY";

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One step's extra gold: 0 or less (a gem whose next level sells for less) adds nothing. */
const stepGold = (amount: number | null) =>
  amount === null ? "비용 미확인" : amount <= 0 ? "추가 비용 없음" : `+${koreanGold(amount)}G`;

function failureText(code: string, limit?: "client") {
  switch (code) {
    case "CHARACTER_NOT_CACHED":
      return notCachedText("다시 계산을 눌러");
    case "SPEC_UP_DISABLED":
      return "추천 순서는 아직 열리지 않았어요.";
    case BUSY:
      return "추천 순서를 찾는 요청이 몰려 지금은 계산하지 못했어요. 잠시 뒤 다시 눌러 주세요.";
    case RATE_LIMITED:
      return `${rateLimitCopy({ limit }).title}. ${rateLimitCopy({ limit }).text}`;
    default:
      return "추천 순서를 계산하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  }
}

/** The table head, the same for the answer and its skeleton (same column widths). */
function Head() {
  return (
    <thead>
      <tr>
        <th scope="col">순서</th>
        <th scope="col">종류</th>
        <th scope="col">대상</th>
        <th scope="col">전 → 후</th>
        <th scope="col">전투력 증가</th>
        <th scope="col">추가 비용</th>
        <th scope="col">1만 골드당 전투력</th>
      </tr>
    </thead>
  );
}

/**
 * Rows at the answer's own height while it is worked out (QA 11-01 P3: at 320
 * on a cold cache the list came ~5 s later and pushed everything below, CLS
 * 0.293). Same cells and sub-lines as a real row, so a phone card is as tall.
 */
function Skeleton() {
  return (
    <div className={detail.tableWrap} aria-hidden="true">
      <table className={`${detail.table} ${detail.specUpTable} ${styles.skeleton}`}>
        <Head />
        <tbody>
          {Array.from({ length: PATH_FIRST_ROWS }, (_, i) => (
            <tr key={i}>
              <td data-cell="rank">{i + 1}</td>
              <td data-cell="kind">
                <i />
              </td>
              <th scope="row" data-cell="target">
                <i />
              </th>
              <td data-cell="change">
                <i />
              </td>
              <td data-cell="gain" data-label="전투력" data-figure="">
                <i />
                <small className={detail.specUpCostTime}>
                  <i />
                </small>
              </td>
              <td data-cell="cost" data-label="추가 비용" data-figure="">
                <i />
                <small className={detail.specUpCostTime}>
                  <i />
                </small>
              </td>
              <td data-cell="eff" data-label="1만 골드당" data-figure="">
                <i />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpecUpPathList({ data, sort }: { data: Character; sort: PathSort }) {
  const name = data.characterName;
  const path = useQuery({
    queryKey: ["spec-up-path", name, data.fetchedAt, sort],
    queryFn: ({ signal }) => fetchSpecUpPath(name, sort, signal),
    // Same snapshot, prices and rule: the backend caches the answer for 10 minutes.
    staleTime: 600_000,
    // Another rule keeps the shown order until the new one arrives (A7).
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    // PM 총괄 11-02: asked only while this chip is shown, one at a time (the query
    // dedupes), and not again within the backend's cache window.
    refetchOnReconnect: false,
  });
  const limit = useRateLimit(path.error, [BUSY]);
  useMarkExpired(path.error);
  const { expired } = useContext(SpecUpExpired);
  const failure = path.error instanceof SpecUpQueryError ? path.error.info : path.error ? { code: "ERROR" } : null;
  const busy = path.isFetching || limit.seconds > 0;
  const answer = path.data?.data;
  // Nothing of the page sits under this area but the footer (목표 전투력 is
  // above it since 11-03, PM 총괄 B): the answer takes its own height, no floor.
  return (
    <section className={styles.result} aria-label="추천 순서" aria-busy={path.isFetching || undefined}>
      <p className={styles.lead}>
        가장 좋은 한 단계를 올리고, 올린 상태에서 다시 재어 다음 단계를 고른 순서예요.
      </p>
      {/* Same scope as the patch note (PM 총괄 11-01): kinds the path cannot take yet. */}
      <p className={styles.lead}>
        보석·재련·상급 재련·품질·각인·완갑·어빌리티 스톤 단계를 다뤄요. 장신구 연마는 비용을 늘 잡을 수 있게 되면 더하고, 깨달음
        카르마는 전투력 계산식이 없어 넣지 않아요.
      </p>
      {failure && !path.isFetching ? (
        <div className={detail.specUpFailure} role="alert">
          <p>{failureText(failure.code, "limit" in failure ? failure.limit : undefined)}</p>
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => !busy && void path.refetch()}
          >
            {retryLabel(limit.seconds, "다시 계산")}
          </button>
        </div>
      ) : answer ? (
        <PathAnswer data={data} path={answer} stale={path.isPlaceholderData || expired} />
      ) : (
        <>
          <p className={styles.summary} role="status">
            추천 순서를 계산하고 있어요…
          </p>
          <Skeleton />
        </>
      )}
    </section>
  );
}

function PathAnswer({ data, path, stale }: { data: Character; path: Path; stale: boolean }) {
  const name = data.characterName;
  const [all, setAll] = useState(false);
  const steps = path.steps;
  const start = path.combatPower;
  const final = path.finalCombatPower;
  const sim = simulatorPath(steps);
  const simulator = useContext(SimulatorEnabled);
  // One list row per step, numbered by its order (user 11-08): a target's later
  // steps keep their own place instead of folding under the first one.
  const rows = useMemo(() => {
    const extras = extraCosts(steps);
    return steps.map((step, i) => ({ step, extra: extras[i], candidate: stepCandidate(step) }));
  }, [steps]);
  const shown = all ? rows : rows.slice(0, PATH_FIRST_ROWS);

  // Supporters, unjudged roles, no official combat power: no steps and the guide's reason.
  // No step but unpriced ones (QA 11-01 P3): the backend's "all picked" sentence read as
  // if the list were done, so the screen says why it is empty instead.
  if (steps.length === 0 || start == null || final == null)
    return (
      <>
        <p className={styles.summary}>
          {steps.length === 0 && path.unpriced.length > 0
            ? `올릴 수 있는 항목 ${path.unpriced.length}개 모두 시세를 몰라 순서를 만들 수 없어요. 시세가 모이면 다시 계산해 주세요.`
            : (path.stopReason ?? "올릴 수 있는 단계를 찾지 못했어요.")}
        </p>
        <Unpriced items={path.unpriced} />
      </>
    );

  return (
    <div data-stale={stale || undefined} className={styles.answer}>
      <p className={styles.summary}>
        <b>{steps.length}단계</b>를 차례로 올리면 전투력 {two(start)} → <b>{two(final)}</b>(+{two(final - start)})
        {" · "}
        합계 <b>{path.totalCost != null ? `${koreanGold(path.totalCost)}G` : "미정"}</b>
        {path.totalCost == null && "(비용을 모르는 단계가 있어요)"}
      </p>
      <p className={styles.note}>
        {/* Codes the screen words itself; any other (NO_CANDIDATE, a new one) reads the backend's sentence. */}
        {path.stopReasonCode === "STEP_LIMIT"
          ? `앞에서부터 ${path.limit}단계까지 보여 드려요.`
          : path.stopReasonCode === "TIME_LIMIT"
            ? "계산 시간이 다 되어 여기까지 골랐어요."
            : path.stopReason}
      </p>
      <div className={detail.tableWrap}>
        <table className={`${detail.table} ${detail.specUpTable}`}>
          <caption className={detail.sr}>
            추천 순서, {PATH_SORTS.find((s) => s.id === path.sort)?.label ?? ""} 기준
          </caption>
          <Head />
          <tbody>
            {shown.map(({ step, extra, candidate: c }) => (
              <tr key={c.id}>
                <td data-cell="rank">{step.order}</td>
                <td data-cell="kind">{stepKindLabel(c.kind)}</td>
                <th scope="row" data-cell="target">
                  {/* The target opens the row's detail, as in the list (시세·재료·전후 능력치). */}
                  <SpecUpRowDetail characterName={name} fetchedAt={data.fetchedAt} candidate={c} />
                </th>
                <td data-cell="change">
                  {c.from} → {c.to}
                </td>
                <td data-cell="gain" data-label="전투력" className={detail.specUpGain} data-figure="">
                  +{two(step.deltaCombatPower)}
                  <small className={detail.specUpCostTime}>→ {two(step.combatPowerAfter)}</small>
                </td>
                <td data-cell="cost" data-label="추가 비용" data-figure="">
                  {stepGold(extra)}
                  {step.cumulativeCost != null && <small className={detail.specUpCostTime}>누적 {koreanGold(step.cumulativeCost)}G</small>}
                </td>
                <td data-cell="eff" data-label="1만 골드당" data-figure="">
                  {step.combatPowerPer10kGold == null ? "—" : two(step.combatPowerPer10kGold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* PM 총괄 11-02: the card opens the candidate as it is now, not after the earlier steps. */}
      <p className={styles.note}>줄을 눌러 보는 자세한 수치는 앞 단계를 올리기 전, 지금 장비 기준이에요.</p>
      {rows.length > PATH_FIRST_ROWS && (
        <button type="button" className={styles.more} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? `앞 ${PATH_FIRST_ROWS}줄만 보기` : `${rows.length}줄 모두 보기`}
        </button>
      )}
      {/* Only where the simulator tab exists (COMBAT_POWER_SIM): with it off the
          link opened a hidden tab and fell back to 전투 (v0.3.4, #1216). */}
      {simulator && (
        <p className={styles.note}>
          {sim.changes.length > 0 ? (
            <Link
              href={`/character/${encodeURIComponent(name)}?${new URLSearchParams({ tab: "simulator", try: tryPathParam(sim.changes) })}`}
              scroll={false}
            >
              이 순서를 시뮬레이터에서 열기
            </Link>
          ) : (
            <span>이 순서의 단계는 시뮬레이터에서 아직 바꿀 수 없어요.</span>
          )}
          {sim.changes.length > 0 && sim.skipped > 0 && ` · ${sim.skipped}단계는 시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요.`}
        </p>
      )}
      <p className={styles.note}>
        전투력은 앞 단계를 모두 올린 상태에서 다시 계산한 값이에요. 비용은 그 단계에서 더 드는 골드이고, 보석은 같은 칸의 앞
        단계 비용을 빼고 셌어요.
      </p>
      <Unpriced items={path.unpriced} />
    </div>
  );
}

function Unpriced({ items }: { items: Path["unpriced"] }) {
  if (items.length === 0) return null;
  return (
    <details className={styles.unpriced}>
      <summary>시세를 몰라 순서에서 뺀 항목 {items.length}개</summary>
      <ul>
        {items.map((item) => (
          <li key={item.candidateId}>
            <span>
              {item.target} ({item.from} → {item.to})
            </span>
            <span className={styles.delta}>지금 기준 +{two(item.deltaCombatPower)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
