"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hammer } from "lucide-react";
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
  type PriceBasis,
} from "@/lib/market/model";
import { RefiningQueryError, postRefiningPlan } from "@/lib/refining/client";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import {
  GRADES,
  MAX_STAGE,
  MIN_STAGE,
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
import styles from "./refining-plan.module.css";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const initialParts = () =>
  Object.fromEntries(PARTS.map((part) => [part.id, defaultPart()])) as Record<
    PartId,
    PartState
  >;
const OPTION_COPY: { key: keyof Options; label: string; hint: string }[] = [
  { key: "weaponBreath", label: "무기 숨결", hint: "매 시도 최대 개수" },
  { key: "armorBreath", label: "방어구 숨결", hint: "매 시도 최대 개수" },
  { key: "weaponBook", label: "무기 책", hint: "야금술 · 업화 11~20단계" },
  { key: "armorBook", label: "방어구 책", hint: "재봉술 · 업화 11~20단계" },
  {
    key: "growthSupport",
    label: "성장 지원",
    hint: "업화 18단계까지 재련 골드 20% 감소",
  },
];

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
  const router = useRouter();
  const [name, setName] = useState(initialName);
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
  useEffect(() => {
    if (started.current || !initialName || characterNameError(initialName))
      return;
    started.current = true;
    load.mutate(normalizeCharacterName(initialName));
  }, [initialName, load]);

  const loadLimit = useRateLimit(load.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    // The button stays focusable while loading or rate limited
    // (aria-disabled); guard here.
    if (load.isPending || loadLimit.seconds > 0) return;
    setTouched(true);
    if (error) return;
    const target = normalizeCharacterName(name);
    router.replace(`?${new URLSearchParams({ character: target })}`, {
      scroll: false,
    });
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
          {load.isPending ? "불러오는 중" : retryLabel(loadLimit.seconds, "장비 불러오기")}
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
        <label className={styles.mini}>
          <span>등급</span>
          <select
            value={state.grade}
            onChange={(event) =>
              onChange({ ...state, grade: event.target.value as Grade })
            }
          >
            {GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label.replace("운명의 ", "")}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.mini}>
          <span>현재</span>
          <select
            value={state.current}
            onChange={(event) => {
              const current = Number(event.target.value);
              onChange({
                ...state,
                current,
                target: Math.max(current, state.target),
              });
            }}
          >
            {range(MIN_STAGE, MAX_STAGE).map((stage) => (
              <option key={stage} value={stage}>
                +{stage}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.mini}>
          <span>목표</span>
          <select
            value={state.target}
            onChange={(event) =>
              onChange({ ...state, target: Number(event.target.value) })
            }
          >
            {range(state.current, MAX_STAGE).map((stage) => (
              <option key={stage} value={stage}>
                +{stage}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    </li>
  );
}

function Progress({
  parts,
  setPart,
}: {
  parts: Record<PartId, PartState>;
  setPart: (id: PartId, next: PartState) => void;
}) {
  const active = PARTS.filter(
    (part) =>
      parts[part.id].enabled &&
      parts[part.id].target > parts[part.id].current,
  );
  return (
    <details className={styles.disclosure}>
      <summary>첫 단계 진행 상황 입력</summary>
      <p className={quote.caption}>
        이미 시도 중인 단계가 있으면 현재 장인의 기운과 실패 횟수를 넣어 주세요.
        첫 단계에만 적용돼요.
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
                  <span>실패 횟수</span>
                  <select
                    value={state.failedAttempts}
                    onChange={(event) =>
                      setPart(part.id, {
                        ...state,
                        failedAttempts: Number(event.target.value),
                      })
                    }
                  >
                    {range(0, 10).map((n) => (
                      <option key={n} value={n}>
                        {n}회
                      </option>
                    ))}
                  </select>
                </label>
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
    return <small>선택한 기준의 가격이 없어요</small>;
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

function Result({ plans, mode }: { plans: PartPlan[]; mode: Mode }) {
  const summary = summarize(plans, mode);
  const [owned, setOwned] = useState<Record<string, string>>({});
  const [basis, setBasis] = useState<PriceBasis>("CURRENT_MIN_PRICE");
  const names = summary.materials.map((item) => item.name);
  const prices = useQuery({
    queryKey: ["material-prices", basis, [...names].sort().join("|")],
    queryFn: ({ signal }) =>
      postMaterialPrices({ priceBasis: basis, names }, signal),
    enabled: names.length > 0 && names.length <= MAX_PRICE_NAMES,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const priceList = prices.data?.data.items ?? null;
  const priceLimit = useRateLimit(prices.error);
  const { lines, buyGold, valueGold, unpriced } = costLines(
    summary.materials,
    Object.fromEntries(
      Object.entries(owned).map(([name, value]) => [name, Number(value || 0)]),
    ),
    priceList,
  );
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
  const source = plans[0].plan.source;
  const assumptions = [
    ...new Set(plans.flatMap(({ plan }) => plan.assumptions)),
  ];
  return (
    <>
      <p className={quote.total}>
        {formatCount(summary.gold + (priceList ? buyGold : 0))}
        <span>골드</span>
      </p>
      <p className={quote.totalNote}>
        {priceList
          ? `재련 골드 ${formatCount(summary.gold)} + 구매 골드 ${formatCount(buyGold)} (소모 가치 기준 ${formatCount(summary.gold + valueGold)})`
          : `재련 골드 ${formatCount(summary.gold)}`}{" "}
        · 총 {formatCount(summary.stageCount)}단계, 시도{" "}
        {formatCount(summary.attempts, mode === "expected" ? 1 : 0)}회
      </p>
      {prices.isFetching && (
        <p className={styles.priceStatus} role="status">
          재료 시세를 불러오고 있어요.
        </p>
      )}
      {priceList && unpriced.length > 0 && (
        <p className={quote.status}>
          시세가 없어 합계에서 뺀 재료: {unpriced.join(", ")}
        </p>
      )}

      <h3 className={styles.sectionTitle}>필요 재료</h3>
      <div
        className={quote.segmented}
        role="radiogroup"
        aria-label="재료 가격 기준"
      >
        {priceBases.map((item) => (
          <label
            key={item.value}
            data-checked={basis === item.value || undefined}
          >
            <input
              type="radio"
              name="refining-price-basis"
              value={item.value}
              checked={basis === item.value}
              onChange={() => setBasis(item.value)}
            />
            {item.label}
          </label>
        ))}
      </div>
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
      <div className={styles.materialWrap}>
        <table className={styles.table} data-wide="">
          <thead>
            <tr>
              <th scope="col">재료</th>
              <th scope="col">필요</th>
              <th scope="col">보유</th>
              <th scope="col">부족</th>
              <th scope="col">단가</th>
              <th scope="col">구매 골드</th>
              <th scope="col">소모 가치</th>
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
                  {line.price?.status === "PRICED" &&
                  line.price.unitPriceGold != null
                    ? unitGold(line.price.unitPriceGold)
                    : "—"}
                </td>
                <td className={styles.cost} data-label="구매 골드">
                  {line.purchase == null ? "—" : formatCount(line.purchase.gold)}
                  {line.purchase != null && line.purchase.perUnit > 1 && line.purchase.units > 0 && (
                    <small>
                      {formatCount(line.purchase.units)}
                      {line.price?.contentsPerItem != null ? "주머니" : "묶음"}
                      {line.purchase.leftover > 0 &&
                        ` · ${formatCount(line.purchase.leftover)}개 남음`}
                    </small>
                  )}
                </td>
                <td data-label="소모 가치">
                  {line.value == null
                    ? "—"
                    : formatCount(Math.ceil(line.value - 1e-9))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={quote.caption}>
        필요 수량은 소수를 올림했어요. 구매 골드는 부족 수량을 거래소 묶음
        단위로 올려 산 금액이고, 소모 가치는 기대 소모량 × 1개당 시세예요(보유
        수량과 무관). 운명의 파편은 가장 싼 주머니 기준이에요.
        {observedAt &&
          ` 거래소 첫 페이지에서 이름이 같은 상품의 ${basisLabel}를 ${kst.format(new Date(observedAt))}에 읽었어요.`}
      </p>

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
          회
        </p>
      </details>

      <div className={quote.resultFooter}>
        <span>
          공식 확률표가 아니라 공개 데이터를 교차 검증한 값이에요. 출처{" "}
          {source.name} ({source.license}) · 교차 검증 {source.crossCheckedWith}{" "}
          · 확인 {source.verifiedOn} · 규칙 {plans[0].plan.ruleVersion}
        </span>
        {assumptions.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </div>
    </>
  );
}

function RefiningContent({ initialName }: { initialName: string }) {
  const [parts, setParts] = useState(initialParts);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [options, setOptions] = useState<Options>({
    weaponBreath: false,
    armorBreath: false,
    weaponBook: false,
    armorBook: false,
    growthSupport: false,
  });
  const [mode, setMode] = useState<Mode>("expected");
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
            <Hammer size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="refining-heading">재련 기대 비용</h1>
          <p className={quote.heroCopy}>목표 단계까지, 확률로 미리.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 캐릭터 검색으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={quote.workspace}>
            <section className={quote.card} aria-labelledby="load-heading">
              <p className={quote.step}>1</p>
              <h2 id="load-heading">캐릭터 장비</h2>
              <div className={quote.searchArea}>
                <CharacterLoader
                  initialName={initialName}
                  onLoaded={(next, nextParts) => {
                    setLoaded(next);
                    setParts(nextParts);
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
              <p className={quote.step}>2</p>
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
                    onClick={() =>
                      setParts((prev) =>
                        Object.fromEntries(
                          PARTS.map((part) => [
                            part.id,
                            prev[part.id].enabled
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
                이미 더 높은 부위는 그대로예요.
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
              <Progress parts={parts} setPart={setPart} />
            </section>

            <section className={quote.card} aria-labelledby="option-heading">
              <p className={quote.step}>3</p>
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
                책과 성장 지원은 운명의 업화에만 적용돼요. 전율 책, 실링, 상급
                재련, 이벤트 확률은 계산하지 않아요.
              </p>
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
          <div
            className={quote.segmented}
            role="radiogroup"
            aria-label="확률 기준"
          >
            {MODES.map((item) => (
              <label key={item.id} data-checked={mode === item.id || undefined}>
                <input
                  type="radio"
                  name="refining-mode"
                  value={item.id}
                  checked={mode === item.id}
                  onChange={() => setMode(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
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
            <Result plans={plans} mode={mode} />
          )}
        </section>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공개 확률 데이터 기반 계산
      </footer>
    </div>
  );
}

export function RefiningPlanTool({ initialName }: { initialName: string }) {
  return (
    <RefiningContent initialName={initialName} />
  );
}
