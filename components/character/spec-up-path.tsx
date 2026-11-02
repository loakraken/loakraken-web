"use client";
// 추천 순서 (api #794): the first chip of the spec-up list (사용자 결정 layout A,
// 11-02; it was its own section under the list). The backend picks the best
// next step, applies it, measures again, up to 30 steps. Its rows are the
// list's rows — item image, the target opening its detail, a target's later
// steps folded under its first one — with the running 전투력 and 골드 under
// each figure. Asked for while this chip is chosen: each answer is up to a
// thousand simulator runs on the backend (10-minute cache there).
import { Fragment, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { groupStages, koreanGold, tryPathParam } from "@/lib/spec-up/model";
import detail from "./detail.module.css";
import styles from "./spec-up-path.module.css";
import { SpecUpRowDetail } from "./spec-up-detail";
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
      return "캐릭터 정보를 먼저 불러와 주세요. 위의 갱신 버튼으로 정보를 받은 뒤 다시 눌러 주세요.";
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
                <small>
                  <i />
                </small>
              </td>
              <td data-cell="cost" data-label="추가 비용" data-figure="">
                <i />
                <small>
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
  });
  const limit = useRateLimit(path.error, [BUSY]);
  const failure = path.error instanceof SpecUpQueryError ? path.error.info : path.error ? { code: "ERROR" } : null;
  const busy = path.isFetching || limit.seconds > 0;
  const answer = path.data?.data;
  // The skeleton's height stays the floor of the area once the answer is in:
  // a shorter answer does not pull the sections below up (A7).
  const areaRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (floor === null && !answer && areaRef.current) setFloor(areaRef.current.offsetHeight);
  }, [floor, answer]);

  return (
    <div
      ref={areaRef}
      className={styles.result}
      style={floor ? { minHeight: floor } : undefined}
      aria-busy={path.isFetching || undefined}
    >
      <p className={styles.lead}>
        가장 좋은 한 단계를 올리고, 올린 상태에서 다시 재어 다음 단계를 고른 순서예요. 같은 항목의 다음 단계는 그 항목 줄의
        자세히에 모았어요.
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
        <PathAnswer data={data} path={answer} stale={path.isPlaceholderData} />
      ) : (
        <>
          <p className={styles.summary} role="status">
            추천 순서를 계산하고 있어요…
          </p>
          <Skeleton />
        </>
      )}
    </div>
  );
}

function PathAnswer({ data, path, stale }: { data: Character; path: Path; stale: boolean }) {
  const name = data.characterName;
  const [all, setAll] = useState(false);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const steps = path.steps;
  const start = path.combatPower;
  const final = path.finalCombatPower;
  const sim = simulatorPath(steps);
  const simulator = useContext(SimulatorEnabled);
  // Each step as a list row; a target's later steps fold under its first one,
  // which keeps its place in the order (사용자 결정 layout A).
  const { groups, byId } = useMemo(() => {
    const extras = extraCosts(steps);
    const byId = new Map(steps.map((step, i) => [step.candidateId, { step, extra: extras[i] }]));
    return { groups: groupStages(steps.map(stepCandidate)), byId };
  }, [steps]);
  const shown = all ? groups : groups.slice(0, PATH_FIRST_ROWS);

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
            {shown.flatMap((group) => {
              const open = openGroups.has(group.head.id);
              return [group.head, ...group.more].map((c, j) => {
                const sub = j > 0;
                const { step, extra } = byId.get(c.id)!;
                return (
                  <tr key={c.id} data-sub={sub || undefined} data-collapsed={(sub && !open) || undefined}>
                    <td data-cell="rank">{step.order}</td>
                    <td data-cell="kind">{stepKindLabel(c.kind)}</td>
                    <th scope="row" data-cell="target">
                      {/* The target opens the row's detail, as in the list (시세·재료·전후 능력치). */}
                      <SpecUpRowDetail characterName={name} fetchedAt={data.fetchedAt} candidate={c} />
                      {!sub && group.more.length > 0 && (
                        <button
                          type="button"
                          className={`${detail.specUpMore} hit-44`}
                          aria-expanded={open}
                          onClick={() =>
                            setOpenGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.head.id)) next.delete(group.head.id);
                              else next.add(group.head.id);
                              return next;
                            })
                          }
                        >
                          {open ? "다른 단계 접기" : `자세히 · 다른 단계 ${group.more.length}개`}
                        </button>
                      )}
                    </th>
                    <td data-cell="change">
                      {c.from} → {c.to}
                    </td>
                    <td data-cell="gain" data-label="전투력" className={detail.specUpGain} data-figure="">
                      +{two(step.deltaCombatPower)}
                      <small>→ {two(step.combatPowerAfter)}</small>
                    </td>
                    <td data-cell="cost" data-label="추가 비용" data-figure="">
                      {stepGold(extra)}
                      {step.cumulativeCost != null && <small>누적 {koreanGold(step.cumulativeCost)}G</small>}
                    </td>
                    <td data-cell="eff" data-label="1만 골드당" data-figure="">
                      {step.combatPowerPer10kGold == null ? "—" : two(step.combatPowerPer10kGold)}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      {groups.length > PATH_FIRST_ROWS && (
        <button type="button" className={styles.more} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? `앞 ${PATH_FIRST_ROWS}줄만 보기` : `${groups.length}줄 모두 보기`}
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
