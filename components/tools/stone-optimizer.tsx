"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, Gem, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { formatGold, parseGold } from "@/lib/tools/auction";
import {
  DECREASE_OPTIONS,
  GOAL_PRESETS,
  LINE_NAMES,
  LUCK_QUANTILES,
  MAX_GOALS,
  SLOT_OPTIONS,
  advise,
  chanceOf,
  createSolver,
  encodeMoves,
  formatChance,
  goalFromId,
  goalText,
  isFinished,
  meetsGoal,
  recommendLine,
  replay,
  stonesFor,
  type Advice,
  type Goal,
  type LineIndex,
  type Move,
  type Slots,
  type StoneState,
} from "@/lib/tools/stone";
import quote from "./material-quote.module.css";
import styles from "./stone-optimizer.module.css";

const LINES = [0, 1, 2] as const;

// One name, ties going to the lower line (same rule as the recommendation card).
const bestNames = (advice: Advice) => {
  const line = recommendLine(advice).line;
  return line === null ? null : LINE_NAMES[line];
};

function SlotDots({
  slots,
  history,
  line,
}: {
  slots: number;
  history: Move[];
  line: LineIndex;
}) {
  const marks = history.filter((m) => m.line === line).map((m) => m.success);
  const hits = marks.filter(Boolean).length;
  // Shape, not only color: filled = success (or hit on the decrease line),
  // ✕ = failure, empty = still to cut.
  const label = `${line === 2 ? "적중" : "성공"} ${hits}, 실패 ${marks.length - hits}, 남은 칸 ${slots - marks.length}`;
  return (
    <ol className={styles.dots} role="img" aria-label={label} data-line={line}>
      {Array.from({ length: slots }, (_, i) => (
        <li key={i} data-mark={i < marks.length ? (marks[i] ? "hit" : "miss") : undefined}>
          {i < marks.length && !marks[i] && <span aria-hidden="true">✕</span>}
        </li>
      ))}
    </ol>
  );
}

function LineRow({
  line,
  slots,
  state,
  moves,
  advice,
  recommended,
  decreaseMax,
  onMove,
}: {
  line: LineIndex;
  slots: number;
  state: StoneState;
  moves: Move[];
  advice: Advice[];
  recommended: boolean;
  decreaseMax: number | null;
  onMove: (move: Move) => void;
}) {
  const left = slots - state.used[line];
  const full = left === 0;
  const name = LINE_NAMES[line];
  const decrease = line === 2;
  const first = advice[0];
  const firstValue = first?.perLine[line] ?? null;
  return (
    <li
      className={styles.line}
      data-kind={decrease ? "decrease" : "increase"}
      data-recommended={recommended || undefined}
    >
      {/* Remounts when the recommendation moves here: one soft glow. */}
      {recommended && <span key={`glow-${line}`} className={styles.glow} aria-hidden="true" />}
      <div className={styles.lineHead}>
        <strong>
          {decrease && <span aria-hidden="true">↓ </span>}
          {name}
        </strong>
        {decrease && <span className={styles.badgeDanger}>감소</span>}
        {recommended && <span className={styles.badge}>추천</span>}
        <span className={styles.lineMeta}>
          {decrease ? "적중" : "성공"} {state.hits[line]} · 남은 칸 {left}
          {decrease && decreaseMax !== null && ` · ${decreaseMax}회 이하 유지`}
        </span>
        {first && (
          <span className={styles.lineGoal}>
            {first.goal.label} <b>{firstValue === null ? "—" : formatChance(firstValue)}</b>
          </span>
        )}
      </div>
      <SlotDots slots={slots} history={moves} line={line} />
      <ul className={styles.lineChances} aria-label={`${name}을 깎으면 목표 확률`}>
        {advice.map((a, i) => {
          const value = a.perLine[line];
          const best = recommendLine(a).line === line;
          return (
            <li key={a.goal.id} data-best={best || undefined} data-lead={i === 0 || undefined}>
              <span>{a.goal.label}</span>
              <b>{value === null ? "—" : formatChance(value)}</b>
              {best && <em>추천</em>}
            </li>
          );
        })}
      </ul>
      <div className={styles.lineButtons}>
        <button
          type="button"
          className={styles.hit}
          data-primary={recommended || undefined}
          disabled={full}
          aria-label={`${name} 성공`}
          onClick={() => onMove({ line, success: true })}
        >
          성공
        </button>
        <button
          type="button"
          className={styles.miss}
          disabled={full}
          aria-label={`${name} 실패`}
          onClick={() => onMove({ line, success: false })}
        >
          실패
        </button>
      </div>
    </li>
  );
}

function Segmented<T extends string | number | null>({
  legend,
  options,
  value,
  onChange,
  note,
}: {
  legend: string;
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  note?: string;
}) {
  const name = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label
            key={String(option.value)}
            data-checked={option.value === value || undefined}
            title={option.title}
          >
            <input
              type="radio"
              name={name}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </fieldset>
  );
}

function GoalPicker({
  goals,
  setGoals,
}: {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
}) {
  const [a, setA] = useState(8);
  const [b, setB] = useState(6);
  const full = goals.length >= MAX_GOALS;
  const has = (id: string) => goals.some((goal) => goal.id === id);
  const toggle = (goal: Goal) =>
    has(goal.id)
      ? goals.length > 1 && setGoals(goals.filter((g) => g.id !== goal.id))
      : !full && setGoals([...goals, goal]);
  const customs = goals.filter((g) => !GOAL_PRESETS.some((p) => p.id === g.id));
  const values = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div className={styles.goals}>
      <p className={styles.groupLabel} id="goal-label">
        목표 <small>최대 {MAX_GOALS}개 · 증가 두 줄 성공 수, 순서는 상관없어요</small>
      </p>
      <div className={styles.chips} role="group" aria-labelledby="goal-label">
        {[...GOAL_PRESETS, ...customs].map((goal) => {
          const on = has(goal.id);
          return (
            <button
              key={goal.id}
              type="button"
              className={styles.chip}
              aria-pressed={on}
              disabled={(!on && full) || (on && goals.length === 1)}
              onClick={() => toggle(goal)}
              aria-label={`${goal.label} 목표, ${goalText(goal)} 이상`}
            >
              {goal.label}
              <small>{goalText(goal)}</small>
            </button>
          );
        })}
      </div>
      <div className={styles.custom}>
        <label>
          <span>증가 1</span>
          <select value={a} onChange={(e) => setA(Number(e.target.value))}>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>증가 2</span>
          <select value={b} onChange={(e) => setB(Number(e.target.value))}>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={quote.outlinePill}
          disabled={full || has(`x${Math.max(a, b)}-${Math.min(a, b)}`)}
          onClick={() => {
            const goal = goalFromId(`x${Math.max(a, b)}-${Math.min(a, b)}`);
            if (goal && !has(goal.id)) setGoals([...goals, goal]);
          }}
        >
          목표 추가
        </button>
      </div>
    </div>
  );
}

function Needed({ advice, fresh }: { advice: Advice[]; fresh: number[] }) {
  const priceId = useId();
  const [priceText, setPriceText] = useState("");
  const price = parseGold(priceText);
  const usablePrice = price !== null && !Number.isNaN(price) && price > 0 ? price : null;
  return (
    <section className={styles.card} aria-labelledby="needed-heading">
      <h2 id="needed-heading" className={styles.cardTitle}>
        필요한 돌
      </h2>
      <p className={styles.note}>아직 안 깎은 돌 기준 · 지금 조건 그대로</p>
      <table className={styles.needTable}>
        <thead>
          <tr>
            <th scope="col">목표</th>
            {LUCK_QUANTILES.map((q) => (
              <th scope="col" key={q.q} className={styles.num}>
                {q.label}
                <small>{Math.round(q.q * 100)}%</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {advice.map((a, i) => {
            const p = fresh[i];
            return (
              <tr key={a.goal.id}>
                <th scope="row">
                  {a.goal.label}
                  <small>1개당 {formatChance(p)}</small>
                </th>
                {LUCK_QUANTILES.map(({ q }) => {
                  const n = stonesFor(p, q);
                  return (
                    <td key={q} className={styles.num}>
                      {n === null ? "불가능" : `${n.toLocaleString("ko-KR")}개`}
                      {n !== null && usablePrice !== null && (
                        <small>{formatGold(n * usablePrice)}</small>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.priceRow}>
        <label htmlFor={priceId}>돌 1개 가격</label>
        <div className={styles.goldInput}>
          <input
            id={priceId}
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="입력하면 골드 합계도 보여요"
            maxLength={12}
          />
          <em aria-hidden="true">G</em>
        </div>
      </div>
      <p className={styles.note}>
        열 머리의 %는 그 개수 안에 목표를 이룰 확률이에요. 10번 중 9번은
        &lsquo;오래 걸려도&rsquo; 개수 안에 끝나요.
      </p>
    </section>
  );
}

function Basis() {
  return (
    <details className={styles.basis}>
      <summary>계산 기준</summary>
      <ul>
        <li>
          세 줄이 같은 확률을 써요. 75%에서 시작해 성공하면 10%p 내려가고,
          실패하면 10%p 올라가요(25~75%).{" "}
          <a
            href="https://lostark.game.onstove.com/Probability/%EC%96%B4%EB%B9%8C%EB%A6%AC%ED%8B%B0%20%EC%8A%A4%ED%86%A4%20%EC%9E%90%EB%8F%99%20%EC%84%B8%EA%B3%B5"
            target="_blank"
            rel="noreferrer"
          >
            공식 확률표
          </a>
          와 맞춰 확인했어요.
        </li>
        <li>
          확률과 추천은 칸마다 목표 확률이 가장 높은 줄을 직접 골라 깎을 때의
          값이에요. 게임의 자동 세공 기능은 줄을 고르는 방식이 달라 이 계산의
          대상이 아니에요.
        </li>
        <li>
          각인 레벨: 증가는 성공 6·7·9·10회에서 Lv1~4, 감소는 5·7·10회에서
          Lv1~3이에요.
        </li>
        <li>필요한 돌은 새 돌 한 개의 성공 확률로 셈한 개수예요.</li>
        <li>계산은 브라우저에서만 해요.</li>
      </ul>
    </details>
  );
}

export type StoneInitial = {
  slots: Slots;
  decreaseMax: number | null;
  goals: string[];
  moves: Move[];
};

export function StoneOptimizer({ initial }: { initial: StoneInitial }) {
  const [slots, setSlots] = useState<Slots>(initial.slots);
  const [decreaseMax, setDecreaseMax] = useState<number | null>(initial.decreaseMax);
  const [goals, setGoals] = useState<Goal[]>(() =>
    initial.goals.map(goalFromId).filter((g): g is Goal => g !== null),
  );
  const [moves, setMoves] = useState<Move[]>(initial.moves);

  const state = useMemo(() => replay(slots, moves), [slots, moves]);
  const solvers = useMemo(
    () => goals.map((goal) => createSolver(slots, decreaseMax, goal)),
    [goals, slots, decreaseMax],
  );
  const advice = goals.map((goal, i) => advise(solvers[i], goal, state));
  const fresh = solvers.map((solver) => solver.at(replay(slots, [])));
  const done = isFinished(slots, state);
  const last = moves.at(-1);
  // The first goal drives the single recommendation (시안 ①②).
  const lead = advice[0];
  const pick = lead ? recommendLine(lead) : { line: null, tie: false, othersBest: null };
  const reached = lead ? meetsGoal(lead.goal, state.hits[0], state.hits[1]) && lead.chance >= 1 : false;
  const ended = done || !lead || lead.chance <= 0 || reached;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("n", String(slots));
    params.set("dec", decreaseMax === null ? "none" : String(decreaseMax));
    params.set("goals", goals.map((g) => g.id).join(","));
    if (moves.length) params.set("m", encodeMoves(moves));
    window.history.replaceState(null, "", `?${params}`);
  }, [slots, decreaseMax, goals, moves]);

  const restart = (next?: () => void) => {
    next?.();
    setMoves([]);
  };

  const announce = last
    ? `${LINE_NAMES[last.line]} ${last.success ? "성공" : "실패"}. 이번 세공 성공 확률 ${chanceOf(state)}%. ` +
      advice
        .map((a) =>
          done
            ? `${a.goal.label} ${a.chance >= 1 ? "달성" : "실패"}`
            : `${a.goal.label} ${formatChance(a.chance)}${bestNames(a) ? `, 추천 ${bestNames(a)}` : ""}`,
        )
        .join(". ")
    : "";

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#stone-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="stone-main">
        <section className={quote.hero} aria-labelledby="stone-heading">
          <span className={styles.heroIcon} aria-hidden="true">
            <Gem size={18} />
          </span>
          <p className={quote.heroKicker}>강화 계산</p>
          <h1 id="stone-heading">돌파고</h1>
          <p className={quote.heroCopy}>
            어빌리티 스톤, 다음에 어느 줄을 깎을지 바로.
          </p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.columns}>
            <section className={styles.card} aria-labelledby="facet-heading">
              <div className={styles.facetHead}>
                <div>
                  <h2 id="facet-heading" className={styles.cardTitle}>
                    세공
                  </h2>
                  <p className={styles.note}>확률을 계산해 다음에 누를 줄을 추천합니다.</p>
                  <p className={styles.progress}>
                    남은 칸 {slots * 3 - state.used.reduce((sum, u) => sum + u, 0)}
                    /{slots * 3} · 감소{" "}
                    {decreaseMax === null ? "제한 없음" : `${decreaseMax}회 이하`}
                  </p>
                  <a className={styles.jump} href="#goal-heading">
                    조건 바꾸기
                  </a>
                </div>
              </div>

              {lead && !ended && pick.line !== null ? (
                <div className={styles.pick}>
                  <p className={styles.pickLabel}>다음에 깎을 줄</p>
                  <p className={styles.pickLine}>
                    {pick.line + 1}번 · {LINE_NAMES[pick.line]}
                    <span className={styles.badge}>추천</span>
                  </p>
                  <p className={styles.pickWhy}>
                    {lead.goal.label} 달성 확률 <b>{formatChance(lead.perLine[pick.line] ?? 0)}</b>
                    {pick.tie
                      ? " — 두 줄이 같아요, 1번부터"
                      : pick.othersBest !== null && (
                          <>
                            {" "}— 다른 줄을 깎으면 최대 <b>{formatChance(pick.othersBest)}</b>
                          </>
                        )}
                  </p>
                </div>
              ) : lead ? (
                <div className={styles.result} data-result={reached ? "done" : "fail"}>
                  <p className={styles.pickLine}>
                    <span aria-hidden="true">{reached ? "✓" : "✕"} </span>
                    {reached ? `${lead.goal.label} 달성했어요` : `이 돌로는 ${lead.goal.label} 어려워요`}
                  </p>
                  {!reached && (
                    <button type="button" className={quote.outlinePill} onClick={() => restart()}>
                      <RotateCcw size={14} aria-hidden="true" /> 새 돌로 다시
                    </button>
                  )}
                </div>
              ) : null}

              <p className={styles.chanceRow}>
                <span>이번 세공 성공 확률</span>
                <strong>{chanceOf(state)}%</strong>
              </p>

              <ul className={styles.summary}>
                {advice.map((a) => (
                  <li key={a.goal.id} data-zero={a.chance <= 0 || undefined}>
                    <span className={styles.summaryGoal}>
                      {a.goal.label}
                      <small>{goalText(a.goal)}</small>
                    </span>
                    <span className={styles.summaryNext}>
                      {done
                        ? meetsGoal(a.goal, state.hits[0], state.hits[1]) && a.chance >= 1
                          ? "달성했어요"
                          : "이번 돌은 실패"
                        : a.chance <= 0
                          ? "이 돌로는 어려워요"
                          : `다음 줄 · ${bestNames(a)}`}
                    </span>
                    <b>{formatChance(a.chance)}</b>
                  </li>
                ))}
              </ul>

              <ol className={styles.lines}>
                {LINES.map((line) => (
                  <LineRow
                    key={line}
                    line={line}
                    slots={slots}
                    state={state}
                    moves={moves}
                    advice={advice}
                    recommended={!ended && pick.line === line}
                    decreaseMax={decreaseMax}
                    onMove={(move) => setMoves((prev) => [...prev, move])}
                  />
                ))}
              </ol>

              <ul className={styles.legend} aria-label="범례">
                <li><i data-mark="hit" aria-hidden="true" /> 성공(증가)</li>
                <li><i data-mark="hit" data-line="2" aria-hidden="true" /> 적중(감소)</li>
                <li><i data-mark="miss" aria-hidden="true">✕</i> 실패</li>
                <li><i data-mark="row" aria-hidden="true" /> 빨간 줄 = 감소 각인</li>
                <li><span className={styles.badge}>추천</span> 다음에 깎을 줄</li>
              </ul>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={quote.outlinePill}
                  disabled={!moves.length}
                  onClick={() => setMoves((prev) => prev.slice(0, -1))}
                >
                  <Undo2 size={14} aria-hidden="true" /> 되돌리기
                </button>
                <button
                  type="button"
                  className={quote.outlinePill}
                  disabled={!moves.length}
                  onClick={() => restart()}
                >
                  <RotateCcw size={14} aria-hidden="true" /> 새 돌
                </button>
              </div>
              <p className={styles.sr} role="status" aria-live="polite">
                {announce}
              </p>
            </section>

            <div className={styles.side}>
              <section className={styles.card} aria-labelledby="goal-heading">
                <h2 id="goal-heading" className={styles.cardTitle}>
                  조건
                </h2>
                <GoalPicker goals={goals} setGoals={setGoals} />
                <Segmented
                  legend="세공 칸"
                  options={SLOT_OPTIONS.map((n) => ({ value: n, label: `${n}칸` }))}
                  value={slots}
                  onChange={(n) => restart(() => setSlots(n))}
                  note="칸 수를 바꾸면 지금까지 누른 기록이 지워져요."
                />
                <Segmented
                  legend="감소 각인"
                  options={DECREASE_OPTIONS.map((o) => ({
                    value: o.max,
                    label: o.label,
                    title: o.hint || undefined,
                  }))}
                  value={decreaseMax}
                  onChange={setDecreaseMax}
                  note="목표 전체의 공통 조건이에요. 4회 이하면 감소 각인이 붙지 않아요."
                />
              </section>
              <Needed advice={advice} fresh={fresh} />
              <Basis />
            </div>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공식 확률표 기준 · 브라우저 안에서만 계산
      </footer>
    </div>
  );
}
