"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useIsFetching, useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, Check, Pause, Play, Plus, Search, X } from "lucide-react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { GameIcon } from "@/components/character/imagery";
import {
  LandingMotion,
  Reveal,
  useLandingMotion,
} from "@/components/landing/motion";
import {
  MarketQueryError,
  fetchMarketItems,
  fetchMarketOptions,
  postMaterialQuote,
} from "@/lib/market/client";
import {
  MAX_QUOTE_ITEMS,
  formatGold,
  marketFailureCopy,
  normalizeText,
  priceBases,
  quantityError,
  searchError,
  statusCopy,
  type MarketFailure,
  type MarketSearch,
  type MaterialQuote,
} from "@/lib/market/model";
import { toQuoteRequest, usePlan, type PlanRow } from "@/lib/market/store";
import styles from "./material-quote.module.css";

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const time = (value: string | null) =>
  value ? `${kst.format(new Date(value))} KST` : "조회 안 함";
const count = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("ko-KR");
const failureOf = (error: unknown): MarketFailure | null =>
  error instanceof MarketQueryError
    ? error.info
    : error
      ? { code: "LOST_ARK_API_ERROR", status: 502 }
      : null;

function useCooldown(failures: (MarketFailure | null)[]) {
  const retryAt = Math.max(
    0,
    ...failures.map((failure) => failure?.retryAt ?? 0),
  );
  const [now, setNow] = useState(() => Date.now());
  const active = retryAt > now;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return active ? Math.ceil((retryAt - now) / 1000) : 0;
}

function Notice({ failure, wait }: { failure: MarketFailure; wait: number }) {
  const copy = marketFailureCopy(failure);
  return (
    <div className={styles.notice} role="alert">
      <strong>{copy.title}</strong>
      <p>
        {copy.text}
        {wait > 0 && ` ${wait}초 후 다시 시도할 수 있어요.`}
      </p>
    </div>
  );
}

function ItemSearch({
  wait,
  onRateLimit,
}: {
  wait: number;
  onRateLimit: (failure: MarketFailure) => void;
}) {
  const formId = useId();
  const { rows, add } = usePlan();
  const options = useQuery({
    queryKey: ["market", "options"],
    queryFn: ({ signal }) => fetchMarketOptions(signal),
    retry: false,
    staleTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const categories = useMemo(
    () => options.data?.data.categories ?? [],
    [options.data],
  );
  const [category, setCategory] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<MarketSearch | null>(null);
  const selectedCategory =
    category ??
    categories.find((item) => item.code === 50000)?.code ??
    categories[0]?.code ??
    null;
  const items = useQuery({
    queryKey: ["market", "items", submitted],
    queryFn: ({ signal }) => fetchMarketItems(submitted!, signal),
    enabled: !!submitted,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const failure = failureOf(options.error) ?? failureOf(items.error);
  useEffect(() => {
    if (failure?.retryAt) onRateLimit(failure);
  }, [failure, onRateLimit]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const issue = searchError(selectedCategory, name);
    setError(issue);
    if (issue || wait > 0 || !selectedCategory) return;
    setSubmitted({
      categoryCode: selectedCategory,
      itemName: normalizeText(name),
      pageNo: 1,
    });
  }

  const results = items.data?.data;
  return (
    <div
      className={styles.searchArea}
      data-busy={items.isFetching || undefined}
    >
      <form
        className={styles.searchForm}
        onSubmit={submit}
        noValidate
        aria-busy={items.isFetching}
      >
        <label className={styles.field}>
          <span>카테고리</span>
          <select
            value={selectedCategory ?? ""}
            onChange={(event) => setCategory(Number(event.target.value))}
            disabled={!categories.length}
          >
            {!categories.length && (
              <option value="">
                {options.isFetching ? "불러오는 중" : "카테고리 없음"}
              </option>
            )}
            {categories.map((group) => (
              <optgroup key={group.code} label={group.codeName}>
                <option value={group.code}>{group.codeName} 전체</option>
                {group.subs?.map((sub) => (
                  <option key={sub.code} value={sub.code}>
                    {sub.codeName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={styles.field} data-grow="">
          <span>재료 이름</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            maxLength={65}
            placeholder="예: 운명의 파편"
            aria-invalid={!!error}
            aria-describedby={error ? `${formId}-error` : undefined}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className={styles.secondaryPill}
          disabled={items.isFetching || wait > 0}
        >
          <Search size={15} aria-hidden="true" />{" "}
          {items.isFetching ? "검색 중" : "검색"}
        </button>
      </form>
      {error && (
        <p className={styles.inputError} id={`${formId}-error`} role="alert">
          {error}
        </p>
      )}
      {failure && <Notice failure={failure} wait={wait} />}
      {results && (
        <div className={styles.results} aria-live="polite">
          <p className={styles.caption}>
            1페이지 {results.items.length}개 · 전체 {count(results.totalCount)}
            개 · {time(results.observedAt)} 관측
          </p>
          {results.items.length === 0 ? (
            <p className={styles.empty}>
              검색 결과가 없어요. 이름이나 카테고리를 바꿔 보세요.
            </p>
          ) : (
            <ul className={styles.resultList}>
              {results.items.map((item) => {
                const added = rows.some((row) => row.item.id === item.id);
                const full = rows.length >= MAX_QUOTE_ITEMS;
                return (
                  <li key={item.id}>
                    <GameIcon
                      key={item.icon}
                      src={item.icon}
                      grade={item.grade}
                      size={40}
                    />
                    <div className={styles.resultText}>
                      <strong>{item.name}</strong>
                      <small>
                        {item.bundleCount}개 묶음 · 최저{" "}
                        {formatGold(item.currentMinPrice)} · 최근{" "}
                        {formatGold(item.recentPrice)} · 전일{" "}
                        {formatGold(item.yDayAvgPrice)}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={styles.outlinePill}
                      disabled={added || full}
                      onClick={() => submitted && add(item, submitted)}
                      aria-label={
                        added
                          ? `${item.name} 추가됨`
                          : `${item.name} 견적에 추가`
                      }
                    >
                      {added ? (
                        <>
                          <Check size={14} aria-hidden="true" /> 추가됨
                        </>
                      ) : (
                        <>
                          <Plus size={14} aria-hidden="true" /> 추가
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length >= MAX_QUOTE_ITEMS && (
            <p className={styles.caption}>
              한 번에 최대 {MAX_QUOTE_ITEMS}개까지 계산할 수 있어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QuantityField({
  row,
  field,
  label,
}: {
  row: PlanRow;
  field: "required" | "owned";
  label: string;
}) {
  const setQuantity = usePlan((state) => state.setQuantity);
  const id = useId();
  const value = row[field];
  const error =
    value === "" && field === "required" ? "" : quantityError(value);
  return (
    <label className={styles.quantity}>
      <span>{label}</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) =>
          setQuantity(row.item.id, field, event.target.value)
        }
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="0"
      />
      {error && (
        <small id={`${id}-error`} className={styles.inputError}>
          {error}
        </small>
      )}
    </label>
  );
}

function Plan() {
  const { enabled } = useLandingMotion();
  const { rows, remove } = usePlan();
  if (!rows.length)
    return (
      <p className={styles.empty}>
        아직 추가한 재료가 없어요. 위에서 검색해 견적에 추가하세요.
      </p>
    );
  return (
    <ul className={styles.planList}>
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <m.li
            key={row.item.id}
            initial={enabled ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={enabled ? { opacity: 0, y: -6 } : { opacity: 0 }}
            transition={
              enabled
                ? { type: "spring", bounce: 0, duration: 0.35 }
                : { duration: 0 }
            }
          >
            <GameIcon
              key={row.item.icon}
              src={row.item.icon}
              grade={row.item.grade}
              size={44}
            />
            <div className={styles.planText}>
              <strong>{row.item.name}</strong>
              <small>
                {row.item.bundleCount}개 묶음 · “{row.search.itemName}” 검색{" "}
                {row.search.pageNo}페이지
              </small>
            </div>
            <div className={styles.quantities}>
              <QuantityField row={row} field="required" label="필요" />
              <QuantityField row={row} field="owned" label="보유" />
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => remove(row.item.id)}
              aria-label={`${row.item.name} 견적에서 빼기`}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </m.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Result({ quote }: { quote: MaterialQuote }) {
  const basis = priceBases.find((item) => item.value === quote.priceBasis);
  const unpriced = quote.items.filter(
    (line) => line.purchase === null && line.status !== "COVERED_BY_INVENTORY",
  ).length;
  return (
    <Reveal className={styles.result}>
      <section aria-labelledby="quote-total">
        <p className={styles.kicker}>{basis?.label} 기준 견적</p>
        {quote.complete ? (
          <>
            <h2 id="quote-total" className={styles.total}>
              {formatGold(quote.totalCostGold)}
              <span>골드</span>
            </h2>
            <p className={styles.totalNote}>
              부족한 재료를 묶음 단위로 구매할 때의 금액이에요.
            </p>
          </>
        ) : (
          <>
            <h2 id="quote-total" className={styles.total} data-partial="">
              {formatGold(quote.knownCostGold)}
              <span>골드 · 계산된 항목만</span>
            </h2>
            <p className={styles.status}>
              미계산 {unpriced}개 포함 · 총액을 제공하지 않아요
            </p>
          </>
        )}
      </section>
      <ul className={styles.lines}>
        {quote.items.map((line) => {
          const copy = statusCopy[line.status];
          return (
            <li key={line.itemId} data-status={line.status}>
              <div className={styles.lineHead}>
                <strong>{line.itemName ?? `상품 ${line.itemId}`}</strong>
                <span
                  className={styles.lineStatus}
                  data-tone={
                    line.status === "PRICED"
                      ? "ok"
                      : line.status === "COVERED_BY_INVENTORY"
                        ? "neutral"
                        : "warn"
                  }
                >
                  {copy.label}
                </span>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>필요 · 보유</dt>
                  <dd>
                    {count(line.requiredQuantity)} · {count(line.ownedQuantity)}
                  </dd>
                </div>
                <div>
                  <dt>부족</dt>
                  <dd>{count(line.missingQuantity)}</dd>
                </div>
                {line.purchase && (
                  <>
                    <div>
                      <dt>구매</dt>
                      <dd>
                        {count(line.purchase.bundleQuantity)}묶음 ·{" "}
                        {count(line.purchase.purchaseQuantity)}개
                      </dd>
                    </div>
                    <div>
                      <dt>남는 수량</dt>
                      <dd>{count(line.purchase.surplusQuantity)}</dd>
                    </div>
                    <div>
                      <dt>비용</dt>
                      <dd className={styles.cost}>
                        {formatGold(line.purchase.costGold)} 골드
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {line.status !== "PRICED" && (
                <p className={styles.reason}>{copy.text}</p>
              )}
              {line.pricePerBundle !== null && (
                <p className={styles.caption}>
                  묶음({count(line.bundleCount)}개)당{" "}
                  {formatGold(line.pricePerBundle)} 골드 ·{" "}
                  {time(line.observedAt)} 관측
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <footer className={styles.resultFooter}>
        <p>
          {time(quote.calculatedAt)} 계산 · 규칙 {quote.ruleVersion}. 관측
          시각은 항목마다 다를 수 있으며 실시간 시세가 아니에요.
        </p>
        <p>
          판매 수수료·페온·재련 골드와 실링·이벤트 보정은 포함하지 않아요.
          표시된 가격에 실제로 살 수 있는 수량은 보장되지 않아요.
        </p>
      </footer>
    </Reveal>
  );
}

function MaterialQuoteContent() {
  const { enabled, paused, toggle } = useLandingMotion();
  const { basis, setBasis, rows } = usePlan();
  const quote = useMutation({
    mutationFn: (request: NonNullable<ReturnType<typeof toQuoteRequest>>) =>
      postMaterialQuote(request),
    retry: false,
  });
  const quoteFailure = failureOf(quote.error);
  const [searchFailure, setSearchFailure] = useState<MarketFailure | null>(
    null,
  );
  const wait = useCooldown([quoteFailure, searchFailure]);
  const request = toQuoteRequest(basis, rows);
  const resultRef = useRef<HTMLDivElement>(null);
  const searching = useIsFetching({ queryKey: ["market", "items"] }) > 0;
  const orb: OrbState = quote.isPending
    ? "solving"
    : searching
      ? "searching"
      : quote.data
        ? "breathing"
        : "composing";
  const basisHint = priceBases.find((item) => item.value === basis)?.hint;

  useEffect(() => {
    if (quote.data)
      resultRef.current?.scrollIntoView({
        behavior: enabled ? "smooth" : "instant",
        block: "start",
      });
  }, [quote.data, enabled]);

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#quote-main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          LOAKraken
        </Link>
        <nav className={styles.nav} aria-label="주요 메뉴">
          <Link href="/">캐릭터 검색</Link>
          <Link href="/tools/material-quote" aria-current="page">
            재료 견적
          </Link>
          <Link href="/tools/refining">재련 비용</Link>
        </nav>
        <button
          type="button"
          className={styles.motionButton}
          aria-label={paused ? "모션 재생" : "모션 일시정지"}
          aria-pressed={paused}
          onClick={toggle}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </header>
      <main id="quote-main">
        <section className={styles.hero} aria-labelledby="quote-heading">
          <div className={styles.heroOrb} aria-hidden="true">
            <ThinkingOrb
              state={orb}
              size={64}
              theme="light"
              color="#0066cc"
              speed={0.7}
              paused={!enabled}
            />
          </div>
          <p className={styles.heroKicker}>거래소 도구</p>
          <h1 id="quote-heading">재료 구매 견적</h1>
          <p className={styles.heroCopy}>필요한 만큼만, 지금 시세로.</p>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 캐릭터 검색으로
          </Link>
        </section>

        <div className={styles.band}>
          <div className={styles.workspace}>
            <section className={styles.card} aria-labelledby="basis-heading">
              <p className={styles.step}>1</p>
              <h2 id="basis-heading">가격 기준</h2>
              <div
                className={styles.segmented}
                role="radiogroup"
                aria-label="가격 기준"
              >
                {priceBases.map((item) => (
                  <label
                    key={item.value}
                    data-checked={basis === item.value || undefined}
                  >
                    <input
                      type="radio"
                      name="price-basis"
                      value={item.value}
                      checked={basis === item.value}
                      onChange={() => setBasis(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <p className={styles.hint}>{basisHint}</p>
            </section>

            <section className={styles.card} aria-labelledby="items-heading">
              <p className={styles.step}>2</p>
              <h2 id="items-heading">
                재료{" "}
                <span className={styles.countLabel}>
                  {rows.length}/{MAX_QUOTE_ITEMS}
                </span>
              </h2>
              <ItemSearch wait={wait} onRateLimit={setSearchFailure} />
              <h3 className={styles.subheading}>견적에 넣은 재료</h3>
              <Plan />
            </section>

            <section className={styles.card} aria-labelledby="calc-heading">
              <p className={styles.step}>3</p>
              <h2 id="calc-heading">계산</h2>
              <p className={styles.hint}>
                부족 수량 = 필요 − 보유. 묶음 단위로 올림해 구매하고, 남는
                수량을 함께 보여줘요. 결과는 저장하지 않아요.
              </p>
              {quoteFailure && <Notice failure={quoteFailure} wait={wait} />}
              <button
                type="button"
                className={styles.primaryPill}
                disabled={!request || quote.isPending || wait > 0}
                onClick={() => request && quote.mutate(request)}
              >
                {quote.isPending ? (
                  <>
                    <ThinkingOrb
                      state="solving"
                      size={20}
                      theme="dark"
                      paused={!enabled}
                      aria-hidden="true"
                    />{" "}
                    계산 중
                  </>
                ) : wait > 0 ? (
                  `${wait}초 후 계산`
                ) : (
                  "견적 계산"
                )}
              </button>
              {!request && rows.length > 0 && (
                <p className={styles.caption}>
                  모든 재료의 필요·보유 수량을 정수로 입력해 주세요.
                </p>
              )}
            </section>
          </div>
        </div>

        <div ref={resultRef} className={styles.resultWrap}>
          {quote.data && (
            <Result
              key={quote.data.data.calculatedAt}
              quote={quote.data.data}
            />
          )}
        </div>
      </main>
      <footer className={styles.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공식 거래소 시세 기반 계산
      </footer>
    </div>
  );
}

export function MaterialQuoteTool() {
  return (
    <LandingMotion>
      <MaterialQuoteContent />
    </LandingMotion>
  );
}
