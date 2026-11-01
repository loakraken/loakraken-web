"use client";

import { HubTabs } from "@/components/site/hub-tabs";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Setting } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { CharacterQueryError, fetchCharacter } from "@/lib/character/client";
import {
  characterNameError,
  failureCopy,
  normalizeCharacterName,
  type QueryFailure,
} from "@/lib/character/model";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import {
  MAX_PRICE_NAMES,
  formatGold,
  marketFailureCopy,
  priceBases,
  priceUnavailableCopy,
  type MaterialPrice,
  type PriceBasis,
} from "@/lib/market/model";
import { RefiningQueryError, postRefiningPlan } from "@/lib/refining/client";
import { refreshEvery, retryLabel } from "@/lib/api/rate-limit";
import { oneOfCodec, useUrlState, writeUrlParam, type UrlCodec } from "@/lib/tools/url-state";
import { ChangeMark, UpdateAnnouncer, useChangedCells } from "@/components/ui/changed-cells";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import {
  GRADES,
  MAX_STAGE,
  MIN_STAGE,
  minStage,
  isPercent,
  MODES,
  PARTS,
  attemptsAt,
  costLines,
  defaultPart,
  formatCount,
  formatLevel,
  partsFromCharacter,
  refiningFailureCopy,
  requestKey,
  stageGold,
  summarize,
  targetItemLevel,
  toRequest,
  type CostLine,
  type Grade,
  type Mode,
  type Options,
  type PartId,
  type PartPlan,
  type PartState,
} from "@/lib/refining/model";
import quote from "./material-quote.module.css";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import styles from "./refining-plan.module.css";
import { MoreDetail } from "@/components/ui/more-detail";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const initialParts = () =>
  Object.fromEntries(PARTS.map((part) => [part.id, defaultPart()])) as Record<
    PartId,
    PartState
  >;
/** One default, so "unchanged" is the same object and stays out of the address. */
const INITIAL_PARTS = initialParts();
const BOOK_ASSUMPTION =
  "책(야금술·재봉술) 효과가 매번 적용된다고 가정했어요. 게임에서 적용 확률은 공개되지 않았어요.";

const OPTION_COPY: { key: keyof Options; label: string; hint: string }[] = [
  { key: "weaponBreath", label: "무기 숨결", hint: "매 시도 최대 개수" },
  { key: "armorBreath", label: "방어구 숨결", hint: "매 시도 최대 개수" },
  { key: "armGuardBreath", label: "완갑 숨결", hint: "용암·빙하 숨결 매 시도 최대 개수" },
  {
    key: "weaponBook",
    label: "무기 책 효과 적용",
    hint: "야금술 · 업화 11~20단계",
  },
  {
    key: "armorBook",
    label: "방어구 책 효과 적용",
    hint: "재봉술 · 업화 11~20단계",
  },
];

// 성장 지원 is a standing official rule (no end date or target condition), so
// it is always applied with its source shown instead of a toggle (PM 총괄
// 2026-10-10, 계산 검증 공식 가이드 판독 7절).
const GROWTH_SUPPORT_NOTICE = "https://lostark.game.onstove.com/News/Notice/Views/13307";

type Loaded = {
  name: string;
  server: string;
  itemLevel: number | null;
  unsupported: string[];
};

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className={styles.switchRow}>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function CharacterLoader({
  initialName,
  onLoaded,
}: {
  initialName: string;
  onLoaded: (loaded: Loaded, parts: Record<PartId, PartState>) => void;
}) {
  // The name comes back from the address on back and reload (#889); the
  // server's first props would be the empty page the router cached.
  const fromAddress = useSearchParams().get("character")?.slice(0, 64) ?? initialName;
  const [name, setName] = useState(fromAddress);
  const [touched, setTouched] = useState(false);
  const error = characterNameError(name);
  const load = useMutation({
    mutationFn: (target: string) =>
      fetchCharacter(target, AbortSignal.timeout(20_000)),
    retry: false,
    onSuccess: (envelope) => {
      const { parts, unsupported, itemLevel } = partsFromCharacter(
        envelope.data,
      );
      onLoaded(
        {
          name: envelope.data.characterName,
          server: envelope.data.serverName,
          itemLevel,
          unsupported,
        },
        parts,
      );
    },
  });
  const started = useRef(false);
  const opened = useRef(fromAddress);
  useEffect(() => {
    const first = opened.current;
    if (started.current || !first || characterNameError(first)) return;
    started.current = true;
    load.mutate(normalizeCharacterName(first));
  }, [load]);

  const loadLimit = useRateLimit(load.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    // The button stays focusable while loading or rate limited
    // (aria-disabled); guard here.
    if (load.isPending || loadLimit.seconds > 0) return;
    setTouched(true);
    if (error) return;
    const target = normalizeCharacterName(name);
    // Keeps the plan's keys in the address (a whole new query dropped them).
    writeUrlParam("character", target);
    load.mutate(target);
  }
  const failure: QueryFailure | null =
    load.error instanceof CharacterQueryError
      ? load.error.info
      : load.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const copy = failure && failureCopy(failure);
  return (
    <>
      <form className={quote.searchForm} onSubmit={submit} noValidate>
        <label className={quote.field} data-grow="">
          <span>캐릭터 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="장비를 불러올 캐릭터"
            autoComplete="off"
            enterKeyHint="search"
            aria-invalid={touched && !!error}
          />
        </label>
        <button
          type="submit"
          className={quote.secondaryPill}
          aria-disabled={load.isPending || loadLimit.seconds > 0 || undefined}
          aria-busy={load.isPending || undefined}
        >
          {load.isPending ? "불러오는 중…" : retryLabel(loadLimit.seconds, "장비 불러오기")}
        </button>
      </form>
      {touched && error && <p className={quote.inputError}>{error}</p>}
      {copy && (
        <div className={quote.notice} role="alert">
          <strong>{copy.title}</strong>
          <p>{copy.text}</p>
        </div>
      )}
      <p className={quote.hint}>
        장비 툴팁의 재련 단계와 이름(운명의 업화·전율)으로 현재 단계를 채워요.
        불러오지 않고 아래에서 직접 골라도 돼요.
      </p>
    </>
  );
}

function PartRow({
  part,
  state,
  onChange,
}: {
  part: (typeof PARTS)[number];
  state: PartState;
  onChange: (next: PartState) => void;
}) {
  const id = useId();
  const up = state.enabled ? state.target - state.current : 0;
  return (
    <li
      className={styles.part}
      data-active={up > 0 || undefined}
      data-off={!state.enabled || undefined}
    >
      <div className={styles.partHead}>
        <strong id={id}>{part.label}</strong>
        <span>{!state.enabled ? "제외" : up > 0 ? `+${up}단계` : "유지"}</span>
        <label className={styles.include}>
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) =>
              onChange({ ...state, enabled: event.target.checked })
            }
          />
          계산에 포함
        </label>
      </div>
      <fieldset
        className={styles.partFields}
        aria-labelledby={id}
        disabled={!state.enabled}
      >
        {/* 완갑 has one stage table for every grade, so nothing to choose. */}
        {part.type === "ARM_GUARD" ? (
          <span className={styles.mini} aria-hidden="true" />
        ) : (
          <label className={styles.mini}>
            <span>등급</span>
            <Select
              value={state.grade}
              onValueChange={(grade) => onChange({ ...state, grade: grade as Grade })}
              items={GRADES.map((grade) => ({ value: grade.value, label: grade.label.replace("운명의 ", "") }))}
            />
          </label>
        )}
        <label className={styles.mini}>
          <span>현재</span>
          <Select
            value={state.current}
            onValueChange={(current) => {
              onChange({
                ...state,
                current,
                target: Math.max(current, state.target),
              });
            }}
            items={range(minStage(part.type), MAX_STAGE).map((stage) => ({ value: stage, label: `+${stage}` }))}
          />
        </label>
        <label className={styles.mini}>
          <span>목표</span>
          <Select
            value={state.target}
            onValueChange={(target) => onChange({ ...state, target })}
            items={range(state.current, MAX_STAGE).map((stage) => ({ value: stage, label: `+${stage}` }))}
          />
        </label>
      </fieldset>
    </li>
  );
}

/** A typed percent, or null when the box is empty. */
const percentValue = (text: string) => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
};

function Progress({
  parts,
  setPart,
  derived,
}: {
  parts: Record<PartId, PartState>;
  setPart: (id: PartId, next: PartState) => void;
  /** Failures the api found from 현재 성공 확률, per part (first stage). */
  derived: Partial<Record<PartId, number>>;
}) {
  const active = PARTS.filter(
    (part) =>
      parts[part.id].enabled &&
      parts[part.id].target > parts[part.id].current,
  );
  return (
    <details className={styles.disclosure}>
      <summary className="hit-44">첫 단계 진행 상황 입력</summary>
      <p className={quote.caption}>
        이미 시도 중인 단계가 있으면 재련 창의 장인의 기운과, 숨결·책을 올리기 전
        성공 확률을 넣어 주세요. 실패 횟수는 성공 확률로 계산해요. 첫 단계에만 적용돼요.
      </p>
      {active.length ? (
        <ul className={styles.progressList}>
          {active.map((part) => {
            const state = parts[part.id];
            return (
              <li key={part.id}>
                <strong>
                  {part.label} +{state.current + 1}
                </strong>
                <label className={styles.mini}>
                  <span>장인의 기운(%)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    value={state.artisanEnergy}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value))
                        setPart(part.id, {
                          ...state,
                          artisanEnergy: Math.min(100, Math.max(0, value)),
                        });
                    }}
                  />
                </label>
                <label className={styles.mini}>
                  <span>현재 성공 확률(%)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="숨결·책 전"
                    value={state.successRate ?? ""}
                    onChange={(event) => {
                      const value = percentValue(event.target.value);
                      if (value !== undefined)
                        setPart(part.id, { ...state, successRate: value });
                    }}
                  />
                </label>
                <small className={styles.derived}>
                  {derived[part.id] != null && `실패 ${derived[part.id]}회로 계산했어요.`}
                </small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={quote.caption}>목표 단계를 먼저 골라 주세요.</p>
      )}
    </details>
  );
}

/** "18:32" in KST, for the "시세 HH:mm 기준" line. */
const hhmm = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const NO_PRICES: MaterialPrice[] = [];
/** Prices refresh every minute (사용자 10-16: every screen with market prices). */
const PRICE_REFRESH_MS = 60_000;

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const unitGold = (value: number) =>
  value.toLocaleString("ko-KR", { maximumFractionDigits: value < 1 ? 4 : 2 });

function PriceSource({ line }: { line: CostLine }) {
  const price = line.price;
  if (!price) return null;
  if (price.status === "NOT_FOUND")
    return <small>거래소에 없어요 · 귀속 재료는 합계에서 빼요</small>;
  if (price.status === "PRICE_UNAVAILABLE")
    return <small>{priceUnavailableCopy(price.unavailableReason)}</small>;
  if (price.contentsPerItem != null)
    return (
      <small>
        {price.sourceItemName} · {formatCount(price.contentsPerItem)}개{" "}
        {formatGold(price.bundlePrice)}골드
      </small>
    );
  return price.bundleCount && price.bundleCount > 1 ? (
    <small>
      {formatCount(price.bundleCount)}개 묶음 {formatGold(price.bundlePrice)}골드
    </small>
  ) : null;
}

type Owned = Record<string, string>;

/**
 * Plan totals plus market prices for the materials. The top summary and the
 * result section both call it with the same key, so react-query shares one
 * request and the two always show the same total.
 */
function useRefiningCost(plans: PartPlan[], mode: Mode, basis: PriceBasis, owned: Owned) {
  const summary = summarize(plans, mode);
  const names = summary.materials.map((item) => item.name);
  const prices = useQuery({
    queryKey: ["material-prices", basis, [...names].sort().join("|")],
    queryFn: ({ signal }) =>
      postMaterialPrices({ priceBasis: basis, names }, signal),
    enabled: names.length > 0 && names.length <= MAX_PRICE_NAMES,
    staleTime: PRICE_REFRESH_MS,
    // Every minute while the page is visible (never in a background tab);
    // after a 429 the next try waits for its retry time. The inputs stay as
    // they are; only the prices are fetched again and the cost recomputed.
    refetchInterval: refreshEvery(PRICE_REFRESH_MS),
    // Same rule as 더보기 손익 (사용자 지적 10-12 01:36): a new basis keeps
    // the old table, dimmed, instead of emptying it and refilling it.
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const priceList = prices.data?.data.items ?? null;
  const cost = costLines(
    summary.materials,
    Object.fromEntries(
      Object.entries(owned).map(([name, value]) => [name, Number(value || 0)]),
    ),
    priceList,
  );
  const total = summary.gold + (priceList ? cost.buyGold : 0);
  return { summary, prices, priceList, total, ...cost };
}

/** Conclusion first (피아식별 심각 2): the total sits above the inputs. */
function TopSummary({
  plans,
  mode,
  basis,
  owned,
}: {
  plans: PartPlan[];
  mode: Mode;
  basis: PriceBasis;
  owned: Owned;
}) {
  const { summary, priceList, total } = useRefiningCost(plans, mode, basis, owned);
  return (
    <>
      <p className={styles.topTotal}>
        {formatCount(total)}
        <span>골드</span>
      </p>
      {/* One line per part: in a single run, a basis or count that changed
          width moved the text after it (A7). */}
      <p className={styles.topNote}>
        <span className={styles.topLine}>
          {priceList ? "재련 골드 + 사야 할 골드" : "재련 골드(재료 시세를 불러오는 중…)"}
        </span>
        <span className={styles.topLine}>
          총 {formatCount(summary.stageCount)}단계, 시도{" "}
          {formatCount(summary.attempts, mode === "expected" ? 1 : 0)}회
        </span>
        <a className={styles.topLine} href="#estimate-heading">
          재료와 부위별 내역
        </a>
      </p>
    </>
  );
}

function Result({
  plans,
  mode,
  basis,
  setBasis,
  owned,
  setOwned,
}: {
  plans: PartPlan[];
  mode: Mode;
  basis: PriceBasis;
  setBasis: (basis: PriceBasis) => void;
  owned: Owned;
  setOwned: (update: (prev: Owned) => Owned) => void;
}) {
  const { summary, prices, priceList, total, lines, buyGold, valueRaw, unpriced } =
    useRefiningCost(plans, mode, basis, owned);
  const priceLimit = useRateLimit(prices.error);
  // A refreshed unit price is marked for a moment (▲/▼, wash once). Watched
  // on the response's own list, which keeps its identity between renders.
  const { pulse, summary: changes } = useChangedCells(priceList ?? NO_PRICES, (item) => item.name, {
    unit: (item) => (item.status === "PRICED" ? item.unitPriceGold : null),
  });
  const priceFailure =
    prices.error instanceof MarketQueryError
      ? prices.error.info
      : prices.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const observedAt = priceList
    ?.map((item) => item.observedAt)
    .sort()
    .at(-1);
  const basisLabel = priceBases.find((item) => item.value === basis)?.label;
  const assumptions = [
    // Books are in by default (PM 총괄 10-11 00:20); say so next to the result.
    ...(plans.some(({ plan }) => plan.useBook) ? [BOOK_ASSUMPTION] : []),
    ...new Set(plans.flatMap(({ plan }) => plan.assumptions)),
  ];
  return (
    <>
      <p className={quote.total} data-stale={prices.isPlaceholderData || undefined}>
        {formatCount(total)}
        <span>골드</span>
      </p>
      <p className={quote.totalNote}>
        {priceList
          ? `재련 골드 ${formatCount(summary.gold)} + 사야 할 골드 ${formatCount(buyGold)} (가진 재료까지 시세로 치면 ${formatCount(Math.round(summary.rawGold + valueRaw))})`
          : `재련 골드 ${formatCount(summary.gold)}`}{" "}
        · 총 {formatCount(summary.stageCount)}단계, 시도{" "}
        {formatCount(summary.attempts, mode === "expected" ? 1 : 0)}회
      </p>
      {/* Always there, one line high: appearing and leaving moved the table.
          A refresh in the background keeps the time line (no flicker); the
          line is redrawn when its text changes. */}
      <p className={styles.priceStatus} role="status">
        <span key={observedAt ?? (prices.isFetching ? "loading" : "none")}>
          {observedAt
            ? `시세 ${hhmm.format(new Date(observedAt))} 기준 · 1분마다 새로 불러와요`
            : prices.isFetching
              ? "재료 시세를 불러오고 있어요."
              : ""}
        </span>
      </p>
      {priceList && unpriced.length > 0 && (
        <p className={quote.status}>
          시세가 없어 합계에서 뺀 재료: {unpriced.join(", ")}
        </p>
      )}

      <h3 className={styles.sectionTitle}>필요 재료</h3>
      <SegmentedControl
        className={styles.segment}
        aria-label="재료 가격 기준"
        value={basis}
        onValueChange={(value) => setBasis(value as PriceBasis)}
      >
        {priceBases.map((item) => (
          <SegmentedItem key={item.value} value={item.value}>
            {item.label}
          </SegmentedItem>
        ))}
      </SegmentedControl>
      {priceFailure && (
        <div className={quote.notice}>
          {/* The alert holds the sentence only; the retry button's countdown
              ticks outside it so it is not re-announced every second. */}
          <div role="alert">
            <strong>{marketFailureCopy(priceFailure).title}</strong>
            <p>{marketFailureCopy(priceFailure).text}</p>
          </div>
          <button
            type="button"
            className={quote.outlinePill}
            aria-disabled={prices.isFetching || priceLimit.seconds > 0 || undefined}
            aria-busy={prices.isFetching || undefined}
            onClick={() => !prices.isFetching && priceLimit.seconds === 0 && prices.refetch()}
          >
            {retryLabel(priceLimit.seconds, "시세 다시 불러오기")}
          </button>
        </div>
      )}
      <div className={styles.materialWrap} aria-busy={prices.isPlaceholderData || undefined} data-stale={prices.isPlaceholderData || undefined}>
        <table className={`${styles.table} ${styles.materialTable}`} data-wide="">
          {/* Fixed widths for the largest amounts: switching the price basis
              changes the numbers, never the columns (사용자 제보 10-26). */}
          <colgroup>
            <col />
            <col className={styles.colCount} />
            <col className={styles.colOwned} />
            <col className={styles.colCount} />
            <col className={styles.colUnit} />
            <col className={styles.colGold} />
            <col className={styles.colValue} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">재료</th>
              <th scope="col">필요</th>
              <th scope="col">보유</th>
              <th scope="col">부족</th>
              <th scope="col">단가</th>
              <th scope="col">사야 할 골드</th>
              <th scope="col">쓰는 재료 시세</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.name}>
                <th scope="row">
                  {line.name}
                  <PriceSource line={line} />
                </th>
                <td data-label="필요">{formatCount(line.amount)}</td>
                <td data-label="보유">
                  <input
                    className={styles.ownedInput}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="0"
                    aria-label={`${line.name} 보유 수량`}
                    value={owned[line.name] ?? ""}
                    onChange={(event) =>
                      setOwned((prev) => ({
                        ...prev,
                        [line.name]: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </td>
                <td data-label="부족" data-done={line.missing === 0 || undefined}>
                  {line.missing === 0 ? "충분" : formatCount(line.missing)}
                </td>
                <td data-label="단가">
                  <ChangeMark pulse={pulse(line.name, "unit")}>
                    {line.price?.status === "PRICED" &&
                    line.price.unitPriceGold != null
                      ? unitGold(line.price.unitPriceGold)
                      : "—"}
                  </ChangeMark>
                </td>
                <td className={styles.cost} data-label="사야 할 골드">
                  {line.purchase == null ? "—" : formatCount(line.purchase.gold)}
                  {line.purchase != null && line.purchase.perUnit > 1 && line.purchase.units > 0 && (
                    <small>
                      {/* Read as "금액, n묶음" instead of one run-on number. */}
                      <span className={styles.srOnly}>, </span>
                      {formatCount(line.purchase.units)}
                      {line.price?.contentsPerItem != null ? "주머니" : "묶음"}
                      {line.purchase.leftover > 0 &&
                        ` · ${formatCount(line.purchase.leftover)}개 남음`}
                    </small>
                  )}
                </td>
                <td data-label="쓰는 재료 시세">
                  {line.value == null
                    ? "—"
                    : formatCount(Math.round(line.value))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UpdateAnnouncer text={changes ? `재료 단가 ${changes}` : ""} />
      {/* 사용자 제보 10-26: the two gold columns, one line each; the rest folded. */}
      <dl className={styles.terms}>
        <div>
          <dt>사야 할 골드</dt>
          <dd>가진 수량을 빼고 부족한 만큼만 지금 살 때 드는 골드예요.</dd>
        </div>
        <div>
          <dt>쓰는 재료 시세</dt>
          <dd>가진 재료까지 포함해 재련에 쓰일 재료 전체를 시세로 친 값이에요.</dd>
        </div>
      </dl>
      <details className={styles.more}>
        <summary className="hit-44">자세히</summary>
        <p className={quote.caption}>
          필요 수량은 기대 소모량을 올림한 값이에요. 사야 할 골드는 부족 수량을
          거래소 묶음 단위로 올려 산 금액이라 남는 수량이 생길 수 있고, 쓰는 재료
          시세는 기대 소모량 × 1개당 시세라 가진 수량과 상관없어요. 운명의 파편은
          가장 싼 주머니 기준이에요.
          {observedAt &&
            ` 거래소 첫 페이지에서 이름이 같은 상품의 ${basisLabel}를 ${kst.format(new Date(observedAt))}에 읽었어요.`}
        </p>
      </details>

      <details className={styles.disclosure}>
        <summary>부위·단계별 시도 횟수</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">단계</th>
                <th scope="col">첫 시도</th>
                <th scope="col">평균</th>
                <th scope="col">50%</th>
                <th scope="col">90%</th>
                <th scope="col">최대</th>
                <th scope="col">골드</th>
              </tr>
            </thead>
            <tbody>
              {plans.flatMap(({ part, plan }) =>
                plan.stages.map((stage) => (
                  <tr key={`${part.id}-${stage.targetStage}`}>
                    <th scope="row">
                      {part.label} +{stage.targetStage}
                    </th>
                    <td>{formatCount(stage.firstAttemptSuccessRateBp / 100, 2)}%</td>
                    <td data-mode={mode === "expected" || undefined}>
                      {formatCount(stage.expectedAttempts, 2)}
                    </td>
                    <td data-mode={mode === "median" || undefined}>
                      {stage.medianAttempts}
                    </td>
                    <td data-mode={mode === "p90" || undefined}>
                      {stage.p90Attempts}
                    </td>
                    <td data-mode={mode === "max" || undefined}>
                      {stage.maxAttempts}
                    </td>
                    <td>{formatCount(Math.ceil(stageGold(stage, mode)))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className={quote.caption}>
          현재 기준({MODES.find((m) => m.id === mode)?.label}) 시도 횟수{" "}
          {formatCount(
            plans.reduce(
              (sum, { plan }) =>
                sum +
                plan.stages.reduce((s, stage) => s + attemptsAt(stage, mode), 0),
              0,
            ),
            mode === "expected" ? 2 : 0,
          )}
          회. 첫 시도 성공 확률은 고른 숨결·책을 더한 값이라, 넣은 현재 성공 확률보다 높을 수 있어요.
        </p>
      </details>

      <div className={quote.resultFooter}>
        {assumptions.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </div>
    </>
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const json = <T,>(read: (v: unknown) => T | null): UrlCodec<T> => ({
  parse: (raw) => {
    try {
      return read(JSON.parse(raw));
    } catch {
      return null;
    }
  },
  format: (value) => JSON.stringify(value),
});
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Each part as typed; a part with a wrong field keeps its default (#889). */
const partsCodec = json<Record<PartId, PartState>>((v) => {
  if (!isRecord(v)) return null;
  const out = initialParts();
  for (const part of PARTS) {
    const p = v[part.id];
    if (!isRecord(p)) continue;
    const grade = GRADES.some((g) => g.value === p.grade) ? (p.grade as Grade) : null;
    const current = int(p.current, minStage(part.type), 25);
    const target = int(p.target, minStage(part.type), 25);
    const energy = typeof p.artisanEnergy === "number" && p.artisanEnergy >= 0 && p.artisanEnergy <= 100 ? p.artisanEnergy : null;
    // Addresses saved before 11-02 carry failedAttempts instead: read as not entered.
    const rate = p.successRate == null ? null : isPercent(p.successRate) ? p.successRate : undefined;
    if (typeof p.enabled !== "boolean" || !grade || current == null || target == null || energy == null || rate === undefined) continue;
    out[part.id] = { enabled: p.enabled, grade, current, target, artisanEnergy: energy, successRate: rate };
  }
  return out;
});
const OPTION_KEYS = ["weaponBreath", "armorBreath", "armGuardBreath", "weaponBook", "armorBook", "growthSupport"] as const;
const DEFAULT_OPTIONS: Options = { weaponBreath: false, armorBreath: false, armGuardBreath: false, weaponBook: true, armorBook: true, growthSupport: true };
const optionsCodec = json<Options>((v) => {
  if (!isRecord(v)) return null;
  const out = { ...DEFAULT_OPTIONS };
  for (const key of OPTION_KEYS) if (typeof v[key] === "boolean") out[key] = v[key];
  return out;
});
const ownedCodec = json<Owned>((v) => {
  if (!isRecord(v)) return null;
  const out: Owned = {};
  for (const [k, n] of Object.entries(v)) if (typeof n === "string" && n.length <= 12 && k.length <= 40) out[k] = n;
  return out;
});
const NO_OWNED: Owned = {};

function RefiningContent({ initialName }: { initialName: string }) {
  // Every input lives in the address: back and reload keep it (#889).
  const [parts, setParts] = useUrlState("parts", INITIAL_PARTS, partsCodec);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [options, setOptions] = useUrlState("options", DEFAULT_OPTIONS, optionsCodec);
  const [mode, setMode] = useUrlState<Mode>("mode", "expected", oneOfCodec(MODES.map((m) => m.id)));
  const [owned, setOwned] = useUrlState<Owned>("owned", NO_OWNED, ownedCodec);
  const [basis, setBasis] = useUrlState<PriceBasis>("price", "CURRENT_MIN_PRICE", oneOfCodec(priceBases.map((b) => b.value)));
  // Targets brought back from the address win over a reload's fresh load
  // once: the character's current stages come from the load, the plan stays.
  // Only for the character the address opened with (click-path audit #889):
  // loading someone else afterwards starts from that character's own stages.
  const openedCharacter = useSearchParams().get("character");
  const restored = useRef<{ name: string; parts: Record<PartId, PartState> } | null>(
    parts !== INITIAL_PARTS && openedCharacter && !characterNameError(openedCharacter)
      ? { name: normalizeCharacterName(openedCharacter), parts }
      : null,
  );
  const setPart = (id: PartId, next: PartState) =>
    setParts((prev) => ({ ...prev, [id]: next }));

  const requests = useMemo(
    () =>
      PARTS.flatMap((part) => {
        const request = toRequest(part, parts[part.id], options);
        return request ? [{ part, request, key: requestKey(request) }] : [];
      }),
    [parts, options],
  );
  const queries = useQueries({
    queries: requests.map(({ request, key }) => ({
      queryKey: ["refining", key],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        postRefiningPlan(request, signal),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const pending = queries.some((q) => q.isPending);
  const failed = queries.find((q) => q.isError);
  const planLimit = useRateLimit(failed?.error);
  const plans: PartPlan[] = queries.flatMap((q, i) =>
    q.data ? [{ part: requests[i].part, plan: q.data.data }] : [],
  );
  const complete = requests.length > 0 && plans.length === requests.length;
  const derived: Partial<Record<PartId, number>> = Object.fromEntries(
    plans.flatMap(({ part, plan }) => {
      const failures = plan.stages[0]?.startFailedAttempts;
      return plan.failedAttemptsFrom === "SUCCESS_RATE" && failures != null ? [[part.id, failures]] : [];
    }),
  );
  const nextLevel = targetItemLevel(loaded?.itemLevel ?? null, parts);
  const failure =
    failed?.error instanceof RefiningQueryError
      ? failed.error.info
      : failed
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const modeHint = MODES.find((m) => m.id === mode)?.hint;

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#refining-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="refining-main">
        <section className={quote.hero} aria-labelledby="refining-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Setting size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="refining-heading">재련 기대 비용</h1>
          <p className={quote.heroCopy}>목표 단계까지, 확률로 미리.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 캐릭터 검색으로
          </Link>
          <HubTabs hub="growth" />
        </section>

        <div className={quote.band}>
          <section
            className={styles.top}
            aria-labelledby="top-summary-heading"
            aria-live="polite"
          >
            <p className={quote.kicker} id="top-summary-heading">
              목표까지 예상 비용 <span className={styles.topMode}>{MODES.find((m) => m.id === mode)?.label}</span>
            </p>
            {failure ? (
              <p className={styles.topNote}>계산하지 못했어요. 아래 결과에서 다시 시도할 수 있어요.</p>
            ) : complete ? (
              <TopSummary plans={plans} mode={mode} basis={basis} owned={owned} />
            ) : (
              // A line of its own per state: rewriting one line's text moved it by a sub-pixel (A7).
              <p className={styles.topNote} key={requests.length ? "pending" : "empty"}>
                {requests.length ? "계산하고 있어요." : "아래에서 목표 단계를 현재보다 높게 고르면 여기에 총 비용이 나와요."}
              </p>
            )}
          </section>
          <div className={quote.workspace}>
            <section className={quote.card} aria-labelledby="load-heading">
              <h2 id="load-heading">캐릭터 장비</h2>
              <div className={quote.searchArea}>
                <CharacterLoader
                  initialName={initialName}
                  onLoaded={(next, nextParts) => {
                    setLoaded(next);
                    const saved = restored.current?.name === next.name ? restored.current.parts : null;
                    restored.current = null;
                    setParts(
                      saved
                        ? (Object.fromEntries(
                            PARTS.map((part) => {
                              const fresh = nextParts[part.id];
                              const kept = saved[part.id];
                              return [
                                part.id,
                                kept.target > fresh.current ? { ...fresh, enabled: kept.enabled, target: kept.target } : fresh,
                              ];
                            }),
                          ) as Record<PartId, PartState>)
                        : nextParts,
                    );
                  }}
                />
              </div>
              {loaded && (
                <p className={styles.loaded} role="status">
                  <span>
                    <strong>{loaded.name}</strong> · {loaded.server}
                    {loaded.itemLevel != null &&
                      ` · 아이템 레벨 ${formatLevel(loaded.itemLevel)}`}
                  </span>
                  {loaded.unsupported.length > 0 && (
                    <small>
                      {loaded.unsupported.join(", ")} 부위는 업화·전율 장비가
                      아니거나 단계를 읽지 못해 계산에서 뺐어요. 직접 포함해
                      고를 수 있어요.
                    </small>
                  )}
                </p>
              )}
            </section>

            <section className={quote.card} aria-labelledby="target-heading">
              <h2 id="target-heading">목표 단계</h2>
              <div
                className={styles.chips}
                role="group"
                aria-label="모든 부위 목표 단계"
              >
                {range(MIN_STAGE + 1, MAX_STAGE).map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className="hit-44"
                    onClick={() =>
                      setParts((prev) =>
                        Object.fromEntries(
                          PARTS.map((part) => [
                            part.id,
                            // 완갑 has its own stage table: set in its own row.
                            prev[part.id].enabled && part.type !== "ARM_GUARD"
                              ? {
                                  ...prev[part.id],
                                  target: Math.max(prev[part.id].current, stage),
                                }
                              : prev[part.id],
                          ]),
                        ) as Record<PartId, PartState>,
                      )
                    }
                  >
                    +{stage}
                  </button>
                ))}
              </div>
              <p className={quote.caption}>
                누르면 계산에 포함한 모든 부위의 목표가 그 단계로 바뀌어요.
                이미 더 높은 부위는 그대로예요. 완갑은 단계표가 달라 아래 줄에서 따로 골라요.
              </p>
              <ul className={styles.parts}>
                {PARTS.map((part) => (
                  <PartRow
                    key={part.id}
                    part={part}
                    state={parts[part.id]}
                    onChange={(next) => setPart(part.id, next)}
                  />
                ))}
              </ul>
              {nextLevel != null && loaded?.itemLevel != null && (
                <p className={styles.levelLine}>
                  아이템 레벨 {formatLevel(loaded.itemLevel)}
                  <span aria-hidden="true"> → </span>
                  <span className={styles.srOnly}>에서 </span>
                  <strong>{formatLevel(nextLevel)}</strong>
                </p>
              )}
              <Progress parts={parts} setPart={setPart} derived={derived} />
            </section>

            <section className={quote.card} aria-labelledby="option-heading">
              <h2 id="option-heading">재련 옵션</h2>
              <div className={styles.switches}>
                {OPTION_COPY.map((item) => (
                  <Switch
                    key={item.key}
                    label={item.label}
                    hint={item.hint}
                    checked={options[item.key]}
                    onChange={(value) =>
                      setOptions((prev) => ({ ...prev, [item.key]: value }))
                    }
                  />
                ))}
              </div>
              <p className={quote.hint}>
                성장 지원(업화 1~18단계 재련 골드 20% 감소)은 기간·대상 조건이
                없는 공식 규칙이라 자동으로 적용해요(
                <a href={GROWTH_SUPPORT_NOTICE} target="_blank" rel="noreferrer" className="hit-44">
                  공지
                </a>{" "}
                · 게임 재련 가이드). 전율 책, 실링, 상급 재련, 이벤트 확률은
                계산하지 않아요.
              </p>
              {/* One line on the page, the rest folded (#1112): nothing removed. */}
              <p className={quote.hint}>책은 기본으로 넣고, 책 효과가 매번 적용된다고 보고 계산해요.</p>
              <MoreDetail className={quote.hint}>
                게임에는 &ldquo;특수 재료 별 효과는 확률에 따라 적용되지 않을 수
                있습니다&rdquo;라고 나오고, 그 확률은 공개되지 않았어요. 끄면 책
                없이 계산해요. 책은 운명의 업화 11~20단계에만 적용돼요.
              </MoreDetail>
            </section>
          </div>
        </div>

        <section
          className={quote.result}
          aria-labelledby="estimate-heading"
          aria-busy={pending}
        >
          <p className={quote.kicker} id="estimate-heading">
            예상 소모
          </p>
          <SegmentedControl
            className={styles.segment}
            aria-label="확률 기준"
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
          >
            {MODES.map((item) => (
              <SegmentedItem key={item.id} value={item.id}>
                {item.label}
              </SegmentedItem>
            ))}
          </SegmentedControl>
          <p className={quote.hint}>{modeHint}</p>
          {failure ? (
            <div className={quote.notice}>
              {/* The alert holds the sentence only; the retry button's countdown
                  ticks outside it so it is not re-announced every second. */}
              <div role="alert">
                <strong>{refiningFailureCopy(failure).title}</strong>
                <p>{refiningFailureCopy(failure).text}</p>
              </div>
              <button
                type="button"
                className={quote.outlinePill}
                aria-disabled={planLimit.seconds > 0 || undefined}
                onClick={() => planLimit.seconds === 0 && failed?.refetch()}
              >
                {retryLabel(planLimit.seconds, "다시 계산")}
              </button>
            </div>
          ) : !requests.length ? (
            <p className={quote.empty}>
              목표 단계를 현재보다 높게 고르면 바로 계산해요.
            </p>
          ) : !complete ? (
            <p className={quote.empty} role="status">
              계산하고 있어요.
            </p>
          ) : (
            <Result
              plans={plans}
              mode={mode}
              basis={basis}
              setBasis={setBasis}
              owned={owned}
              setOwned={setOwned}
            />
          )}
        </section>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 공개 확률 데이터 기반 계산
      </footer>
    </div>
  );
}

export function RefiningPlanTool({ initialName }: { initialName: string }) {
  return (
    <RefiningContent initialName={initialName} />
  );
}
