"use client";
// 스펙업 목표 (checklist L31, api #455): type a target combat power, get the
// backend's path — spec-up steps in efficiency order, the same item possibly
// several steps up — until the target. Every combat power on it is the
// simulator's; the screen only formats the answer (lib/spec-up/goal.ts).
import { useContext, useId, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RATE_LIMITED, rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import type { Character } from "@/lib/character/model";
import { SpecUpQueryError, fetchSpecUpGoal } from "@/lib/spec-up/client";
import {
  PATH_STOPS,
  parseTarget,
  simulatorPath,
  stepCost,
  stepKindLabel,
  targetError,
  type Goal,
} from "@/lib/spec-up/goal";
import { koreanGold, tryPathParam } from "@/lib/spec-up/model";
import styles from "./spec-up-goal.module.css";
import { SimulatorEnabled } from "./tabs";

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function failureText(code: string | null, limit?: "client") {
  switch (code) {
    case "CHARACTER_NOT_CACHED":
      return "캐릭터 정보를 먼저 불러와 주세요. 위의 갱신 버튼으로 정보를 받은 뒤 다시 찾아 주세요.";
    case "SPEC_UP_GOAL_OUT_OF_RANGE":
      return "목표는 지금 전투력의 2배까지 넣을 수 있어요.";
    case "SPEC_UP_DISABLED":
      return "스펙업 목표는 아직 열리지 않았어요.";
    case RATE_LIMITED:
      return `${rateLimitCopy({ limit }).title}. ${rateLimitCopy({ limit }).text}`;
    default:
      return "경로를 계산하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  }
}

export function SpecUpGoal({ data }: { data: Character }) {
  const name = data.characterName;
  const inputId = useId();
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<number | null>(null);
  const current = data.combatPower ?? null;

  const goal = useQuery({
    queryKey: ["spec-up-goal", name, data.fetchedAt, asked],
    queryFn: ({ signal }) => fetchSpecUpGoal(name, asked!, signal),
    enabled: asked !== null,
    // Same character snapshot and target: the backend caches it for 10 minutes.
    staleTime: 600_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(goal.error);
  const failure = goal.error instanceof SpecUpQueryError ? goal.error.info.code : goal.error ? "ERROR" : null;

  const target = parseTarget(text);
  const error = targetError(target, current);
  const blocked = current == null ? "지금 전투력이 없어 경로를 계산할 수 없어요." : null;
  const busy = goal.isFetching || limit.seconds > 0;
  const blockedId = `${inputId}-blocked`;

  return (
    <section className={styles.goal} aria-labelledby="spec-up-goal">
      <h3 id="spec-up-goal">목표 전투력</h3>
      <p className={styles.lead}>
        목표를 넣으면 효율이 높은 단계부터 차례로 올려, 목표에 닿을 때까지의 단계를 보여 드려요. 같은 항목을 여러 단계
        올릴 수도 있어요.
      </p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (target !== null && !error && !blocked && !busy) setAsked(target);
        }}
      >
        <div className={styles.field}>
          <label htmlFor={inputId}>목표 전투력</label>
          <input
            id={inputId}
            name="goal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={current != null ? `예: ${two(Math.ceil(current + 50))}…` : "예: 2,500…"}
            maxLength={13}
            aria-invalid={!!error}
            aria-describedby={`${inputId}-hint`}
          />
          {/* Always one line high, so a message never moves what follows (A7). */}
          <span id={`${inputId}-hint`} className={styles.hint} role={error ? "alert" : undefined}>
            {error ?? (current != null ? `지금 ${two(current)}` : "")}
          </span>
        </div>
        <button
          type="submit"
          aria-disabled={!!blocked || target === null || !!error || busy || undefined}
          aria-describedby={blocked ? blockedId : undefined}
        >
          {goal.isFetching ? "계산하는 중…" : retryLabel(limit.seconds, "경로 찾기")}
        </button>
      </form>

      <div className={styles.result} aria-live="polite" aria-busy={goal.isFetching || undefined}>
        {failure && !goal.isFetching ? (
          <p className={styles.muted} role="alert">
            {failureText(failure, goal.error instanceof SpecUpQueryError ? goal.error.info.limit : undefined)}
          </p>
        ) : goal.data ? (
          <GoalAnswer name={name} goal={goal.data.data} />
        ) : (
          <p id={blockedId} className={styles.muted}>
            {blocked ?? ""}
          </p>
        )}
      </div>
    </section>
  );
}

function GoalAnswer({ name, goal }: { name: string; goal: Goal }) {
  const steps = goal.steps;
  const known = (PATH_STOPS as readonly string[]).includes(goal.stopReasonCode);
  const final = goal.finalCombatPower;
  const cost = goal.totalCost != null ? `${koreanGold(goal.totalCost)}G` : null;
  const costLine =
    cost ?? (goal.unpricedSteps > 0 ? `미정(비용을 모르는 단계 ${goal.unpricedSteps}개)` : null);
  const path = simulatorPath(steps);
  // The simulator tab exists only with COMBAT_POWER_SIM on (#1260).
  const simulator = useContext(SimulatorEnabled);

  if (goal.stopReasonCode === "ALREADY_REACHED")
    return <p className={styles.summary}>이미 목표 전투력({two(goal.targetCombatPower)}) 이상이에요.</p>;
  // Supporters and unjudged roles: 200 with no steps and the guide's reason (api #455).
  if (!known || final == null)
    return <p className={styles.summary}>{goal.stopReason}</p>;

  return (
    <>
      <p className={styles.summary}>
        {goal.reached ? (
          <>
            <b>{steps.length}단계</b>면 전투력 <b>{two(final)}</b>(목표 {two(goal.targetCombatPower)})
          </>
        ) : (
          <>
            {steps.length}단계까지 올려도 전투력 <b>{two(final)}</b>, 목표까지{" "}
            <b>{two(goal.targetCombatPower - final)}</b> 남아요
          </>
        )}
        {costLine && (
          <>
            {" "}
            · 기대 비용 <b>{costLine}</b>
          </>
        )}
      </p>
      {!goal.reached && <p className={styles.note}>{goal.stopReason}</p>}
      {steps.length > 0 && (
        <ol className={styles.steps} aria-label="효율 순으로 고른 경로">
          {steps.map((step) => (
            <li key={`${step.order}-${step.candidateId}`}>
              <span className={styles.kind}>{stepKindLabel(step.kind)}</span>
              <span className={styles.target}>{step.target}</span>
              <span className={styles.change}>
                {step.from} → {step.to}
              </span>
              <span className={styles.cost}>{stepCost(step, koreanGold, goal.ruleVersion)}</span>
            </li>
          ))}
        </ol>
      )}
      {simulator && steps.length > 0 && (
        <p className={styles.note}>
          {path.changes.length > 0 ? (
            <Link
              href={`/character/${encodeURIComponent(name)}?${new URLSearchParams({ tab: "simulator", try: tryPathParam(path.changes) })}`}
              scroll={false}
            >
              이 경로를 시뮬레이터에서 열기
            </Link>
          ) : (
            <span>이 경로의 단계는 시뮬레이터에서 아직 바꿀 수 없어요.</span>
          )}
          {path.changes.length > 0 && path.skipped > 0 && ` · ${path.skipped}단계는 시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요.`}
        </p>
      )}
      <p className={styles.note}>
        전투력은 단계를 차례로 시뮬레이터에 넣어 계산한 값이에요. 기대 비용은 단계별 기대 비용의 합이에요.
      </p>
    </>
  );
}
