"use client";
// 추천 순서 (api #794, PM 총괄 10-31 18:16): its own section under the spec-up
// list. The backend picks the best next step, applies it, measures again, up
// to 30 steps; a target can come back further down at its next stage, so the
// rows are never grouped. Asked for on a click: each answer is up to a
// thousand simulator runs on the backend (10-minute cache there).
import { useState } from "react";
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
  type PathSort,
  type SpecUpPath as Path,
} from "@/lib/spec-up/path";
import { koreanGold, tryPathParam } from "@/lib/spec-up/model";
import styles from "./spec-up-path.module.css";

const BUSY = "SPEC_UP_BUSY";

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gold = (amount: number | null) => (amount === null ? "비용 미확인" : amount === 0 ? "추가 비용 없음" : `${koreanGold(amount)}G`);

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

export function SpecUpPath({ data }: { data: Character }) {
  const name = data.characterName;
  const [sort, setSort] = useState<PathSort>("EFFICIENCY");
  const [asked, setAsked] = useState(false);

  const path = useQuery({
    queryKey: ["spec-up-path", name, data.fetchedAt, sort],
    queryFn: ({ signal }) => fetchSpecUpPath(name, sort, signal),
    enabled: asked,
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

  return (
    <section className={styles.path} aria-labelledby="spec-up-path">
      <h3 id="spec-up-path">추천 순서</h3>
      <p className={styles.lead}>
        가장 좋은 한 단계를 올리고, 올린 상태에서 다시 재어 다음 단계를 고른 순서예요. 같은 항목이 뒤에서 다음 단계로
        다시 나올 수 있어요.
      </p>
      <div className={styles.bar}>
        <div role="group" aria-label="고르는 기준" className={styles.sorts}>
          {PATH_SORTS.map((item) => (
            <button key={item.id} type="button" aria-pressed={sort === item.id} onClick={() => setSort(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {(!asked || (failure && !path.isFetching)) && (
          <button
            type="button"
            className={styles.ask}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (busy) return;
              if (asked) void path.refetch();
              else setAsked(true);
            }}
          >
            {retryLabel(limit.seconds, asked ? "다시 계산" : "추천 순서 보기")}
          </button>
        )}
      </div>

      <div className={styles.result} aria-live="polite" aria-busy={path.isFetching || undefined}>
        {failure && !path.isFetching ? (
          <p className={styles.muted} role="alert">
            {failureText(failure.code, "limit" in failure ? failure.limit : undefined)}
          </p>
        ) : answer ? (
          <PathAnswer name={name} path={answer} stale={path.isPlaceholderData} />
        ) : path.isFetching ? (
          <p className={styles.muted} role="status">
            추천 순서를 계산하고 있어요…
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PathAnswer({ name, path, stale }: { name: string; path: Path; stale: boolean }) {
  const [all, setAll] = useState(false);
  const steps = path.steps;
  const extras = extraCosts(steps);
  const start = path.combatPower;
  const final = path.finalCombatPower;
  const shown = all ? steps : steps.slice(0, PATH_FIRST_ROWS);
  const sim = simulatorPath(steps);

  // Supporters, unjudged roles, no official combat power: no steps and the guide's reason.
  if (steps.length === 0 || start == null || final == null)
    return (
      <>
        <p className={styles.summary}>{path.stopReason ?? "올릴 수 있는 단계를 찾지 못했어요."}</p>
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
      <ol className={styles.steps} aria-label={`추천 순서, ${PATH_SORTS.find((s) => s.id === path.sort)?.label ?? ""} 기준`}>
        {shown.map((step, i) => (
          <li key={`${step.order}-${step.candidateId}`}>
            <span className={styles.order} aria-hidden="true">
              {step.order}
            </span>
            <span className={styles.what}>
              <span className={styles.kind}>{stepKindLabel(step.kind)}</span> {step.target}
            </span>
            <span className={styles.change}>
              {step.from} → {step.to}
            </span>
            <span className={styles.delta}>
              +{two(step.deltaCombatPower)}
              <span className={styles.sub}>→ {two(step.combatPowerAfter)}</span>
            </span>
            <span className={styles.cost}>
              {extras[i] !== null && extras[i] > 0 ? `+${gold(extras[i])}` : gold(extras[i])}
              {step.cumulativeCost != null && <span className={styles.sub}>누적 {koreanGold(step.cumulativeCost)}G</span>}
            </span>
          </li>
        ))}
      </ol>
      {steps.length > PATH_FIRST_ROWS && (
        <button type="button" className={styles.more} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "앞 10단계만 보기" : `${steps.length}단계 모두 보기`}
        </button>
      )}
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
