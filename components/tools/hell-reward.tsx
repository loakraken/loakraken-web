"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HubTabs } from "@/components/site/hub-tabs";
import { SiteHeader } from "@/components/site/site-header";
import { ArrowLeft, Gift } from "@/components/ui/icons";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { MINUTE } from "@/components/home/clock";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type PriceBasis } from "@/lib/market/model";
import { goldText } from "@/lib/tools/format";
import { intCodec, oneOfCodec, useUrlState } from "@/lib/tools/url-state";
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

/**
 * What a line's value is based on, in words (never only a colour). Fixed per line: it
 * does not change when prices land, so the caption never rewraps and moves the lines
 * below (360 CLS 0.018 when the unit price sat here).
 */
function basisText(line: StageLine) {
  if (line.pricing.kind === "BOUND_GOLD") return "골드 그대로";
  if (line.pricing.kind === "MARKET") return line.trade === "BOUND" ? "귀속, 시세로 환산" : "거래 가능 여부 확인 전";
  return line.pricing.why === "UNSETTLED" ? "품목 확인 중 · 직접 정한 값" : "시세 없음 · 직접 정한 값";
}

export function HellRewardTool() {
  // Kept in the address (#889): back, reload and a shared link come back with them.
  const [kind, setKind] = useUrlState<HellKind>("kind", "hell", oneOfCodec(["hell", "abyss"] as const));
  const [levelText, setLevelText] = useUrlState("level", String(HELL_DATA.keyLevels.at(-1)), oneOfCodec(HELL_DATA.keyLevels.map(String)));
  const level = Number(levelText);
  const setLevel = (v: number) => setLevelText(String(v));
  const [stage, setStage] = useUrlState("stage", 0, intCodec(0, 10));
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
  const marketPrice = (name: string) => market.get(name) ?? null;
  const manualValue = (key: string) => {
    const v = Number(manual[key]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const settled = levelItems(kind, level);
  const loaded = !!prices.data;
  const value = stageValue(stageReward(kind, level, stage)!, marketPrice, manualValue, settled, loaded);
  const perStage = STAGES.map((s) => stageValue(stageReward(kind, level, s)!, marketPrice, manualValue, settled, loaded).total);
  const failure =
    prices.error instanceof MarketQueryError ? prices.error.info : prices.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const kindLabel = KINDS.find((k) => k.value === kind)!.label;
  // Counted lines valued by the user that still have no value: shown, never a silent 0 (PM 총괄 #1525).
  const zeroManual = value.lines.filter((l) => !l.notChosen && (l.pricing.kind === "MANUAL" || l.unpriced) && !(l.unit ?? 0)).length;

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
                <Select
                  id={stageId}
                  value={stage}
                  onValueChange={(v) => setStage(Number(v))}
                  items={STAGES.map((s) => ({ value: s, label: `${s}단계` }))}
                />
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
              {/* Each amount is one text ("47,695G"): as "47,695" + "G" the G node moved when the
                  number grew (CLS when prices land). */}
              <dl className={styles.sums} aria-live="polite">
                <div>
                  <dt>합계</dt>
                  <dd>{`${goldText(value.total)}G`}</dd>
                </div>
                <div>
                  <dt>시세로 매긴 것</dt>
                  <dd>{`${goldText(value.market)}G`}</dd>
                </div>
                <div>
                  <dt>귀속 골드</dt>
                  <dd>{`${goldText(value.boundGold)}G`}</dd>
                </div>
                <div>
                  <dt>직접 정한 값</dt>
                  <dd>{`${goldText(value.manual)}G`}</dd>
                </div>
              </dl>
              {/* One short line, there from the first paint (it only changes its count). */}
              <p className={styles.zero}>{`직접 값 없이 0G로 센 품목 ${zeroManual}개`}</p>
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
                          {basisText(line)}
                          {pair && " · 둘 중 하나만 셈"}
                        </small>
                      </span>
                      {/* One slot per priced or user-valued line, drawn from the first paint at a
                          fixed height: the unit price, a wait note, or the user's input when there
                          is no price, so a price (or none) landing never adds height (CLS). */}
                      {line.pricing.kind !== "BOUND_GOLD" && (
                        <span className={styles.unit}>
                          {line.pricing.kind === "MANUAL" || line.unpriced ? (
                            <label>
                              <span>{line.unpriced ? "시세 없음 · 1개 값" : "1개 값"}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                name={`unit-${line.unitKey}`}
                                autoComplete="off"
                                min={0}
                                placeholder="0"
                                value={manual[line.unitKey] ?? ""}
                                aria-label={`${line.label} 1개 값(골드)`}
                                onChange={(e) => setManual((m) => ({ ...m, [line.unitKey]: e.target.value.replace(/[^\d.]/g, "") }))}
                              />
                            </label>
                          ) : (
                            <span>{line.unit == null ? "시세 대기…" : `1개 ${unitText(line.unit)}G`}</span>
                          )}
                        </span>
                      )}
                      <span className={styles.amount}>{line.notChosen ? "셈 안 함" : `${goldText(line.value)}G`}</span>
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
                      <td>{`${goldText(total)}G`}</td>
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
                열쇠 1개로 받는 단계별 고정 보상만 셈해요. 상자 보상과 확률, 풍요(×10), 무기 +25 · 페온 효과는 이 계산에
                넣지 않았어요. 둘 중 하나를 고르는 보상은 값이 큰 쪽으로 셈하고, 시세가 없는 품목은 직접 정한 값(처음엔
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
