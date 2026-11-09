"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HubTabs } from "@/components/site/hub-tabs";
import { SiteHeader } from "@/components/site/site-header";
import { ArrowLeft, Gift } from "@/components/ui/icons";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { MINUTE } from "@/components/home/clock";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type PriceBasis } from "@/lib/market/model";
import { goldText } from "@/lib/tools/format";
import {
  HELL_DATA,
  MARKET_NAMES,
  STAGES,
  levelItems,
  stageReward,
  stageValue,
  type HellKind,
  type StageLine,
} from "@/lib/tools/hell-reward";
import quote from "./material-quote.module.css";
import styles from "./hell-reward.module.css";

const KINDS: { value: HellKind; label: string }[] = [
  { value: "hell", label: "지옥" },
  { value: "abyss", label: "나락" },
];

const unitText = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: value < 1 ? 4 : 2 });

/** What a line's value is based on, in words (never only a colour). */
function basisText(line: StageLine, priced: boolean) {
  if (line.pricing.kind === "BOUND_GOLD") return "귀속 골드";
  if (line.pricing.kind === "MARKET") {
    if (line.unit == null) return priced ? "시세 없음 · 0G" : "시세 불러오는 중";
    return `1개 ${unitText(line.unit)}G${line.boundAtMarket ? " · 귀속, 시세로 환산" : ""}`;
  }
  return line.pricing.why === "UNSETTLED" ? "품목 확인 중 · 직접 정한 값" : "시세 없음 · 직접 정한 값";
}

export function HellRewardTool() {
  const [kind, setKind] = useState<HellKind>("hell");
  const [level, setLevel] = useState(HELL_DATA.keyLevels.at(-1)!);
  const [stage, setStage] = useState(0);
  const [basis, setBasis] = useState<PriceBasis>("RECENT_PRICE");
  // Per unit, kept across kinds, levels and stages (the same item is worth the same).
  const [manual, setManual] = useState<Record<string, string>>({});
  const stageId = useId();

  const prices = useQuery({
    queryKey: ["hell-reward-prices", basis, MARKET_NAMES],
    queryFn: ({ signal }) => postMaterialPrices({ priceBasis: basis, names: MARKET_NAMES }, signal),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(prices.error);
  const market = useMemo(
    () =>
      new Map(
        (prices.data?.data.items ?? [])
          .filter((p) => p.status === "PRICED" && p.unitPriceGold != null)
          .map((p) => [p.name, p.unitPriceGold as number]),
      ),
    [prices.data],
  );
  const priced = !!prices.data;
  const marketPrice = (name: string) => market.get(name) ?? null;
  const manualValue = (key: string) => {
    const v = Number(manual[key]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const settled = levelItems(kind, level);
  const value = stageValue(stageReward(kind, level, stage)!, marketPrice, manualValue, settled);
  const perStage = STAGES.map((s) => stageValue(stageReward(kind, level, s)!, marketPrice, manualValue, settled).total);
  const failure =
    prices.error instanceof MarketQueryError ? prices.error.info : prices.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const kindLabel = KINDS.find((k) => k.value === kind)!.label;

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#hell-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="hell-main">
        <section className={quote.hero} aria-labelledby="hell-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Gift size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 · 보상</p>
          <h1 id="hell-heading">지옥 · 나락 보상</h1>
          <p className={quote.heroCopy}>열쇠 단계별 고정 보상을 지금 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
          <HubTabs hub="raid" />
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={styles.controls} aria-label="조건">
              <SegmentedControl fill aria-label="종류" value={kind} onValueChange={(v) => setKind(v as HellKind)}>
                {KINDS.map((k) => (
                  <SegmentedItem key={k.value} value={k.value}>
                    {k.label}
                  </SegmentedItem>
                ))}
              </SegmentedControl>
              <SegmentedControl fill aria-label="열쇠 단계(입장 레벨)" value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
                {HELL_DATA.keyLevels.map((lv) => (
                  <SegmentedItem key={lv} value={String(lv)}>
                    {lv}
                  </SegmentedItem>
                ))}
              </SegmentedControl>
              <label className={styles.stage} htmlFor={stageId}>
                <span>클리어 단계</span>
                <select id={stageId} value={stage} onChange={(e) => setStage(Number(e.target.value))}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}단계
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className={styles.main} aria-labelledby="hell-value-heading">
              <h2 id="hell-value-heading" className={styles.sectionTitle}>
                {kindLabel} {level} · {stage}단계 고정 보상
              </h2>
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
              <dl className={styles.sums} aria-live="polite">
                <div>
                  <dt>합계</dt>
                  <dd>{goldText(value.total)}G</dd>
                </div>
                <div>
                  <dt>시세로 매긴 것</dt>
                  <dd>{goldText(value.market)}G</dd>
                </div>
                <div>
                  <dt>귀속 골드</dt>
                  <dd>{goldText(value.boundGold)}G</dd>
                </div>
                <div>
                  <dt>직접 정한 값</dt>
                  <dd>{goldText(value.manual)}G</dd>
                </div>
              </dl>
              <ul className={styles.lines} aria-label="보상 품목">
                {value.lines.map((line) => {
                  const pair = line.key === "destruction" || line.key === "guardian" || line.key === "destinyStone" || line.key === "chaosStone";
                  return (
                    <li key={line.key} data-not-chosen={line.notChosen || undefined}>
                      <span className={styles.item}>
                        <strong>
                          {line.label} <b>×{goldText(line.qty)}</b>
                        </strong>
                        <small>
                          {basisText(line, priced)}
                          {pair && (line.notChosen ? " · 둘 중 하나, 고르지 않음" : " · 둘 중 하나, 이쪽으로 셈")}
                        </small>
                      </span>
                      {line.pricing.kind === "MANUAL" && (
                        <label className={styles.unit}>
                          <span>1개 값</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="0"
                            value={manual[line.unitKey] ?? ""}
                            aria-label={`${line.label} 1개 값(골드)`}
                            onChange={(e) => setManual((m) => ({ ...m, [line.unitKey]: e.target.value.replace(/[^\d.]/g, "") }))}
                          />
                        </label>
                      )}
                      <span className={styles.amount}>{goldText(line.notChosen ? 0 : line.value)}G</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={styles.side} aria-labelledby="hell-stages-heading">
              <h2 id="hell-stages-heading" className={styles.sectionTitle}>
                단계별 합계
              </h2>
              <table className={styles.table}>
                <caption className={styles.sr}>
                  {kindLabel} {level} 단계별 고정 보상 합계(지금 값 기준)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">단계</th>
                    <th scope="col">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {perStage.map((total, s) => (
                    <tr key={s} aria-current={s === stage || undefined}>
                      <th scope="row">{s}단계</th>
                      <td>{goldText(total)}G</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SegmentedControl fill aria-label="시세 기준" value={basis} onValueChange={(v) => setBasis(v as PriceBasis)}>
                {priceBases.map((item) => (
                  <SegmentedItem key={item.value} value={item.value}>
                    {item.label}
                  </SegmentedItem>
                ))}
              </SegmentedControl>
              <p className={styles.note}>
                열쇠 1개로 받는 단계별 고정 보상만 셈해요. 상자 보상과 확률, 풍요(×10), 무기 +25 · 페온 효과는 출처를 확인하지
                못해 넣지 않았어요. 둘 중 하나를 고르는 보상은 값이 큰 쪽으로 셈하고, 시세가 없는 품목은 직접 정한 값(처음엔
                0G)으로 셈해요.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 거래소 시세 기반 계산</footer>
    </div>
  );
}
