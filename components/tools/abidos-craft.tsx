"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Box } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { MarketQueryError, postMaterialPricesAll } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type MaterialPrice, type PriceBasis } from "@/lib/market/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MINUTE, useClock } from "@/components/home/clock";
import {
  CRAFT_DATA,
  craftGoldAfterCut,
  energyAfterCut,
  craftMarketNames,
  craftResult,
  expectedYield,
  greatSuccessChance,
  parsePercent,
  type CraftResult,
} from "@/lib/tools/abidos-craft";
import { MARKET_FEE_PERCENT } from "@/lib/tools/auction";
import { PercentField, SwitchRow } from "./craft-fields";
import { goldText as count, roundGold, signedGold as signed } from "@/lib/tools/format";
import quote from "./material-quote.module.css";
import styles from "./abidos-craft.module.css";

const UNKNOWN = "미확인";
const percentText = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const agoText = (now: number, iso: string) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE));
  return minutes === 0 ? "방금 기준" : `${minutes}분 전 기준`;
};

/**
 * A right-aligned figure drawn as a new node whenever it changes: rewriting the
 * text in place slid it sideways as its width changed (prices arriving and the
 * minute refresh, A6).
 */
function Figure({ text, tone }: { text: string; tone?: "up" | "down" }) {
  return (
    <span key={text} className={tone === "up" ? styles.up : tone === "down" ? styles.down : undefined}>
      {text}
    </span>
  );
}

const viaText = (r: CraftResult) => {
  const via = r.materials.filter((m) => m.via);
  return via.length ? `교환으로 마련: ${via.map((m) => m.name).join(", ")}` : "";
};

const profitFigure = (value: number | null, priced: boolean) =>
  !priced ? <Figure text="—" /> : value == null ? <Figure text={UNKNOWN} /> : <Figure text={signed(value)} tone={roundGold(value) > 0 ? "up" : roundGold(value) < 0 ? "down" : undefined} />;

/**
 * Profit, and under it the same per 100 estate energy (a line held from the
 * first paint). The words are in the header; read out here for screen readers.
 */
function ProfitCell({ value, per100, priced }: { value: number | null; per100: number | null; priced: boolean }) {
  const shown = priced && per100 != null;
  return (
    <td className={styles.num}>
      {profitFigure(value, priced)}
      <small className={styles.perEnergy}>
        {shown && <span className={styles.sr}>100 활동력당 </span>}
        <Figure text={shown ? signed(per100) : ""} />
      </small>
    </td>
  );
}

function OutputTable({ results, priced }: { results: CraftResult[]; priced: boolean }) {
  const output = results[0].output;
  return (
    <section className={styles.card} aria-labelledby={`craft-${output.id}`}>
      <div className={styles.cardHead}>
        <h3 id={`craft-${output.id}`}>{output.name}</h3>
        <p className={styles.meta}>
          활동력 {count(results[0].energy)} · 제작 {output.time.replace(/^0/, "").replace(/:00$/, "")} · 골드 {count(results[0].craftGold)}
        </p>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.sr}>{output.name} 생활 스킬별 1회 제작 손익</caption>
          <colgroup>
            <col className={styles.colSkill} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">생활 스킬 · 재료</th>
              <th scope="col" className={styles.num}>
                1회 비용
              </th>
              <th scope="col" className={styles.num}>
                판매 시<small>100 활동력당</small>
              </th>
              <th scope="col" className={styles.num}>
                직접 사용 시<small>100 활동력당</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.skill.id}>
                <th scope="row">
                  {r.skill.name}
                  <small>{r.materials.map((m) => `${m.name} ${m.qty}`).join(" · ")}</small>
                  {/* Held from the first paint: what the exchange vendor supplies more cheaply. */}
                  <small className={styles.via}>
                    <span key={viaText(r)}>{viaText(r)}</span>
                  </small>
                  {/* Held from the first paint: names a price the market did not give. */}
                  <small className={styles.missing}>{priced && r.missing.length ? `${UNKNOWN}: ${r.missing.join(", ")}` : ""}</small>
                </th>
                <td className={styles.num} data-empty={(priced && r.cost == null) || undefined}>
                  <Figure text={!priced ? "—" : r.cost == null ? UNKNOWN : count(r.cost)} />
                </td>
                <ProfitCell value={r.sellProfit} per100={r.sellPer100Energy} priced={priced} />
                <ProfitCell value={r.useProfit} per100={r.usePer100Energy} priced={priced} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AbidosCraftTool() {
  const [basis, setBasis] = useState<PriceBasis>("CURRENT_MIN_PRICE");
  const [increaseText, setIncreaseText] = useState("");
  const [feeCutText, setFeeCutText] = useState("");
  const increase = parsePercent(increaseText) ?? 0;
  const feeCut = parsePercent(feeCutText) ?? 0;
  const [energyAllText, setEnergyAllText] = useState("");
  const [energyCategoryText, setEnergyCategoryText] = useState("");
  const energyCut = { overall: parsePercent(energyAllText) ?? 0, category: parsePercent(energyCategoryText) ?? 0 };
  // On by default, as on comparison basis C's screen.
  const [exchange, setExchange] = useState(true);

  const requested = useMemo(() => craftMarketNames(), []);
  const prices = useQuery({
    queryKey: ["abidos-craft-prices", basis, requested],
    // 25 names with the exchange-only rare grade: sent as requests of up to 20.
    queryFn: ({ signal }) => postMaterialPricesAll({ priceBasis: basis, names: requested }, signal),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const now = useClock(MINUTE);
  const limit = useRateLimit(prices.error);
  const priceList: MaterialPrice[] = prices.data?.data.items ?? [];
  const market = new Map(
    priceList.filter((p) => p.status === "PRICED" && p.unitPriceGold != null).map((p) => [p.name, p.unitPriceGold as number]),
  );
  const priced = !!prices.data;
  const failure =
    prices.error instanceof MarketQueryError
      ? prices.error.info
      : prices.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const observedAt = priceList.map((p) => p.observedAt).sort().at(-1);
  const unit = (name: string) => market.get(name) ?? null;

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#craft-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="craft-main">
        <section className={quote.hero} aria-labelledby="craft-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Box size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="craft-heading">아비도스 제작 손익</h1>
          <p className={quote.heroCopy}>융화 재료 1회 제작, 지금 거래소 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={styles.settings} aria-labelledby="craft-settings">
              <h2 id="craft-settings" className={styles.sectionTitle}>
                계산 조건
              </h2>
              <PercentField
                label="대성공 확률 증가"
                hint={`대성공 확률 ${percentText(greatSuccessChance(increase) * 100)}% · 1회 평균 ${percentText(expectedYield(increase))}개`}
                value={increaseText}
                onChange={setIncreaseText}
              />
              <PercentField
                label="제작 수수료 감소"
                hint={`1회 제작 골드 ${CRAFT_DATA.outputs.map((o) => `${o.name.replace(" 융화 재료", "")} ${count(craftGoldAfterCut(o.gold, feeCut))}`).join(" · ")}`}
                value={feeCutText}
                onChange={setFeeCutText}
              />
              <PercentField
                label="활동력 소모 감소(전체)"
                hint="모든 제작에 붙는 감소예요. 아래 특수 제작 감소와 더해서 적용해요."
                value={energyAllText}
                onChange={setEnergyAllText}
              />
              <PercentField
                label={`활동력 소모 감소(${CRAFT_DATA.energyCut.category} 제작)`}
                hint={`1회 활동력 ${CRAFT_DATA.outputs.map((o) => `${o.name.replace(" 융화 재료", "")} ${count(energyAfterCut(o.energy, energyCut.overall, energyCut.category))}`).join(" · ")} (내림)`}
                value={energyCategoryText}
                onChange={setEnergyCategoryText}
              />
              <SwitchRow
                label="교환 상인"
                hint="거래소에서 사는 것보다 교환 상인으로 바꾸는 게 싸면 그 값으로 재료비를 계산해요."
                checked={exchange}
                onChange={setExchange}
              />
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

            <section className={styles.list} aria-labelledby="craft-results" aria-busy={prices.isPlaceholderData || undefined}>
              <h2 id="craft-results" className={styles.sectionTitle}>
                1회 제작 손익
              </h2>
              <div className={styles.basis}>
                <SegmentedControl aria-label="시세 기준" value={basis} onValueChange={(value) => setBasis(value as PriceBasis)}>
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
              <div className={styles.cards}>
                {CRAFT_DATA.outputs.map((output) => (
                  <OutputTable
                    key={output.id}
                    priced={priced}
                    results={CRAFT_DATA.skills.map((skill) => craftResult(output.id, skill.id, unit, increase, feeCut, energyCut, exchange))}
                  />
                ))}
              </div>
              <p className={styles.small}>
                1회 제작에 결과물 10개, 대성공이면 20개가 나와요. 대성공 확률은 기본 5%에 (1 + 증가)를 곱해요. 비용 = 재료 수량 ×
                거래소 1개 가격 + 제작 골드(수수료 감소 반영, 1골드 미만은 올림). 판매 시 = 1개 가격에서 판매 수수료{" "}
                {MARKET_FEE_PERCENT}%(1골드 미만 올림)를 뗀 값 × 평균 개수, 직접 사용 시 = 평균 개수 × 1개 가격.
                직접 캔 재료도 거래소 가격으로 매겨요. 교환 상인을 켜면 같은 생활 스킬 재료끼리 바꾸는 값(예: 목재 → 가루 →
                아비도스 목재)이 거래소보다 0.5% 넘게 싸면 그 값으로 재료비를 계산해요. 가루는 거래소에서 사지 않아요.
                거래소에 가격이 없는 재료가 있으면 0이 아니라 {UNKNOWN}으로 두고 손익을 계산하지 않아요. 100 활동력당 이익은
                1회 활동력(기본 아비도스 288·상급 360에서 전체·특수 제작 감소를 더해 빼고 내림)으로 나눠요. 니나브의 축복은 제작 시간·슬롯·활동력 회복량을 바꿔
                1회 손익에는 영향이 없어요. 손익 계산에는 넣지 않아요. 확인 {CRAFT_DATA.checkedAt}.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 제작 손익 계산</footer>
    </div>
  );
}
