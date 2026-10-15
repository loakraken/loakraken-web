"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { Add, ArrowLeft, Calculator, CloseCircle, SearchNormal, TickCircle } from "@/components/ui/icons";
import { GameIcon } from "@/components/character/imagery";
import { PillTab, PillTabs } from "@/components/ui/pill-tabs";
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
  quoteStatusCopy,
  type ItemsEnvelope,
  type MarketFailure,
  type MarketSearch,
  type MaterialQuote,
  type PriceBasis,
} from "@/lib/market/model";
import { toQuoteRequest, usePlan, type PlanRow } from "@/lib/market/store";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
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

/** Debounce for searching while typing (PM 총괄 2026-10-16). */
const LIVE_SEARCH_MS = 200;
/** A name ends in a lone jamo while a syllable is still being composed ("운" → "ㅇ", "우"); search what is whole. */
const searchable = (text: string) => normalizeText(text).replace(/[\u3131-\u318E]+$/, "").trim();

function ItemSearch({
  wait,
  onRateLimit,
  initialCategory,
}: {
  wait: number;
  onRateLimit: (failure: MarketFailure) => void;
  initialCategory: number | null;
}) {
  const formId = useId();
  const listId = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const chipRow = useRef<HTMLDivElement>(null);
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
  const [category, setCategory] = useState<number | null>(initialCategory);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<MarketSearch | null>(null);
  // A search pressed before the category list arrives waits for it instead
  // of failing with a category error the user could not have avoided: the
  // name is kept and the search starts as soon as a category exists.
  const [pending, setPending] = useState<string | null>(null);
  // Search while typing: 200ms after the last keystroke (Korean included —
  // the input value already holds the syllable being composed).
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  // A linked code the list does not have falls back like no choice at all.
  const known = (code: number | null) =>
    code !== null &&
    categories.some((group) => group.code === code || group.subs?.some((sub) => sub.code === code));
  const selectedCategory =
    (known(category) ? category : null) ??
    categories.find((item) => item.code === 50000)?.code ??
    categories[0]?.code ??
    null;
  const activeGroup =
    categories.find(
      (group) => group.code === selectedCategory || group.subs?.some((sub) => sub.code === selectedCategory),
    ) ?? null;
  // Keep the chosen chip inside its row (a deep link to a later kind); scrolls
  // the row only, never the page.
  useEffect(() => {
    const row = chipRow.current;
    const chip = row?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!row || !chip) return;
    const right = chip.offsetLeft + chip.offsetWidth + 24 - row.clientWidth;
    if (chip.offsetLeft < row.scrollLeft) row.scrollLeft = chip.offsetLeft;
    else if (right > row.scrollLeft) row.scrollLeft = right;
  }, [selectedCategory]);

  function choose(code: number) {
    // A waiting search that already ran keeps its category, like any other
    // search: changing the category alone never re-runs it.
    if (!submitted && search) setSubmitted(search);
    setPending(null);
    setCategory(code);
    setError("");
    router.replace(`?${new URLSearchParams({ category: String(code) })}`, { scroll: false });
  }
  const search: MarketSearch | null =
    submitted ??
    (pending !== null && selectedCategory
      ? { categoryCode: selectedCategory, itemName: pending, pageNo: 1 }
      : null);
  const waiting = !selectedCategory && options.isFetching;
  // A complete earlier result (every match fit on page 1) whose name the new
  // one contains already holds every new match: filter it here, no request.
  // A few cached searches at most: read straight from the cache each render.
  const local = (() => {
    if (!search) return null;
    for (const [key, data] of queryClient.getQueriesData<ItemsEnvelope>({ queryKey: ["market", "items"] })) {
      const earlier = key[2] as MarketSearch | null;
      const page = data?.data;
      if (!earlier || !page || earlier.categoryCode !== search.categoryCode || earlier.pageNo !== 1) continue;
      if (page.totalCount > page.items.length || !search.itemName.includes(earlier.itemName)) continue;
      if (earlier.itemName === search.itemName) return null;
      const items = page.items.filter((item) => item.name.includes(search.itemName));
      return { ...page, items, totalCount: items.length };
    }
    return null;
  })();
  const items = useQuery({
    queryKey: ["market", "items", search],
    queryFn: ({ signal }) => fetchMarketItems(search!, signal),
    enabled: !!search && !local,
    // Typing changes the key every few letters: keep the last list on screen
    // until the new one lands, so it does not empty and refill (perf-placeholder-data).
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const failure = failureOf(options.error) ?? failureOf(items.error);
  useEffect(() => {
    if (failure?.retryAt) onRateLimit(failure);
  }, [failure, onRateLimit]);

  // Typing searches by itself after a short pause; Enter or the button still
  // searches at once.
  useEffect(() => {
    const text = searchable(name);
    const timer = setTimeout(() => {
      setActive(-1);
      if (!text) {
        setSubmitted(null);
        setPending(null);
        return;
      }
      if (searchError(1, text)) return;
      if (!selectedCategory) {
        if (options.isFetching) setPending(text);
        return;
      }
      setPending(null);
      setSubmitted((prev) =>
        prev?.itemName === text && prev.categoryCode === selectedCategory
          ? prev
          : { categoryCode: selectedCategory, itemName: text, pageNo: 1 },
      );
    }, LIVE_SEARCH_MS);
    return () => clearTimeout(timer);
    // Only typing starts a search; a category change alone never re-runs it (see choose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  function submit(event: FormEvent) {
    event.preventDefault();
    // The button stays focusable while busy (aria-disabled); guard here.
    if (items.isFetching || wait > 0) return;
    if (waiting) {
      const issue = searchError(1, name);
      setError(issue);
      if (!issue) setPending(normalizeText(name));
      return;
    }
    const issue = searchError(selectedCategory, name);
    setError(issue);
    if (issue || wait > 0 || !selectedCategory) return;
    setPending(null);
    setSubmitted({
      categoryCode: selectedCategory,
      itemName: normalizeText(name),
      pageNo: 1,
    });
  }

  const results = local ?? items.data?.data;
  const shown = open && !!results && results.items.length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;
  const pick = (index: number) => {
    const item = results?.items[index];
    if (!item || !search || rows.length >= MAX_QUOTE_ITEMS || rows.some((row) => row.item.id === item.id)) return;
    add(item, search);
  };
  // Combobox keys (WAI-ARIA): ↑/↓ move through the results, Enter adds the
  // one in focus (or searches when none is), Esc closes the list.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results?.items.length ?? 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!count) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => (prev < 0 ? (step > 0 ? 0 : count - 1) : (prev + step + count) % count));
    } else if (event.key === "Enter" && shown && active >= 0) {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape" && shown) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }
  return (
    <div
      className={styles.searchArea}
      data-busy={items.isFetching || undefined}
    >
      {/* 사용자 10-11 00:04: the category was a plain drop-down. Groups are
          the shared pill tabs (#417); the group's own kinds are chips. */}
      <div className={styles.categoryPicker} aria-busy={!categories.length || undefined}>
        {categories.length ? (
          <>
            <PillTabs
              value={activeGroup?.code ?? null}
              onValueChange={(value) => choose(Number(value))}
              aria-label="카테고리"
            >
              {categories.map((group) => (
                <PillTab key={group.code} value={group.code}>
                  {group.codeName}
                </PillTab>
              ))}
            </PillTabs>
            {activeGroup && (activeGroup.subs?.length ?? 0) > 0 && (
              <div ref={chipRow} className={styles.chips} role="group" aria-label={`${activeGroup.codeName} 분류`}>
                {[{ code: activeGroup.code, codeName: "전체" }, ...(activeGroup.subs ?? [])].map((sub) => (
                  <button
                    key={sub.code}
                    type="button"
                    className={`${styles.chip} hit-44`}
                    aria-pressed={selectedCategory === sub.code}
                    onClick={() => choose(sub.code)}
                  >
                    {sub.codeName}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className={styles.categoryLoading} role="status">
            {options.isFetching ? "카테고리를 불러오고 있어요." : "카테고리를 불러오지 못했어요."}
          </p>
        )}
      </div>
      {/* The results float under the field like any combobox list, so
          results arriving while typing never push the page (A7, PM-프론트
          #855). Focus leaving the box closes them. */}
      <div
        className={styles.searchBox}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            setActive(-1);
          }
        }}
      >
        <form
          className={styles.searchForm}
          onSubmit={submit}
          noValidate
          aria-busy={items.isFetching}
        >
          <label className={styles.field} data-grow="">
            <span>재료 이름</span>
            <input
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={shown}
              aria-controls={listId}
              aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
              name="itemName"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={65}
              placeholder="예: 운명의 파편…"
              aria-invalid={!!error}
              aria-describedby={error ? `${formId}-error` : undefined}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className={styles.secondaryPill}
            aria-disabled={items.isFetching || wait > 0 || undefined}
            aria-busy={items.isFetching || undefined}
          >
            <SearchNormal size={15} aria-hidden="true" />{" "}
            {/* Both labels share one grid cell, so the button keeps the wider one's width. */}
            <span className={styles.searchLabel}>
              <span data-shown={!items.isFetching || undefined}>검색</span>
              <span data-shown={items.isFetching || undefined}>검색 중…</span>
            </span>
          </button>
        </form>
        {results && open && (
          <div className={styles.results}>
            {/* Only the count is announced: reading the whole list on every keystroke would drown the input. */}
            {/* Redrawn as a new line when its text changes, so the words after
                a number never slide as the number's width changes (A6). */}
            <p className={styles.caption} role="status">
              <span key={`${results.items.length}-${results.totalCount}-${results.observedAt}`}>
                1페이지 {results.items.length}개 · 전체 {count(results.totalCount)}
                개 · {time(results.observedAt)} 기준
              </span>
            </p>
            {results.items.length === 0 ? (
              <p className={styles.empty}>
                검색 결과가 없어요. 이름이나 카테고리를 바꿔 보세요.
              </p>
            ) : (
              <ul className={styles.resultList} id={listId} role="listbox" aria-label="검색 결과" hidden={!shown}>
                {results.items.map((item, index) => {
                  const added = rows.some((row) => row.item.id === item.id);
                  const full = rows.length >= MAX_QUOTE_ITEMS;
                  return (
                    // 모션 목록(재료 시세): a new result list enters 30ms apart (max 8
                    // steps). Items keep their key, so a repeat search does not replay.
                    // The whole row is the option: a click or Enter adds it.
                    <li
                      key={item.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={active === index}
                      aria-disabled={added || full || undefined}
                      aria-label={added ? `${item.name} 추가됨` : `${item.name} 견적에 추가`}
                      className="k-reveal"
                      style={{ "--i": index } as CSSProperties}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(index)}
                    >
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
                      <span className={styles.outlinePill} aria-hidden="true" data-disabled={added || full || undefined}>
                        {added ? (
                          <>
                            <TickCircle size={14} aria-hidden="true" /> 추가됨
                          </>
                        ) : (
                          <>
                            <Add size={14} aria-hidden="true" /> 추가
                          </>
                        )}
                      </span>
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
      {pending !== null && !search && options.isFetching && (
        <p className={styles.caption} role="status">
          카테고리 목록을 받는 대로 검색할게요.
        </p>
      )}
      {error && (
        <p className={styles.inputError} id={`${formId}-error`} role="alert">
          {error}
        </p>
      )}
      {failure && <Notice failure={failure} wait={wait} />}
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
              <CloseCircle size={16} aria-hidden="true" />
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
          const copy = quoteStatusCopy(line.status);
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
                  {time(line.observedAt)} 기준
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <footer className={styles.resultFooter}>
        <p>
          {time(quote.calculatedAt)} 계산 · 규칙 {quote.ruleVersion}. 시세
          기준 시각은 항목마다 따로 수집한 시각이고, 실시간 시세가 아니에요.
        </p>
        <p>
          판매 수수료·페온·재련 골드와 실링·이벤트 보정은 포함하지 않아요.
          표시된 가격에 실제로 살 수 있는 수량은 보장되지 않아요.
        </p>
      </footer>
    </Reveal>
  );
}

function MaterialQuoteContent({ initialCategory }: { initialCategory: number | null }) {
  const { enabled } = useLandingMotion();
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
      <SiteHeader />
      <main id="quote-main">
        <section className={styles.hero} aria-labelledby="quote-heading">
          <span className={styles.heroIcon} aria-hidden="true">
            <Calculator size={18} />
          </span>
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
              <SegmentedControl
                className={styles.basis}
                aria-label="가격 기준"
                value={basis}
                onValueChange={(value) => setBasis(value as PriceBasis)}
              >
                {priceBases.map((item) => (
                  <SegmentedItem key={item.value} value={item.value}>
                    {item.label}
                  </SegmentedItem>
                ))}
              </SegmentedControl>
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
              <ItemSearch wait={wait} onRateLimit={setSearchFailure} initialCategory={initialCategory} />
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
                disabled={!request}
                aria-disabled={quote.isPending || wait > 0 || undefined}
                aria-busy={quote.isPending || undefined}
                onClick={() =>
                  request && !quote.isPending && wait === 0 && quote.mutate(request)
                }
              >
                {quote.isPending ? (
                  "계산 중"
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
        LOAKraken · 공식 거래소 시세 기반 계산
      </footer>
    </div>
  );
}

export function MaterialQuoteTool({ initialCategory = null }: { initialCategory?: number | null }) {
  return (
    <LandingMotion>
      <MaterialQuoteContent initialCategory={initialCategory} />
    </LandingMotion>
  );
}
