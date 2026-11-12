"use client";

import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
import { boolCodec, intCodec, oneOfCodec, useUrlState } from "@/lib/tools/url-state";
import { useHellValues } from "@/lib/tools/hell-reward-values";
import {
  HELL_DATA,
  MARKET_NAMES,
  STAGES,
  baseValue,
  heldView,
  levelItems,
  rankBoxes,
  stageBase,
  stageReward,
  stageValue,
  type BaseLine,
  type HellKind,
  type StageLine,
  zeroManualCount,
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

const PAIR_KEYS = new Set(["destruction", "guardian", "destinyStone", "chaosStone"]);

/** One item of a box: name × qty, what its value is based on, the unit slot, the amount. */
function ItemLine({
  line,
  manual,
  setManual,
}: {
  line: StageLine;
  manual: Record<string, string>;
  setManual: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  return (
    <li data-not-chosen={line.notChosen || undefined}>
      <span className={styles.item}>
        <strong>
          {line.label} <b>×{goldText(line.qty)}</b>
        </strong>
        <small>
          {basisText(line)}
          {PAIR_KEYS.has(line.key) && " · 둘 중 하나만 셈"}
        </small>
      </span>
      {/* One slot per priced or user-valued line, drawn from the first paint at a fixed
          height: the unit price, a wait note, or the user's input when there is no price,
          so a price (or none) landing never adds height (CLS). */}
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
}

/** A base item every box gives: like a box item, its own value when no price came back. */
function BaseItemLine({
  line,
  manual,
  setManual,
}: {
  line: BaseLine;
  manual: Record<string, string>;
  setManual: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  return (
    <li>
      <span className={styles.item}>
        <strong>
          {line.label} <b>×{goldText(line.qty)}</b>
        </strong>
        <small>{line.unpriced ? "시세 없음 · 직접 정한 값" : "기본 보상 · 거래 가능 여부 확인 전"}</small>
      </span>
      <span className={styles.unit}>
        {line.unpriced ? (
          <label>
            <span>시세 없음 · 1개 값</span>
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
      <span className={styles.amount}>{`${goldText(line.value)}G`}</span>
    </li>
  );
}

export function HellRewardTool() {
  // Kept in the address (#889): back, reload and a shared link come back with them.
  const [kind, setKind] = useUrlState<HellKind>("kind", "hell", oneOfCodec(["hell", "abyss"] as const));
  const [levelText, setLevelText] = useUrlState("level", String(HELL_DATA.keyLevels.at(-1)), oneOfCodec(HELL_DATA.keyLevels.map(String)));
  const level = Number(levelText);
  const setLevel = (v: number) => setLevelText(String(v));
  const [stage, setStage] = useUrlState("stage", 0, intCodec(0, 10));
  const [basis, setBasis] = useUrlState<PriceBasis>("basis", "RECENT_PRICE", oneOfCodec(priceBases.map((b) => b.value)));
  // Per unit and per item (keyed by item name, lib unitKey): the same item keeps its value
  // across kinds, levels and stages; a different item at another level does not take it.
  // Kept in this browser (localStorage), not the address: reload, Back and a later visit keep them.
  const [manual, setManual, restored] = useHellValues();
  // 풍요: the base of the opened box ×10 (PM 총괄 11-10).
  const [abundance, setAbundance] = useUrlState("abundance", false, boolCodec);
  const stageId = useId();
  const basisId = useId();

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
  // A new price basis keeps the old figures until the new prices land: shown dimmed and
  // marked busy, so nobody reads them as current (A8).
  const switching = prices.isPlaceholderData;
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
  const valueAt = (s: number) => stageValue(stageReward(kind, level, s)!, marketPrice, manualValue, settled, loaded, `${kind}:${level}`);
  const baseAt = (s: number) => {
    const items = stageBase(kind, level, s);
    return items ? baseValue(items, marketPrice, abundance, manualValue, loaded) : null;
  };
  const value = valueAt(stage);
  const base = baseAt(stage);
  // One key opens ONE box: the boxes ranked, the best first (never the sum of all boxes).
  const ranked = rankBoxes(value, base);
  // The list order follows the user's own choices (kind, level, stage, 풍요, typed values) and
  // the first prices, not every price refresh: a new basis or the minute refresh could reorder
  // boxes of different heights with no input (CLS). Values update in place; the headline always
  // names the best box now. Adjusted during render (derived state), no effect.
  const [resort, setResort] = useState(0);
  const orderKey = `${kind}|${level}|${stage}|${abundance}|${loaded}|${resort}|${JSON.stringify(manual)}`;
  const [order, setOrder] = useState({ key: "", ids: [] as string[] });
  if (order.key !== orderKey) setOrder({ key: orderKey, ids: ranked.map((b) => b.id) });
  const view = heldView(ranked, order.key === orderKey ? order.ids : ranked.map((b) => b.id));
  const boxes = view.list;
  const best = view.best;
  const perStage = STAGES.map((s) => rankBoxes(valueAt(s), baseAt(s))[0]?.value ?? 0);
  const failure =
    prices.error instanceof MarketQueryError ? prices.error.info : prices.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const kindLabel = KINDS.find((k) => k.value === kind)!.label;
  // Counted lines valued by the user that still have no value: shown, never a silent 0 (PM 총괄 #1525).
  const zeroManual = zeroManualCount(value, base);


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

            <section
              className={styles.main}
              aria-labelledby="hell-value-heading"
              aria-busy={switching || undefined}
              data-stale={switching || undefined}
            >
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
              {/* The headline is the best single box: one key opens one box (PM 총괄 11-10). Held (kept
                  in place, not shown) until the stored values apply and prices land, so a reload never
                  flips it from a no-typed-value result (codex #1549 P3).
                  Each amount is one text ("47,695G"; split, the G node moved as numbers grew). */}
              <dl className={styles.sums} aria-live="polite" aria-busy={!restored || (!loaded && !failure) || undefined} data-waiting={!restored || (!loaded && !failure) ? "" : undefined}>
                <div>
                  <dt>가장 좋은 상자</dt>
                  <dd className={styles.boxName}>{best?.label ?? ""}</dd>
                </div>
                <div>
                  <dt>그 상자의 값</dt>
                  <dd>{`${goldText(best?.value ?? 0)}G`}</dd>
                </div>
                <div>
                  <dt>{abundance ? "기본 보상 (풍요 ×10)" : "기본 보상"}</dt>
                  <dd>{base ? `${goldText(base.value)}G` : kind === "abyss" ? "없음" : "확인 중"}</dd>
                </div>
              </dl>
              <label className={styles.switch}>
                <input type="checkbox" role="switch" checked={abundance} disabled={!base} onChange={(e) => setAbundance(e.target.checked)} />
                <span>풍요(기본 보상 ×10)</span>
              </label>
              {/* Fixed lines, there from the first paint (only their numbers change). */}
              <p className={styles.zero}>
                {base
                  ? "어느 상자를 열어도 기본 보상이 같이 나와요."
                  : kind === "abyss"
                    ? "나락 상자에는 기본 보상이 없어요."
                    : "기본 보상은 수량 확인 중이라 상자 값에 아직 넣지 않았어요."}
              </p>
              <p className={styles.zero}>{`직접 값 없이 0G로 센 품목 ${zeroManual}개`}</p>
              {base && (
                <ul className={styles.lines} aria-label="기본 보상(어느 상자든 함께)">
                  {base.lines.map((line) => (
                    <BaseItemLine key={line.unitKey} line={line} manual={manual} setManual={setManual} />
                  ))}
                </ul>
              )}
              {/* Always drawn (a button appearing would move the list). The order is held while
                  only prices change; the headline above is always the best box now. */}
              <p className={styles.order}>
                <span aria-live="polite">{view.stale ? "시세가 바뀌어 지금 값과 순서가 달라요." : "지금 값 기준으로 좋은 순서예요."}</span>
                <button type="button" className={quote.outlinePill} onClick={() => setResort((n) => n + 1)}>
                  지금 시세로 다시 정렬
                </button>
              </p>
              {/* Until prices land the order is not known yet: the list keeps its height but is not
                  shown, so ranking the boxes when prices arrive moves nothing visible (CLS). Shown
                  in table order if prices fail. */}
              <ol
                className={styles.boxes}
                aria-label="상자별 값(좋은 순)"
                data-waiting={!loaded && !failure ? "" : undefined}
                aria-busy={!loaded && !failure ? true : undefined}
              >
                {boxes.map((box) => (
                  <li key={box.id}>
                    <p className={styles.boxHead}>
                      <strong>{box.label}</strong>
                      <span className={styles.amount}>{`${goldText(box.value)}G`}</span>
                    </p>
                    <ul className={styles.lines} aria-label={`${box.label} 품목`}>
                      {box.lines.map((line) => (
                        <ItemLine key={line.key} line={line} manual={manual} setManual={setManual} />
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            <section className={styles.side} aria-labelledby="hell-stages-heading">
              <h2 id="hell-stages-heading" className={styles.sectionTitle}>
                단계별 가장 좋은 상자
              </h2>
              <table className={styles.table}>
                <caption className={styles.sr}>
                  {kindLabel} {level} 단계별 가장 좋은 상자의 값(지금 값 기준)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">단계</th>
                    <th scope="col">가장 좋은 상자</th>
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
              {/* A select, not a segmented row: the side column is narrow, and the row
                  measured itself again when the web font came and went vertical, moving the
                  note below (1280 CLS 0.0064). */}
              <label className={styles.stage} htmlFor={basisId}>
                <span>시세 기준</span>
                <Select
                  id={basisId}
                  value={basis}
                  onValueChange={(v) => setBasis(v as PriceBasis)}
                  items={priceBases.map((item) => ({ value: item.value, label: item.label }))}
                />
              </label>
              <p className={styles.note}>
                열쇠 1개로 보이는 상자 가운데 하나를 열어요. 상자마다 그 안의 보상과 기본 보상을 더해 값이 큰 순서로
                보여 줘요. 어떤 상자가 보일지는 셈하지 않았고, 무기 +25 · 페온 효과도 이 계산에 넣지 않았어요. 둘 중 하나를
                고르는 보상은 값이 큰 쪽으로 셈하고, 시세가 없는 품목은 직접 정한 값(처음엔 0G)으로 셈해요.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 거래소 시세 기반 계산</footer>
    </div>
  );
}
