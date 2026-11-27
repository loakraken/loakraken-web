"use client";

// M42 (PM 총괄 11-22 14:00; api #1099): 특수 재련 돌파석 1개 가치 on the 재련 계산기, SPECIAL_STONE only. One request
// for the full ranking (전율 무기 · 방어구 × 11~24 = 28 targets, the request maximum) at the page's price basis; the
// pieces in the 목표 단계 card read their own stage from the same answer. Typed prices go as a second request
// (debounced) that the api solves on its user-price seat; the market answer stays for the placeholders and the
// fallback. Every list keeps its rows from the first frame ('—' until the answer), so nothing under it moves (A7).
// The request waits until the section nears the screen (performance first: most visits never scroll here).
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useUrlState } from "@/lib/tools/url-state";
import { retryLabel } from "@/lib/api/rate-limit";
import { priceBases, type PriceBasis } from "@/lib/market/model";
import { RefiningQueryError } from "@/lib/refining/client";
import { formatCount, type PartId, type PartState } from "@/lib/refining/model";
import {
  gradeLabel,
  observedLine,
  overridesFrom,
  parsePriceInput,
  priceEditsCodec,
  PRICE_TEXT_MAX,
  pieceTargets,
  priceFields,
  rankingTargets,
  rankRows,
  rateLabel,
  rowFor,
  rowNote,
  sourceLine,
  specialFailureCopy,
  specialQuery,
  stageLabel,
  stoneLabel,
  targetKey,
  type SpecialPrice,
  type SpecialRow,
} from "@/lib/refining/special";
import quote from "./material-quote.module.css";
import styles from "./refining-special.module.css";

const DASH = "—";
const NBSP = " ";
/** Typed prices wait this long before they are asked for: one request per pause, not per key. */
const EDIT_DEBOUNCE_MS = 600;
/** The market answer is as fresh as the page's price refresh (refining-plan.tsx PRICE_REFRESH_MS). */
const MARKET_STALE_MS = 60_000;

const gold = (value: number | null | undefined, digits = 0) =>
  value == null ? DASH : `${formatCount(value, digits)}${NBSP}G`;
/** Stone values are one decimal (490.4, the contract). */
const stoneGold = (value: number | null | undefined) => gold(value, 1);
/** The full ranking, the same 28 targets every render (one cache key). */
const RANKING = rankingTargets();
const NO_EDITS: Record<string, string> = {};

function useNear<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "400px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return { ref, near };
}

function useDebounced<T>(value: T, key: string, ms: number) {
  const [state, setState] = useState({ value, key });
  useEffect(() => {
    if (key === state.key) return;
    const timer = setTimeout(() => setState({ value, key }), ms);
    return () => clearTimeout(timer);
  }, [value, key, ms, state.key]);
  return state;
}

function detailLine(row: SpecialRow | null) {
  if (!row) return DASH;
  const note = rowNote(row);
  if (note) return note;
  return `평균 ${formatCount(row.averageNeeded ?? 0)}개(1회 ${formatCount(row.perTry ?? 0)}개 ÷ ${rateLabel(row.baseRateBp ?? 0)}) · 일반 재련 기대 ${gold(row.expectedNormalCostGold)}`;
}

export function RefiningSpecial({ parts, basis }: { parts: Record<PartId, PartState>; basis: PriceBasis }) {
  const headingId = useId();
  const { ref, near } = useNear<HTMLElement>();

  const market = useQuery({
    ...specialQuery({ targets: RANKING, priceBasis: basis }),
    enabled: near,
    staleTime: MARKET_STALE_MS,
    placeholderData: keepPreviousData,
  });
  const fields = useMemo(() => priceFields(market.data?.data), [market.data]);

  // Typed prices live in the address like every other input on the page (#889).
  const [edits, setEdits] = useUrlState("stone", NO_EDITS, priceEditsCodec);
  const overrides = overridesFrom(edits, fields);
  const typed = useDebounced<SpecialPrice[]>(overrides, JSON.stringify(overrides), EDIT_DEBOUNCE_MS);
  const custom = useQuery({
    ...specialQuery({ targets: RANKING, priceBasis: basis, prices: typed.value }),
    enabled: near && typed.value.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
  const usingTyped = typed.value.length > 0;
  const customFailed = usingTyped && custom.isError;
  // Typed prices: their answer; while it comes (or if it failed), the market answer, dimmed or with its notice.
  const shownQuery = usingTyped && custom.data && !custom.isError ? custom : market;
  const values = shownQuery.data?.data ?? null;
  const stale =
    (usingTyped && (custom.isFetching || custom.isPlaceholderData)) ||
    typed.key !== JSON.stringify(overrides) ||
    market.isPlaceholderData;

  const failedQuery = customFailed ? custom : market.isError ? market : null;
  const failure =
    failedQuery?.error instanceof RefiningQueryError
      ? failedQuery.error.info
      : failedQuery
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const limit = useRateLimit(failedQuery?.error, ["REFINING_SOLVE_BUSY", "REFINING_PRICE_PENDING"]);
  const failureText = failure ? specialFailureCopy(failure) : null;

  const ranked = values ? rankRows(values.rows) : [];
  const pieces = pieceTargets(parts);
  const best = pieces
    .map(({ part, target }) => ({ part, row: parts[part.id].enabled ? rowFor(values, target) : null }))
    .filter(({ row }) => row?.status === "OK" && row.valuePerStoneGold != null)
    .sort((a, b) => b.row!.valuePerStoneGold! - a.row!.valuePerStoneGold!)[0];

  const [picked, setPicked] = useState<string | null>(null);
  const detailKey = picked ?? (ranked[0] ? targetKey(ranked[0]) : targetKey(RANKING[0]));
  const detail = values?.rows.find((row) => targetKey(row) === detailKey) ?? null;
  const normal = detail?.status === "OK" ? detail.normalTry : null;

  // The basis the shown answer used: while a new basis loads, the kept answer (dimmed) still names its own.
  const basisLabel = priceBases.find((item) => item.value === (values?.priceBasis ?? basis))?.label ?? "";
  const observed = observedLine(values?.pricesObservedAt);
  const statusText = failureText
    ? customFailed && market.data
      ? `${failureText.title}. 바꾼 값 없이 시세로 계산한 값이에요.`
      : failureText.title
    : !values
      ? "돌파석 가치를 계산하고 있어요…"
      : `${basisLabel} 기준${observed ? ` · ${observed}` : ""}${usingTyped ? ` · 바꾼 재료 값 ${formatCount(typed.value.length)}개` : ""}`;

  return (
    <section ref={ref} className={quote.result} aria-labelledby={headingId} aria-busy={stale || undefined}>
      <p className={quote.kicker} id={headingId}>
        특수 재련 돌파석 가치
      </p>
      <p className={quote.hint}>
        돌파석 1개 가치는 그 단계 일반 재련 기대 비용을 특수 재련 평균 필요량(1회 소모량 ÷ 기본 확률)으로 나눈 값이에요.
        특수 재련은 장인의 기운이 쌓이지 않아요. 값이 클수록 그 단계에 돌파석을 쓰는 게 이득이에요.
      </p>
      {/* Always there, two lines held at 320: the state, then where the per-try counts come from. */}
      <div className={styles.state}>
        <p role="status">{statusText}</p>
        <p className={styles.source}>{values ? sourceLine(values.perTrySource) : ""}</p>
      </div>
      {failureText && (failedQuery === market || !market.data) && (
        <div className={quote.notice}>
          <div role="alert">
            <strong>{failureText.title}</strong>
            <p>{failureText.text}</p>
          </div>
          <button
            type="button"
            className={quote.outlinePill}
            aria-disabled={limit.seconds > 0 || undefined}
            onClick={() => limit.seconds === 0 && failedQuery?.refetch()}
          >
            {retryLabel(limit.seconds, "다시 계산")}
          </button>
        </div>
      )}

      <div className={styles.block} data-stale={stale || undefined}>
        <h3 className={styles.title}>부위별 다음 단계</h3>
        <p className={quote.caption}>목표 단계 카드의 현재 단계에서 한 단계 올릴 때의 값이에요.</p>
        <ul className={styles.rows}>
          {pieces.map(({ part, target }) => {
            const state = parts[part.id];
            const row = rowFor(values, target);
            const isBest = !!best && best.part.id === part.id;
            const value = !state.enabled
              ? "계산에서 뺀 부위"
              : !target
                ? state.current >= 25
                  ? "최고 단계"
                  : DASH
                : row?.status === "OK"
                  ? stoneGold(row.valuePerStoneGold)
                  : // Unsourced (업화 · 완갑 · 10) stays '—': the caption under the list says why, and a longer word
                    // arriving with the answer would widen the cell (A7).
                    DASH;
            return (
              <li key={part.id} className={styles.row} data-best={isBest || undefined}>
                <p className={styles.name}>
                  <b>{part.label}</b> {gradeLabel(state.grade)} +{state.current}
                  {target && ` → +${target.fromStage + 1}`}
                  {/* Always there, shown only on the best: appearing with the answer re-wrapped the name at 320. */}
                  <span className={styles.badge} data-on={isBest || undefined}>
                    {" "}
                    가장 이득
                  </span>
                </p>
                <p className={styles.value}>
                  <span className={styles.slot}>{value}</span>
                </p>
              </li>
            );
          })}
        </ul>
        <p className={quote.caption}>
          업화 장비, 완갑, 10단계는 특수 재련 1회 소모량을 확인하고 있어서 아직 값이 없어요.
        </p>
      </div>

      <div className={styles.block} data-stale={stale || undefined}>
        <h3 className={styles.title}>단계별 순위(전율)</h3>
        <ol className={styles.rows}>
          {/* Rows by place, not by stage: a new order rewrites the text in place instead of moving the rows. */}
          {RANKING.map((_, i) => {
            const row = ranked[i] ?? null;
            return (
              <li key={i} className={styles.row}>
                <p className={styles.name}>
                  <span className={styles.place}>{i + 1}</span> {row ? stageLabel(row) : DASH}
                </p>
                <p className={styles.value}>
                  <span className={styles.slot}>{row?.status === "OK" ? stoneGold(row.valuePerStoneGold) : DASH}</span>
                </p>
                <p className={styles.detail}>{detailLine(row)}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={styles.block} data-stale={stale || undefined}>
        <h3 className={styles.title}>1회 일반 재련 내역</h3>
        <div className={styles.pick}>
          <label htmlFor={`${headingId}-stage`}>단계</label>
          <Select
            id={`${headingId}-stage`}
            value={detailKey}
            onValueChange={(key) => setPicked(String(key))}
            items={RANKING.map((target) => ({ value: targetKey(target), label: stageLabel(target) }))}
          />
        </div>
        <dl className={styles.breakdown}>
          {(normal?.materials ?? Array.from({ length: 4 }, () => null)).map((m, i) => (
            <div key={m?.name ?? i}>
              <dt>{m?.name ?? DASH}</dt>
              <dd>{m ? `${formatCount(m.amount)}개 × ${gold(m.unitPriceGold, 2)} = ${gold(m.gold)}` : DASH}</dd>
            </div>
          ))}
          <div>
            <dt>재련 골드</dt>
            <dd>{gold(normal?.refineGold)}</dd>
          </div>
          <div>
            <dt>{normal?.breath?.name ?? "숨결"}</dt>
            <dd>
              {normal
                ? normal.breath
                  ? `최대 ${formatCount(normal.breath.max)}개 × ${gold(normal.breath.unitPriceGold, 2)}`
                  : "쓰지 않는 단계"
                : DASH}
            </dd>
          </div>
          {/* Short values, one per row: a long one wrapped on a phone and grew its row when the answer came (A7). */}
          <div>
            <dt>1회 비용(숨결 없이)</dt>
            <dd>{gold(normal?.costWithoutBreathGold)}</dd>
          </div>
          <div>
            <dt>1회 비용(숨결 최대)</dt>
            <dd>{normal ? (normal.costWithMaxBreathGold != null ? gold(normal.costWithMaxBreathGold) : "쓰지 않는 단계") : DASH}</dd>
          </div>
          <div>
            <dt>일반 재련 기대 비용</dt>
            <dd>{detail?.status === "OK" ? gold(detail.expectedNormalCostGold) : DASH}</dd>
          </div>
          <div>
            <dt>평균 시도</dt>
            <dd>{detail?.status === "OK" ? `${formatCount(detail.expectedNormalAttempts ?? 0, 2)}회` : DASH}</dd>
          </div>
          <div>
            <dt>{detail ? stoneLabel(detail) : "돌파석"} 1개</dt>
            <dd>{detail?.status === "OK" ? stoneGold(detail.valuePerStoneGold) : detail ? (rowNote(detail) ?? DASH) : DASH}</dd>
          </div>
        </dl>
        <p className={quote.caption}>기대 비용은 회차마다 숨결을 쓰는 쪽과 안 쓰는 쪽 중 싼 쪽을 골라 계산해요.</p>
      </div>

      {/* Folded: the field count comes with the answer, so open fields would push what is under them (A7). */}
      <details className={styles.prices}>
        <summary className="hit-44">재료 값 바꾸기</summary>
        <p className={quote.caption}>
          비워 두면 {basisLabel || "시세"}예요. 바꾸면 위 값이 그 값으로 다시 계산돼요. 0~10억 골드, 소수 둘째 자리까지 넣을 수
          있어요.
        </p>
        <ul className={styles.fields}>
          {fields.map((field, i) => {
            const text = edits[field.name] ?? "";
            const invalid = parsePriceInput(text) === null;
            // By place, not by name: a name has spaces, and aria-describedby splits on them.
            const errorId = `${headingId}-price-${i}`;
            return (
              <li key={field.name}>
                <label>
                  <span>{field.name}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={PRICE_TEXT_MAX}
                    name={`stone-price-${i}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={text}
                    placeholder={formatCount(field.market, 2)}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}
                    onChange={(event) => setEdits((prev) => ({ ...prev, [field.name]: event.target.value }))}
                  />
                </label>
                <p id={errorId} className={styles.fieldError}>
                  {invalid ? "0~10억 골드, 소수 둘째 자리까지 넣어 주세요." : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {/* aria-disabled, not disabled: the button keeps focus after it clears the fields. */}
        <button
          type="button"
          className={quote.outlinePill}
          aria-disabled={Object.values(edits).every((text) => text.trim() === "") || undefined}
          onClick={() => setEdits({})}
        >
          시세로 되돌리기
        </button>
      </details>
    </section>
  );
}
