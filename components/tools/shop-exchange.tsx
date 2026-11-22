"use client";

// (ours, M50) 상점 교환 효율: the standing shops' rows in gold per 1 currency, ranked per shop, and a cart. Market
// items at the official market price; boxes, choice boxes, bound and unpriced items at the user's own value (kept in
// this browser), ranked only once they have one; rows not confirmed yet shown as '확인 중', never ranked
// (lib/tools/shop-exchange.ts). Every row shows the date its data was checked.
// A7: the list keeps its order while only prices change (a minute refresh never reorders it); typed values apply on
// blur or Enter, so the row being typed in never moves; the list is held unseen until the first prices land.
import { HubTabs } from "@/components/site/hub-tabs";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coin } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { MarketQueryError, postMaterialPricesAll } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type PriceBasis } from "@/lib/market/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { oneOfCodec, useUrlState, type UrlCodec } from "@/lib/tools/url-state";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MINUTE, useClock } from "@/components/home/clock";
import { goldText } from "@/lib/tools/format";
import {
  SHOP_DATA,
  cartMax,
  cartSummary,
  rankShop,
  rowDate,
  shopMarketNames,
  type RowValue,
  type ShopRow,
  type UserValues,
} from "@/lib/tools/shop-exchange";
import quote from "./material-quote.module.css";
import styles from "./shop-exchange.module.css";

const SHOP_IDS = SHOP_DATA.shops.map((shop) => shop.id);
const ALL_ROWS = new Map(SHOP_DATA.shops.flatMap((shop) => shop.rows.map((row) => [row.id, row] as const)));
const per = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

/** The cart in the address: 'raid-03:2,single-02:1' (unknown rows and bad counts dropped, counts clamped). */
const cartCodec: UrlCodec<Record<string, number>> = {
  parse: (raw) => {
    const cart: Record<string, number> = {};
    for (const part of raw.split(",")) {
      const [id, n] = part.split(":");
      const row = ALL_ROWS.get(id);
      const count = Number(n);
      if (row && Number.isInteger(count) && count > 0) cart[id] = Math.min(count, cartMax(row));
    }
    return cart;
  },
  format: (cart) =>
    Object.entries(cart)
      .map(([id, n]) => `${id}:${n}`)
      .join(","),
};
const EMPTY_CART: Record<string, number> = {};

/** The user's own values (gold for 1 of each item), in this browser only; read on the client after the first paint. */
const VALUES_KEY = "loakraken.shop-exchange.values";
let memoryValues: string | null = null;
const valueListeners = new Set<() => void>();
const readValues = () => {
  if (memoryValues !== null) return memoryValues;
  try {
    return window.localStorage.getItem(VALUES_KEY) ?? "{}";
  } catch {
    return "{}";
  }
};
const subscribeValues = (listener: () => void) => {
  valueListeners.add(listener);
  return () => {
    valueListeners.delete(listener);
  };
};
function writeValues(next: UserValues) {
  memoryValues = JSON.stringify(next);
  try {
    window.localStorage.setItem(VALUES_KEY, memoryValues);
  } catch {
    // Storage blocked: kept for this visit.
  }
  valueListeners.forEach((listener) => listener());
}
function useShopValues(): [UserValues, (key: string, value: number | null) => void] {
  const raw = useSyncExternalStore(subscribeValues, readValues, () => "{}");
  const values = useMemo<UserValues>(() => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "number" && v > 0)) as UserValues;
    } catch {
      return {};
    }
  }, [raw]);
  const set = (key: string, value: number | null) => {
    const next: Record<string, number> = { ...values };
    if (value == null) delete next[key];
    else next[key] = value;
    writeValues(next);
  };
  return [values, set];
}

/** What a row without a value is waiting for, said in words. */
const WAITING: Record<string, string> = {
  BOX: "구성 · 확률 미공개",
  CHOICE: "선택 상자",
  BOUND: "귀속 · 시세 없음",
  NO_PRICE: "거래소 시세 없음",
};

function limitText(row: ShopRow, shopId: string) {
  if (row.limit) return `주 ${row.limit.count}회${row.limit.roster ? " · 원정대" : ""}`;
  if (row.checking) return "한도 확인 중";
  return shopId === "raid" ? "제한 없음" : "";
}

/** The user's value for one item: typed freely, applied on blur or Enter (the list re-ranks then, not per key). */
function ValueField({ label, value, onCommit }: { label: string; value: number | undefined; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value != null ? String(value) : "");
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/,/g, ""));
    onCommit(draft.trim() === "" || !(n > 0) ? null : n);
    setDraft(null);
  };
  return (
    <input
      className={styles.valueInput}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="내 값(골드)"
      aria-label={label}
      value={text}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d.,]/g, "").slice(0, 12))}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
    />
  );
}

function RowValueLine({
  row,
  value,
  values,
  setValue,
}: {
  row: ShopRow;
  value: RowValue;
  values: UserValues;
  setValue: (key: string, v: number | null) => void;
}) {
  if (value.state === "CHECKING")
    return (
      <p className={styles.valueLine}>
        <span className={styles.checking}>확인 중</span>
        <span className={styles.why}>{value.reason}</span>
      </p>
    );
  const key = value.state === "NEEDS_VALUE" ? value.key : row.market ?? row.item;
  const perUnit = row.basis === "DIRECT";
  const field =
    value.state === "NEEDS_VALUE" || value.from === "USER" ? (
      <ValueField
        label={`${key} ${perUnit ? "1개" : "1개(상자)"} 값(골드)`}
        value={values[key]}
        onCommit={(v) => setValue(key, v)}
      />
    ) : null;
  if (value.state === "NEEDS_VALUE")
    return (
      <p className={styles.valueLine}>
        <span className={styles.waiting}>{WAITING[value.why]}</span>
        {field}
      </p>
    );
  return (
    <p className={styles.valueLine}>
      <b className={styles.gold}>{goldText(value.gold)}G</b>
      <span className={styles.per}>재화 1개당 {per(value.perCurrency)}G</span>
      {field}
    </p>
  );
}

export function ShopExchangeTool() {
  // Every input lives in the address (back and reload keep it), the typed values in this browser.
  const [shopId, setShopId] = useUrlState("shop", SHOP_IDS[0], oneOfCodec(SHOP_IDS));
  const [basis, setBasis] = useUrlState<PriceBasis>("price", "CURRENT_MIN_PRICE", oneOfCodec(priceBases.map((b) => b.value)));
  const [cart, setCart] = useUrlState("cart", EMPTY_CART, cartCodec);
  const [values, setValue] = useShopValues();
  const listId = useId();
  const shop = SHOP_DATA.shops.find((s) => s.id === shopId) ?? SHOP_DATA.shops[0];

  const requested = useMemo(() => shopMarketNames(), []);
  const prices = useQuery({
    queryKey: ["shop-exchange-prices", basis, requested],
    queryFn: ({ signal }) => postMaterialPricesAll({ priceBasis: basis, names: requested }, signal),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(prices.error);
  const now = useClock(MINUTE);
  const market = useMemo(
    () =>
      new Map(
        (prices.data?.data.items ?? [])
          .filter((p) => p.status === "PRICED" && p.unitPriceGold != null)
          .map((p) => [p.name, p.unitPriceGold as number]),
      ),
    [prices.data],
  );
  const price = (name: string) => market.get(name) ?? null;
  const loaded = !!prices.data;
  const failure =
    prices.error instanceof MarketQueryError ? prices.error.info : prices.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const observedAt = (prices.data?.data.items ?? []).map((p) => p.observedAt).sort().at(-1);
  const ago =
    observedAt && now != null
      ? (() => {
          const minutes = Math.max(0, Math.floor((now - Date.parse(observedAt)) / MINUTE));
          return minutes === 0 ? "방금 기준" : `${minutes}분 전 기준`;
        })()
      : "";

  const ranked = rankShop(shop, price, values);
  // The order follows the user's own choices (shop, basis, typed values, the first prices, a re-sort), not every
  // price refresh: values update in place; adjusted during render (derived state).
  const [resort, setResort] = useState(0);
  const orderKey = `${shop.id}|${basis}|${loaded}|${JSON.stringify(values)}|${resort}`;
  const [order, setOrder] = useState({ key: "", ids: [] as string[] });
  if (order.key !== orderKey) setOrder({ key: orderKey, ids: ranked.map((r) => r.row.id) });
  const byId = new Map(ranked.map((r) => [r.row.id, r]));
  const shown = (order.key === orderKey ? order.ids : ranked.map((r) => r.row.id)).map((id) => byId.get(id)!).filter(Boolean);
  const stale = shown.some((r, i) => r.row.id !== ranked[i]?.row.id);
  const waiting = !loaded && !failure;

  const summary = cartSummary(cart, price, values);
  const toggle = (row: ShopRow) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[row.id]) delete next[row.id];
      else next[row.id] = 1;
      return next;
    });
  const setCount = (row: ShopRow, count: number) =>
    setCart((prev) => ({ ...prev, [row.id]: Math.max(1, Math.min(cartMax(row), Math.floor(count) || 1)) }));
  const cartRows = Object.keys(cart)
    .map((id) => ALL_ROWS.get(id))
    .filter((row): row is ShopRow => !!row);

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#shop-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="shop-main">
        <section className={quote.hero} aria-labelledby="shop-heading">
          <p className={quote.heroKicker}>골드 효율</p>
          <h1 id="shop-heading">상점 교환 효율</h1>
          <p className={quote.heroCopy}>상시 상점에서 재화 1개로 얻는 골드 가치를 지금 거래소 시세로.</p>
          <span className={quote.heroIcon} aria-hidden="true">
            <Coin size={18} />
          </span>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
          <HubTabs hub="gold" />
        </section>

        <div className={quote.band}>
          <div className={styles.controls}>
            <SegmentedControl aria-label="상점" value={shop.id} onValueChange={(v) => setShopId(v)}>
              {SHOP_DATA.shops.map((s) => (
                <SegmentedItem key={s.id} value={s.id}>
                  {s.name.replace(" 교환", "")}
                </SegmentedItem>
              ))}
            </SegmentedControl>
            <SegmentedControl aria-label="시세 기준" value={basis} onValueChange={(v) => setBasis(v as PriceBasis)}>
              {priceBases.map((item) => (
                <SegmentedItem key={item.value} value={item.value}>
                  {item.label}
                </SegmentedItem>
              ))}
            </SegmentedControl>
            <p className={styles.small}>
              거래소 {priceBases.find((b) => b.value === basis)?.label} 기준, 1분마다 새로 불러와요.
              <span className={styles.ago}>{ago}</span>
            </p>
            {failure && (
              <div className={quote.notice}>
                <div role="alert">
                  <strong>시세를 불러오지 못했어요</strong>
                  <p>{marketFailureCopy(failure).text}</p>
                </div>
                <button
                  type="button"
                  className={quote.outlinePill}
                  aria-disabled={prices.isFetching || limit.seconds > 0 || undefined}
                  onClick={() => !prices.isFetching && limit.seconds === 0 && prices.refetch()}
                >
                  {retryLabel(limit.seconds, "시세 다시 불러오기")}
                </button>
              </div>
            )}
          </div>

          <div className={styles.workspace}>
            <section className={styles.list} aria-labelledby={`${listId}-heading`} aria-busy={prices.isPlaceholderData || undefined}>
              <h2 id={`${listId}-heading`} className={styles.sectionTitle}>
                {shop.name} · 재화 1개당 가치 순
              </h2>
              <p className={styles.small}>{shop.limitNote}</p>
              {/* Always drawn (a button appearing would move the list). */}
              <p className={styles.order}>
                <span aria-live="polite">{stale ? "시세가 바뀌어 지금 값과 순서가 달라요." : "재화 1개당 가치가 높은 순서예요."}</span>
                <button type="button" className={quote.outlinePill} onClick={() => setResort((n) => n + 1)}>
                  지금 시세로 다시 정렬
                </button>
              </p>
              <ol className={styles.rows} aria-label={`${shop.name} 품목`} data-waiting={waiting ? "" : undefined} aria-busy={waiting || undefined}>
                {shown.map(({ row, value }) => {
                  const position = value.state === "OK" ? shown.filter((r) => r.value.state === "OK").findIndex((r) => r.row.id === row.id) + 1 : null;
                  const inCart = !!cart[row.id];
                  return (
                    <li key={row.id} className={styles.row}>
                      <div className={styles.rowHead}>
                        <span className={styles.rank} aria-label={position ? `${position}위` : undefined}>
                          {position ?? "-"}
                        </span>
                        <strong className={styles.item}>
                          {row.item} <span className={styles.qty}>×{row.qty.toLocaleString("ko-KR")}</span>
                        </strong>
                        <button
                          type="button"
                          className={`${styles.add} hit-44`}
                          aria-pressed={inCart}
                          aria-label={`${row.item} ${row.cost.toLocaleString("ko-KR")} ${row.currency} 담기`}
                          onClick={() => toggle(row)}
                        >
                          {/* One label: the pressed state (and its look) says it is in the cart. */}
                          담기
                        </button>
                      </div>
                      <p className={styles.meta}>
                        {row.cost.toLocaleString("ko-KR")} {row.currency}
                        {limitText(row, shop.id) && ` · ${limitText(row, shop.id)}`}
                        {row.note && ` · ${row.note}`} · 확인 {rowDate(row)}
                      </p>
                      <RowValueLine row={row} value={value} values={values} setValue={setValue} />
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={styles.cart} aria-labelledby={`${listId}-cart`}>
              <h2 id={`${listId}-cart`} className={styles.sectionTitle}>
                담은 교환
              </h2>
              {cartRows.length === 0 ? (
                <p className={styles.small}>품목의 ‘담기’를 누르면 필요한 재화와 가치를 여기서 더해요.</p>
              ) : (
                <>
                  <ul className={styles.cartLines} aria-label="담은 품목">
                    {cartRows.map((row) => (
                      <li key={row.id}>
                        <span className={styles.cartItem}>
                          {row.item} ×{row.qty.toLocaleString("ko-KR")}
                        </span>
                        <label className={styles.count}>
                          <span className={styles.sr}>{row.item} 교환 횟수</span>
                          <input
                            type="number"
                            min={1}
                            max={cartMax(row)}
                            value={cart[row.id]}
                            onChange={(event) => setCount(row, Number(event.target.value))}
                          />
                          회
                        </label>
                        <button type="button" className={`${styles.remove} hit-44`} aria-label={`${row.item} 빼기`} onClick={() => toggle(row)}>
                          빼기
                        </button>
                      </li>
                    ))}
                  </ul>
                  <dl className={styles.totals} aria-live="polite">
                    {summary.spend.map((s) => (
                      <div key={s.currency}>
                        <dt>{s.currency}</dt>
                        <dd>
                          {s.cost.toLocaleString("ko-KR")}개
                          <span className={styles.per}>{s.perCurrency == null ? " · 1개당 값 없음" : ` · 1개당 ${per(s.perCurrency)}G`}</span>
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt>골드 가치</dt>
                      <dd className={styles.gold}>{goldText(summary.gold)}G</dd>
                    </div>
                    <div>
                      <dt>순이익</dt>
                      <dd className={styles.gold}>{goldText(summary.net)}G</dd>
                    </div>
                  </dl>
                  <p className={styles.small}>
                    순이익은 골드 가치에서 재화를 거래소에 팔면 받을 값을 뺀 값이에요
                    {summary.unpricedCurrencies.length > 0 && `. 시세가 없는 재화(${summary.unpricedCurrencies.join(" · ")})는 0으로 셌어요`}.
                    {summary.unvalued > 0 && ` 값이 없는 ${summary.unvalued}개는 가치에 넣지 않았어요.`}
                  </p>
                  <button type="button" className={quote.outlinePill} onClick={() => setCart(EMPTY_CART)}>
                    모두 빼기
                  </button>
                </>
              )}
            </section>
          </div>

          <p className={styles.note}>
            상자의 구성과 확률이 공개되지 않았거나 귀속 · 시세가 없는 품목은 직접 넣은 값으로 셈해요(이 브라우저에만 저장).
            값을 넣기 전에는 순위에 넣지 않아요. 수량이나 한도를 확인하고 있는 줄은 ‘확인 중’으로 두고 순위에서 뺐어요.
          </p>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 거래소 시세 기반 계산</footer>
    </div>
  );
}
