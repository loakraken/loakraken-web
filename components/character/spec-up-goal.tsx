"use client";
// 스펙업 목표 (checklist L31): type a target combat power, get the path of
// spec-up steps taken in efficiency order. The path's result comes from the
// simulator run on all chosen steps at once (lib/spec-up/goal.ts), never from
// adding single deltas.
import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Character } from "@/lib/character/model";
import { postSimulation } from "@/lib/combat-power/client";
import { fetchSpecUp } from "@/lib/spec-up/client";
import { goalSteps, searchGoal, type GoalResult, type GoalStep } from "@/lib/spec-up/goal";
import { kindLabel, koreanGold, specUpQuery } from "@/lib/spec-up/model";
import styles from "./spec-up-goal.module.css";

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2,500.5" or "2500.5" → 2500.5; null for empty, NaN for anything else. */
export function parsePower(text: string): number | null {
  const plain = text.replace(/[,\s]/g, "");
  if (!plain) return null;
  return /^\d+(\.\d{1,2})?$/.test(plain) ? Number(plain) : Number.NaN;
}

class GoalSimulationError extends Error {}

export function SpecUpGoal({ data }: { data: Character }) {
  const name = data.characterName;
  const inputId = useId();
  const [text, setText] = useState("");
  // Efficiency order is the path's order, whatever the table above is sorted by.
  const list = useQuery({
    queryKey: specUpQuery(name, data.fetchedAt, "EFFICIENCY"),
    queryFn: ({ signal }) => fetchSpecUp(name, "EFFICIENCY", signal),
    staleTime: 60_000,
    refetchOnMount: false,
    retryOnMount: false,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const guide = list.data?.data;
  const current = guide?.combatPower ?? null;
  const steps = guide ? goalSteps(guide.candidates) : [];
  const run = useMutation({
    mutationFn: async (goal: number): Promise<{ goal: number; result: GoalResult; steps: GoalStep[] }> => {
      const result = await searchGoal(steps, current!, goal, async (changes) => {
        const answer = await postSimulation({ characterName: name, changes });
        const after = answer.data.after;
        if (after == null || answer.data.partial) throw new GoalSimulationError("partial");
        return after;
      });
      return { goal, result, steps };
    },
  });

  const goal = parsePower(text);
  const error = goal !== null && Number.isNaN(goal) ? "숫자만 입력해 주세요(소수 둘째 자리까지)." : null;
  const ready = current != null && steps.length > 0;
  const outcome = run.data;
  // Why the path cannot be worked out right now (A21: never a silent dim button).
  const blocked = list.isError
    ? "스펙업 후보를 불러오지 못해 경로를 계산할 수 없어요. 위 목록을 다시 불러온 뒤 시도해 주세요."
    : !guide
      ? "후보를 불러오고 있어요."
      : current == null
        ? "지금 전투력이 없어 경로를 계산할 수 없어요."
        : steps.length === 0
          ? "지금 경로에 넣을 수 있는 후보가 없어요."
          : null;
  const blockedId = `${inputId}-blocked`;

  return (
    <section className={styles.goal} aria-labelledby="spec-up-goal">
      <h3 id="spec-up-goal">목표 전투력</h3>
      <p className={styles.lead}>
        목표를 넣으면 효율이 높은 단계부터 차례로 더해, 목표에 닿을 때까지의 단계를 보여 드려요.
      </p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (goal !== null && !Number.isNaN(goal) && ready && !run.isPending) run.mutate(goal);
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
            maxLength={12}
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
          aria-disabled={!ready || goal === null || !!error || run.isPending || undefined}
          aria-describedby={blocked ? blockedId : undefined}
        >
          {run.isPending ? "계산하는 중…" : "경로 찾기"}
        </button>
      </form>

      <div className={styles.result} aria-live="polite" aria-busy={run.isPending || undefined}>
        {run.isError ? (
          <p className={styles.muted} role="alert">
            {run.error instanceof GoalSimulationError
              ? "고른 단계 중 시뮬레이터가 계산하지 못한 것이 있어요."
              : "경로를 계산하지 못했어요. 잠시 뒤 다시 시도해 주세요."}
          </p>
        ) : outcome ? (
          <GoalAnswer goal={outcome.goal} result={outcome.result} steps={outcome.steps} />
        ) : (
          <p id={blockedId} className={styles.muted}>
            {blocked ?? ""}
          </p>
        )}
      </div>
    </section>
  );
}

function GoalAnswer({ goal, result, steps }: { goal: number; result: GoalResult; steps: GoalStep[] }) {
  if (result.kind === "ALREADY")
    return <p className={styles.summary}>이미 목표 전투력({two(goal)}) 이상이에요.</p>;
  const path = steps.slice(0, result.count);
  return (
    <>
      <p className={styles.summary}>
        {result.kind === "REACHED" ? (
          <>
            <b>{result.count}단계</b>면 전투력 <b>{two(result.power)}</b>(목표 {two(goal)}) · 기대 비용{" "}
            <b>{koreanGold(result.cost)}G</b>
          </>
        ) : (
          <>
            고를 수 있는 {result.count}단계를 모두 해도 전투력 <b>{two(result.power)}</b>, 목표까지{" "}
            <b>{two(goal - result.power)}</b> 남아요 · 기대 비용 <b>{koreanGold(result.cost)}G</b>
          </>
        )}
      </p>
      {path.length > 0 && (
        <ol className={styles.steps} aria-label="효율 순으로 고른 경로">
          {path.map((step) => (
            <li key={step.candidate.id}>
              <span className={styles.kind}>{kindLabel(step.candidate.kind)}</span>
              <span className={styles.target}>{step.candidate.target}</span>
              <span className={styles.change}>
                {step.candidate.from ?? "—"} → {step.candidate.to ?? "—"}
              </span>
              <span className={styles.cost}>{koreanGold(step.cost)}G</span>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.note}>
        전투력은 고른 단계를 한꺼번에 시뮬레이터로 계산한 값이에요. 기대 비용은 단계별 기대 비용의 합이에요.
      </p>
    </>
  );
}
