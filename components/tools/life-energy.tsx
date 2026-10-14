"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Tree } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import { marketFailureCopy, priceBases, type MaterialPrice, type PriceBasis } from "@/lib/market/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MINUTE, useClock } from "@/components/home/clock";
import { CRAFT_DATA, craftGoldAfterCut, parsePercent, type OutputId } from "@/lib/tools/abidos-craft";
import {
  LIFE_DATA,
  dailyEnergy,
  lifeMarketNames,
  rankActivities,
  type ActivityResult,
  type Option,
  type Purpose,
  type Quote,
} from "@/lib/tools/life-energy";
import quote from "./material-quote.module.css";
import craft from "./abidos-craft.module.css";
import styles from "./life-energy.module.css";

const UNKNOWN = "미확인";
const DEFAULT_ENERGY = 10000;
const MAX_ENERGY = 1000000;
// The price API takes at most 20 names a request; this tool needs 25.
const NAMES_PER_REQUEST = 20;
const count = (value: number) => Math.round(value).toLocaleString("ko-KR");
const outputName = (id: OutputId) => CRAFT_DATA.outputs.find((o) => o.id === id)!.name;
const methodText = (o: Option, purpose: Purpose) =>
  o.kind === "raw" ? "캔 재료 그대로 팔기" : `${outputName(o.kind)} ${count(o.crafts)}번 만들어 ${purpose === "sell" ? "팔기" : "쓰기"}`;
const durationText = (minutes: number) => {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};
const agoText = (now: number, iso: string) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE));
  return minutes === 0 ? "방금 기준" : `${minutes}분 전 기준`;
};

/** A figure drawn as a new node whenever it changes, so it never slides as its width changes (A6). */
function Figure({ text, className }: { text: string; className?: string }) {
  return (
    <span key={text} className={className}>
      {text}
    </span>
  );
}

function PercentField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hintId = useId();
  const invalid = value !== "" && parsePercent(value) == null;
  return (
    <div className={craft.field}>
      <label htmlFor={id}>{label}</label>
      <div className={craft.percent}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
        />
        <span aria-hidden="true">%</span>
      </div>
      <p id={hintId} className={craft.small} data-error={invalid || undefined}>
        {invalid ? "0~100 사이 숫자(소수 한 자리까지)로 넣어 주세요." : hint}
      </p>
    </div>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={styles.switchRow}>
      <span>
        <label htmlFor={id}>{label}</label>
        <small id={hintId}>
          <Figure text={hint} />
        </small>
      </span>
      <Switch id={id} className="hit-44" aria-describedby={hintId} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ActivityRow({ result, scale, purpose, priced }: { result: ActivityResult; scale: number; purpose: Purpose; priced: boolean }) {
  const best = result.best;
  const share = best && scale > 0 ? Math.min(1, Math.max(0, best.value / scale)) : 0;
  return (
    <tr>
      <th scope="row">
        {result.activity.name}
        <small className={styles.method}>{!priced ? "" : best ? methodText(best, purpose) : `${UNKNOWN}: ${result.missing.join(", ")}`}</small>
        {/* Share of the top result: a plain proportion, drawn with transform only. */}
        <span className={styles.bar} aria-hidden="true">
          <i style={{ "--share": share } as CSSProperties} />
        </span>
      </th>
      <td className={craft.num} data-empty={(priced && !best) || undefined}>
        <Figure text={!priced ? "—" : best ? `${count(best.value)}` : UNKNOWN} className={best ? styles.gold : undefined} />
      </td>
      <td className={craft.num}>
        <Figure text={durationText(result.minutes)} />
      </td>
    </tr>
  );
}

export function LifeEnergyTool() {
  const [basis, setBasis] = useState<PriceBasis>("CURRENT_MIN_PRICE");
  const [energyText, setEnergyText] = useState("");
  const [blessed, setBlessed] = useState(false);
  const [feeCutText, setFeeCutText] = useState("");
  const [increaseText, setIncreaseText] = useState("");
  const [exchange, setExchange] = useState(true);
  const [purpose, setPurpose] = useState<Purpose>("sell");
  const energyId = useId();
  const energyHintId = useId();
  const typed = energyText === "" ? null : Number(energyText);
  const energyInvalid = typed != null && !(Number.isInteger(typed) && typed >= 1 && typed <= MAX_ENERGY);
  const energy = typed != null && !energyInvalid ? typed : DEFAULT_ENERGY;
  const feeCut = parsePercent(feeCutText) ?? 0;
  const increase = parsePercent(increaseText) ?? 0;
  const daily = dailyEnergy(blessed);

  const requested = useMemo(() => lifeMarketNames(), []);
  const prices = useQuery({
    queryKey: ["life-energy-prices", basis, requested],
    queryFn: async ({ signal }) => {
      const chunks = Array.from({ length: Math.ceil(requested.length / NAMES_PER_REQUEST) }, (_, i) =>
        requested.slice(i * NAMES_PER_REQUEST, (i + 1) * NAMES_PER_REQUEST),
      );
      const parts = await Promise.all(chunks.map((names) => postMaterialPrices({ priceBasis: basis, names }, signal)));
      return { ...parts[0], data: { ...parts[0].data, items: parts.flatMap((p) => p.data.items) } };
    },
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const now = useClock(MINUTE);
  const limit = useRateLimit(prices.error);
  const priceList: MaterialPrice[] = useMemo(() => prices.data?.data.items ?? [], [prices.data]);
  const priced = !!prices.data;
  const failure =
    prices.error instanceof MarketQueryError
      ? prices.error.info
      : prices.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const observedAt = priceList.map((p) => p.observedAt).sort().at(-1);

  const results = useMemo(() => {
    const market = new Map<string, Quote>();
    for (const p of priceList)
      if (p.status === "PRICED" && p.bundlePrice != null && p.bundlePrice > 0 && p.bundleCount != null && p.bundleCount > 0)
        market.set(p.name, { bundlePrice: p.bundlePrice, bundleCount: p.bundleCount });
    return rankActivities(energy, (name) => market.get(name) ?? null, { feeCut, increase, exchange, purpose });
  }, [priceList, energy, feeCut, increase, exchange, purpose]);
  const top = priced ? results[0] : undefined;
  const topBest = top?.best ?? null;
  const scale = Math.max(1, ...results.map((r) => r.best?.value ?? 0));

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#life-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="life-main">
        <section className={quote.hero} aria-labelledby="life-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Tree size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="life-heading">생명의 기운 효율</h1>
          <p className={quote.heroCopy}>생명의 기운을 어디에 써야 가장 많이 버는지, 지금 거래소 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={craft.workspace}>
            <section className={craft.settings} aria-labelledby="life-settings">
              <h2 id="life-settings" className={craft.sectionTitle}>
                계산 조건
              </h2>
              <div className={craft.field}>
                <label htmlFor={energyId}>쓸 생명의 기운</label>
                <div className={craft.percent}>
                  <input
                    id={energyId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={DEFAULT_ENERGY.toLocaleString("ko-KR")}
                    aria-describedby={energyHintId}
                    aria-invalid={energyInvalid || undefined}
                    value={energyText}
                    onChange={(event) => setEnergyText(event.target.value.replace(/\D/g, "").slice(0, 7))}
                  />
                </div>
                <p id={energyHintId} className={craft.small} data-error={energyInvalid || undefined}>
                  {energyInvalid
                    ? `1~${MAX_ENERGY.toLocaleString("ko-KR")} 사이 정수로 넣어 주세요.`
                    : `비우면 ${DEFAULT_ENERGY.toLocaleString("ko-KR")}으로 계산해요.`}
                </p>
              </div>
              <SwitchRow
                label="베아트리스의 축복"
                hint={`하루 회복 ${daily.toLocaleString("ko-KR")} (10분마다 ${blessed ? LIFE_DATA.recovery.blessedPerTick : LIFE_DATA.recovery.perTick})`}
                checked={blessed}
                onChange={setBlessed}
              />
              <PercentField
                label="제작 수수료 감소"
                hint={`1회 제작 골드 ${CRAFT_DATA.outputs.map((o) => `${o.name.replace(" 융화 재료", "")} ${count(craftGoldAfterCut(o.gold, feeCut))}`).join(" · ")}`}
                value={feeCutText}
                onChange={setFeeCutText}
              />
              <PercentField
                label="대성공 확률 증가"
                hint="기본 5%에 (1 + 증가)를 곱해요."
                value={increaseText}
                onChange={setIncreaseText}
              />
              <SwitchRow
                label="교환 상인"
                hint="모자란 재료를 캔 재료로 바꿔 채워요. 사서 채우지는 않아요."
                checked={exchange}
                onChange={setExchange}
              />
              <div className={craft.field}>
                <span className={styles.fieldLabel} id={`${energyId}-purpose`}>
                  융화 재료
                </span>
                <SegmentedControl aria-labelledby={`${energyId}-purpose`} value={purpose} onValueChange={(v) => setPurpose(v as Purpose)}>
                  <SegmentedItem value="sell">팔기</SegmentedItem>
                  <SegmentedItem value="use">직접 쓰기</SegmentedItem>
                </SegmentedControl>
              </div>
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

            <section className={craft.list} aria-labelledby="life-results" aria-busy={prices.isPlaceholderData || undefined}>
              <h2 id="life-results" className={craft.sectionTitle}>
                <Figure text={`생명의 기운 ${energy.toLocaleString("ko-KR")}으로 벌면`} />
              </h2>
              {/* Held from the first paint: two lines for the answer, one for the day (A7). */}
              <div className={styles.answer} aria-live="polite">
                <p className={styles.headline}>
                  {topBest ? (
                    // Keyed by the sentence: a new figure redraws the line instead of sliding the words after it (A7).
                    <span key={`${top!.activity.id}-${count(topBest.value)}`}>
                      <strong>{top!.activity.name}</strong>에 쓰면 <strong className={styles.gold}>{count(topBest.value)}골드</strong>로 가장 많이 벌어요
                    </span>
                  ) : priced ? (
                    `${UNKNOWN}: 시세가 없는 재료가 있어요`
                  ) : (
                    ""
                  )}
                </p>
                <p className={craft.small}>
                  <Figure text={topBest ? methodText(topBest, purpose) : ""} />
                </p>
                <p className={styles.daily}>
                  <Figure text={`하루 생기(${daily.toLocaleString("ko-KR")})로 버는 골드`} />
                  <Figure text={topBest ? count((topBest.value / energy) * daily) : "—"} className={styles.gold} />
                </p>
              </div>
              <div className={craft.basis}>
                <SegmentedControl aria-label="시세 기준" value={basis} onValueChange={(value) => setBasis(value as PriceBasis)}>
                  {priceBases.map((item) => (
                    <SegmentedItem key={item.value} value={item.value}>
                      {item.label}
                    </SegmentedItem>
                  ))}
                </SegmentedControl>
                <p className={craft.small}>
                  거래소 {priceBases.find((b) => b.value === basis)?.label} 기준, 1분마다 새로 불러와요.
                  <span className={craft.agoLine}>{observedAt && now != null ? agoText(now, observedAt) : ""}</span>
                </p>
              </div>
              <div className={craft.tableScroll}>
                <table className={craft.table}>
                  <caption className={craft.sr}>생활 스킬별 생명의 기운 {energy.toLocaleString("ko-KR")}으로 버는 골드, 큰 순서</caption>
                  <colgroup>
                    <col className={styles.colActivity} />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">생활 스킬 · 방법</th>
                      <th scope="col" className={craft.num}>
                        버는 골드
                      </th>
                      <th scope="col" className={craft.num}>
                        걸리는 시간
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Keyed by rank: when the order changes the rows stay put and
                        their text is redrawn, instead of rows moving past each other (A7). */}
                    {results.map((r, rank) => (
                      <ActivityRow key={rank} result={r} scale={scale} purpose={purpose} priced={priced} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={craft.small}>
                생활 스킬마다 생명의 기운 1만당 캐는 평균 수량으로 재료를 정하고(등급마다 내림), 재료를 그대로 팔 때와 캔 재료만으로
                아비도스·상급 아비도스 융화 재료를 최대한 만들 때 중 더 많이 버는 쪽을 보여 줘요. 만들 때는 모자란 재료를 교환
                상인으로만 채우고(재료를 사지 않음), 쓴 재료의 판매 가치와 제작 골드를 빼고 남은 교환 결과물의 판매 가치를 더해요. 판매
                가치는 묶음 가격에서 판매 수수료 5%(1골드 미만 올림)를 뗀 값이에요. 융화 재료를 직접 쓰면 거래소 1개 가격으로 매겨요.
                하루 회복은 10분마다 {LIFE_DATA.recovery.perTick}(베아트리스의 축복 {LIFE_DATA.recovery.blessedPerTick})로 계산해요.
                생활 도구·부적·생활 스킬 레벨 효과와 채집 1회 소모량은 확인된 수치가 없어 넣지 않았어요. 시세가 없는 재료는 0이
                아니라 {UNKNOWN}으로 둬요. 확인 {LIFE_DATA.checkedAt}.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 생명의 기운 효율 계산</footer>
    </div>
  );
}
