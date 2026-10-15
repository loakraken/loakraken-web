"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Box } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type MaterialPrice, type PriceBasis } from "@/lib/market/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MINUTE, useClock } from "@/components/home/clock";
import {
  SHOP_DATA,
  marketNames,
  onSale,
  splitBySale,
  packageValue,
  parseRate,
  UNTRADEABLE,
  type PackageValue,
  type UnitPrice,
  type ShopPackage,
} from "@/lib/tools/loa-shop";
import quote from "./material-quote.module.css";
import { goldText, signedGold } from "@/lib/tools/format";
import styles from "./loa-shop.module.css";

/** The typed rate stays in this browser only (never sent anywhere). */
const RATE_KEY = "loakraken.loa-shop.rate";
// A tiny store over localStorage: read on the client only (the server and the
// first paint see ""), and kept in memory when storage is blocked.
let memoryRate: string | null = null;
const rateListeners = new Set<() => void>();
function readRate() {
  if (memoryRate !== null) return memoryRate;
  try {
    return window.localStorage.getItem(RATE_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeRate(value: string) {
  memoryRate = value;
  try {
    if (value) window.localStorage.setItem(RATE_KEY, value);
    else window.localStorage.removeItem(RATE_KEY);
  } catch {
    // Storage blocked: the value still works for this visit.
  }
  rateListeners.forEach((listener) => listener());
}
const subscribeRate = (listener: () => void) => {
  rateListeners.add(listener);
  return () => {
    rateListeners.delete(listener);
  };
};
// The only comparison basis for this tool rounds the absolute value half away
// from zero (−1,087.5 → −1,088; PM 총괄 2026-10-14).
const count = (value: number) => goldText(value, "awayFromZero");
const signed = (value: number) => signedGold(value, "awayFromZero");
const UNKNOWN = "미확인";
const NOT_TRADED = "거래 불가";
const EXCLUDED = "제외";
/** "거래 불가 2개 제외 · 페온 1개 제외" under the total: said in words, not by colour alone. 페온 is known before prices arrive. */
const excludedNote = (value: PackageValue, priced: boolean) =>
  [
    priced && value.untradeable.length ? `거래 불가 ${value.untradeable.length}개 제외` : "",
    value.pheon.length ? `페온 ${value.pheon.length}개 제외` : "",
  ]
    .filter(Boolean)
    .join(" · ");

const unitText = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: value < 1 ? 4 : 2 });
const agoText = (now: number, iso: string) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE));
  return minutes === 0 ? "방금 기준" : `${minutes}분 전 기준`;
};

/**
 * A right-aligned figure drawn as a new node whenever it changes: rewriting the
 * text in place slid it sideways as its width changed (prices arriving and the
 * minute refresh, A6).
 */
function Figure({ text }: { text: string }) {
  return <span key={text}>{text}</span>;
}

function Verdict({ value, rate, priced }: { value: PackageValue; rate: number | null; priced: boolean }) {
  // Always two lines, so prices or the rate arriving only change text (A6·A7).
  if (!priced)
    return (
      <div className={styles.verdict}>
        <p>시세를 불러오고 있어요.</p>
        <p aria-hidden="true">&nbsp;</p>
      </div>
    );
  if (value.onlyPheon)
    return (
      <div className={styles.verdict}>
        <p>페온만 들어 있어 골드로 매길 구성품이 없어요.</p>
        <p>페온의 골드 값은 정하지 않아 이득을 계산하지 않아요.</p>
      </div>
    );
  if (value.gain != null)
    return (
      <div className={styles.verdict}>
        <p>
          로열 크리스탈로 환산한 가치 <b>{count(value.royalValue!)}</b>
        </p>
        <p>
          판매가보다{" "}
          <b className={signed(value.gain) === "0" ? undefined : value.gain > 0 ? styles.up : styles.down}>{signed(value.gain)}</b> 로열 크리스탈
        </p>
      </div>
    );
  return (
    <div className={styles.verdict}>
      <p>{value.unknown.length ? `${UNKNOWN} 구성품이 있어 이득을 계산하지 않았어요.` : "교환소 시세를 넣으면 이득을 계산해요."}</p>
      <p>{rate == null ? "아래 표의 골드 가치와 판매가를 나란히 보세요." : `${UNKNOWN} 구성품은 합계에서 뺐어요.`}</p>
    </div>
  );
}

function PackageCard({
  pkg,
  value,
  rate,
  priced,
  now,
}: {
  pkg: ShopPackage;
  value: PackageValue;
  rate: number | null;
  priced: boolean;
  now: number | null;
}) {
  const source = SHOP_DATA.sources[pkg.source];
  const ended = now != null && !onSale(pkg, now);
  const headingId = `pkg-${pkg.id}`;
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.cardHead}>
        <h3 id={headingId}>{pkg.name}</h3>
        <p className={styles.price}>
          {count(value.priceRoyal)} <small>로열 크리스탈</small>
        </p>
      </div>
      <p className={styles.plan}>
        {pkg.bonus
          ? `${value.purchases}회 구매 + 보너스 = ${value.sets}세트 기준 (1회 ${count(pkg.priceRoyal)})`
          : "1회 구매 기준"}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>판매 기간</dt>
          <dd>
            {pkg.period}
            {/* Held from the first paint: the date comes from the client clock. */}
            <span className={styles.ended}>{ended ? " · 판매 기간이 지났어요" : ""}</span>
          </dd>
        </div>
        <div>
          <dt>구매 제한</dt>
          <dd>{pkg.limit}</dd>
        </div>
        {pkg.bonus && (
          <div>
            <dt>구매 보너스</dt>
            <dd>{pkg.bonus.text}</dd>
          </div>
        )}
      </dl>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.sr}>{pkg.name} 구성품 가치</caption>
          <colgroup>
            <col className={styles.colItem} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">구성품</th>
              <th scope="col" className={styles.num}>
                수량
              </th>
              <th scope="col" className={styles.num}>
                1개 골드
              </th>
              <th scope="col" className={styles.num}>
                골드 가치
              </th>
            </tr>
          </thead>
          <tbody>
            {value.items.map((item) => (
              <tr key={item.name}>
                <th scope="row">
                  {item.name}
                  {item.detail && <small>{item.detail}</small>}
                </th>
                <td className={styles.num}>{count(item.total)}</td>
                <td className={styles.num} data-empty={(priced && item.unit == null) || undefined}>
                  <Figure text={item.pheon ? EXCLUDED : !priced ? "—" : item.untradeable ? NOT_TRADED : item.unit == null ? UNKNOWN : unitText(item.unit)} />
                </td>
                <td className={styles.num} data-empty={(priced && item.gold == null) || undefined}>
                  <Figure text={item.pheon ? EXCLUDED : !priced ? "—" : item.untradeable ? NOT_TRADED : item.gold == null ? UNKNOWN : count(item.gold)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {/* Two columns each: the total is the widest figure (360: 1,664,800G). */}
              <th scope="row" colSpan={2}>
                {value.unknown.length ? "확인된 구성품 합계" : value.untradeable.length || value.pheon.length ? "거래 가능한 구성품 가치" : "합계"}
                {/* Said in words, not by colour alone; the line is held from the first
                    paint so prices arriving never push the card (A6). */}
                <small className={styles.footNote}>
                  {excludedNote(value, priced)}
                </small>
              </th>
              <td className={styles.num} colSpan={2}>
                <Figure text={priced ? `${count(value.gold)}G` : "—"} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {value.crystals > 0 && (
        <p className={styles.note}>
          같은 로열 크리스탈로 공식 상점에서 크리스탈을 사면 {count(value.crystalsForPrice)}개, 이 상품은{" "}
          {count(value.crystals)}개예요.
        </p>
      )}
      <Verdict value={value} rate={rate} priced={priced} />
      <p className={styles.source}>
        공식 상점 공지 「{source.title}」 기준 ·{" "}
        <a href={source.url} target="_blank" rel="noreferrer">
          공지 보기
        </a>
      </p>
    </section>
  );
}

/** `renderedAt`: the server render time (epoch ms), the clock until the client one starts. */
export function LoaShopTool({ renderedAt }: { renderedAt: number }) {
  const [basis, setBasis] = useState<PriceBasis>("CURRENT_MIN_PRICE");
  const rateText = useSyncExternalStore(subscribeRate, readRate, () => "");
  const rateId = useId();
  const hintId = useId();
  const changeRate = (text: string) => writeRate(text.replace(/[^\d]/g, ""));
  const rate = parseRate(rateText);

  const requested = useMemo(() => marketNames(SHOP_DATA.packages), []);
  const prices = useQuery({
    queryKey: ["loa-shop-prices", basis, requested],
    queryFn: ({ signal }) => postMaterialPrices({ priceBasis: basis, names: requested }, signal),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const now = useClock(MINUTE);
  // Which packages are on sale is decided from the server's render time until
  // the client clock starts, so the first HTML already folds the ended ones
  // away and nothing moves after it (A6).
  const { current, past } = splitBySale(SHOP_DATA.packages, now ?? renderedAt);
  const card = (pkg: ShopPackage) => (
    <PackageCard
      key={pkg.id}
      pkg={pkg}
      value={packageValue(pkg, (name) => market.get(name) ?? null, rate)}
      rate={rate}
      priced={priced}
      now={now ?? renderedAt}
    />
  );
  const limit = useRateLimit(prices.error);
  const priceList: MaterialPrice[] = prices.data?.data.items ?? [];
  // PRICED → its price; UNTRADEABLE → left out of the gold; anything else
  // (no listing, no price now, or a status this screen does not know yet) is 미확인.
  const market = new Map<string, UnitPrice>();
  for (const p of priceList) {
    if (p.status === "PRICED" && p.unitPriceGold != null) market.set(p.name, p.unitPriceGold);
    else if (p.status === "UNTRADEABLE") market.set(p.name, UNTRADEABLE);
  }
  const priced = !!prices.data;
  const failure =
    prices.error instanceof MarketQueryError
      ? prices.error.info
      : prices.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const observedAt = priceList.map((p) => p.observedAt).sort().at(-1);

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#shop-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="shop-main">
        <section className={quote.hero} aria-labelledby="shop-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Box size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="shop-heading">로아샵 효율</h1>
          <p className={quote.heroCopy}>패키지 구성품, 지금 거래소 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={styles.settings} aria-labelledby="settings-heading">
              <h2 id="settings-heading" className={styles.sectionTitle}>
                계산 기준
              </h2>
              <label className={styles.field} htmlFor={rateId}>
                <span>게임 안 크리스탈 교환소 시세(블루 크리스탈 100개당 골드)</span>
                <input
                  id={rateId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="비워 두면 이득을 계산하지 않아요"
                  aria-describedby={hintId}
                  value={rateText}
                  onChange={(event) => changeRate(event.target.value)}
                />
              </label>
              <p id={hintId} className={styles.small}>
                게임 안 크리스탈 교환소에서 블루 크리스탈 100개를 살 때 드는 골드를 넣어 주세요. 이 브라우저에만 저장하고
                서버로 보내지 않아요. 공식 상점에서 블루 크리스탈 100개는 로열 크리스탈 {count(SHOP_DATA.crystal.royalPer100)}
                개예요.
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
            </section>

            <section className={styles.list} aria-labelledby="packages-heading" aria-busy={prices.isPlaceholderData || undefined}>
              <h2 id="packages-heading" className={styles.sectionTitle}>
                판매 중인 패키지
              </h2>
              <p className={styles.small}>
                공식 상점 공지 기준 · 확인 {SHOP_DATA.checkedAt}. {SHOP_DATA.unknown.join(" · ")}은 {UNKNOWN}이에요.
              </p>
              {/* Here, in the wide column: in the narrow settings column the
                  row did not fit and turned into a list after the fonts came,
                  moving the page (A6). */}
              <div className={styles.basis}>
                <SegmentedControl
                  aria-label="시세 기준"
                  value={basis}
                  onValueChange={(value) => setBasis(value as PriceBasis)}
                >
                  {priceBases.map((item) => (
                    <SegmentedItem key={item.value} value={item.value}>
                      {item.label}
                    </SegmentedItem>
                  ))}
                </SegmentedControl>
                <p className={styles.small}>
                  거래소 {priceBases.find((b) => b.value === basis)?.label} 기준, 1분마다 새로 불러와요.
                  <span className={styles.agoLine}>{observedAt && now != null ? agoText(now, observedAt) : ""}</span>
                </p>
              </div>
              <div className={styles.cards}>{current.map(card)}</div>
              {/* Ended sales, folded by default below the list: opening it only adds below (A7). */}
              {past.length > 0 && (
                <details className={styles.past}>
                  <summary className="hit-44">지난 상품 {past.length}개</summary>
                  <div className={styles.cards}>{past.map(card)}</div>
                </details>
              )}
              <p className={styles.small}>
                구성품 가치 = 수량 × 거래소 1개 가격(묶음 가격 ÷ 묶음 수). 귀속 구성품도 같은 재료의 거래소 가격으로 매겨요.
                로열 크리스탈 환산 가치 = 골드 가치 × {count(SHOP_DATA.crystal.royalPer100)} ÷ 교환소 시세, 이득 = 환산 가치
                − 판매가. 거래소에 없는 구성품은 0이 아니라 {UNKNOWN}으로 두고 이득을 계산하지 않아요.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 공식 상점 공지 기준 자료</footer>
    </div>
  );
}
