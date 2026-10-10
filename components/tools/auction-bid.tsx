"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Gavel, Info } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MAX_PARTY,
  MIN_PARTY,
  PARTY_PRESETS,
  calculateAuction,
  formatGold,
  formatSigned,
  parseGold,
  partyError,
  priceError,
  type AuctionResult,
  type StrategyId,
} from "@/lib/tools/auction";
import quote from "./material-quote.module.css";
import styles from "./auction-bid.module.css";

const STRATEGY_COPY: Record<
  StrategyId,
  { name: string; note: string; formula: string }
> = {
  preempt: {
    name: "선점",
    note: "누가 10% 올려 불러도 남는 게 없는 값",
    formula: "판매 손익 분기 ÷ 1.1",
  },
  keep75: {
    name: "이득 75%",
    note: "남는 골드가 선점의 4분의 3 정도",
    formula: "판매 손익 분기 ÷ 1.075",
  },
  keep50: {
    name: "이득 50%",
    note: "남는 골드가 선점의 절반 정도",
    formula: "판매 손익 분기 ÷ 1.05",
  },
  keep25: {
    name: "이득 25%",
    note: "남는 골드가 선점의 4분의 1 정도",
    formula: "판매 손익 분기 ÷ 1.025",
  },
  breakEven: {
    name: "판매 손익 분기",
    note: "팔면 파티원과 똑같이 나눠 갖게 되는 값",
    formula: "판매가 × 0.95 × (인원 − 1) ÷ 인원",
  },
  useMyself: {
    name: "직접 사용",
    note: "팔지 않고 쓸 때 여기까지는 손해가 아니에요",
    formula: "가격 × (인원 − 1) ÷ 인원 — 수수료 없음",
  },
};

function FormulaTip({ label, formula }: { label: string; formula: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={styles.tipButton}
        aria-label={`${label} 계산식`}
      >
        <Info size={14} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{formula}</TooltipContent>
    </Tooltip>
  );
}

// Embedded browsers and some in-app webviews refuse the Clipboard API; the
// selection-based copy still works there.
function legacyCopy(text: string) {
  const previous = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  previous?.focus();
  return ok;
}

function useCopy() {
  const [copied, setCopied] = useState<{ id: StrategyId; ok: boolean } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy(id: StrategyId, value: number) {
    let ok = true;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      ok = legacyCopy(String(value));
    }
    setCopied({ id, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }
  return { copied, copy };
}

// Worked example for the empty state (same formula as the result).
const EXAMPLE = calculateAuction(100_000, 8);

function BidPick({ result }: { result: AuctionResult | null }) {
  const { copied, copy } = useCopy();
  if (!result)
    return (
      <section className={styles.pick} aria-labelledby="auction-pick">
        <p id="auction-pick" className={styles.pickLabel}>
          이 값까지 입찰하세요
        </p>
        <p className={styles.pickEmpty}>
          아이템 가격과 파티 인원을 넣으면 손해 보지 않는 입찰 상한을 알려 드려요.
        </p>
        <p className={styles.pickNote}>
          예: 거래소 {formatGold(EXAMPLE.price)} · {EXAMPLE.party}인이면 {formatGold(EXAMPLE.breakEven)}까지
        </p>
        <p className={styles.pickAlt}>
          남기고 싶다면 선점 {formatGold(EXAMPLE.strategies[0].bid)}처럼 더 낮은 값도 함께 알려 드려요
        </p>
      </section>
    );
  const done = copied?.id === "breakEven";
  const preempt = result.strategies.find((item) => item.id === "preempt");
  return (
    <section className={styles.pick} aria-labelledby="auction-pick">
      <p id="auction-pick" className={styles.pickLabel}>
        이 값까지 입찰하세요 <span className={styles.badge}>추천</span>
      </p>
      <p className={styles.pickValue}>
        <button
          type="button"
          className={styles.copy}
          onClick={() => copy("breakEven", result.breakEven)}
          aria-label={`추천 입찰 상한 ${formatGold(result.breakEven)} 복사`}
        >
          <span>{formatGold(result.breakEven)}</span>
          {done && copied.ok ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </p>
      <p className={styles.pickNote}>
        판매 손익 분기 · 이보다 높게 부르면 팔아도 손해예요. 직접 쓸 거라면 {formatGold(result.useMyself)}까지.
      </p>
      {preempt && (
        <p className={styles.pickAlt}>
          남기고 싶다면 <b>선점 {formatGold(preempt.bid)}</b> · 팔면 {formatSigned(preempt.saleProfit)} 남아요
        </p>
      )}
      <p className={styles.sr} role="status" aria-live="polite">
        {done ? (copied.ok ? "추천 입찰 상한을 복사했어요." : "복사하지 못했어요.") : ""}
      </p>
    </section>
  );
}

function Summary({ result }: { result: AuctionResult | null }) {
  const value = (pick: (r: AuctionResult) => number) =>
    result ? formatGold(pick(result)) : "—";
  return (
    <section className={styles.summary} aria-labelledby="auction-summary">
      <h2 id="auction-summary" className={styles.sr}>
        요약
      </h2>
      <div className={styles.headline}>
        <div>
          <p className={styles.headLabel}>
            판매 손익 분기
            <FormulaTip
              label="판매 손익 분기"
              formula={STRATEGY_COPY.breakEven.formula}
            />
          </p>
          <p className={styles.headValue} data-tone="sale">
            {value((r) => r.breakEven)}
          </p>
          <p className={styles.headNote}>거래소에 팔 때 · 수수료 5% 반영</p>
        </div>
        <div>
          <p className={styles.headLabel}>
            직접 사용 손익 분기
            <FormulaTip
              label="직접 사용 손익 분기"
              formula={STRATEGY_COPY.useMyself.formula}
            />
          </p>
          <p className={styles.headValue}>{value((r) => r.useMyself)}</p>
          <p className={styles.headNote}>내가 쓸 때 · 수수료 없음</p>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>판매하면 받는 골드</dt>
          <dd>{value((r) => r.saleGold)}</dd>
        </div>
        <div>
          <dt>거래소 수수료 5%</dt>
          <dd>{value((r) => r.fee)}</dd>
        </div>
        <div>
          <dt>1인 분배금 (판매 손익 분기)</dt>
          <dd>{value((r) => r.breakEvenShare)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Strategies({ result }: { result: AuctionResult | null }) {
  const { copied, copy } = useCopy();
  const rows = result?.strategies ?? null;
  const ids = Object.keys(STRATEGY_COPY) as StrategyId[];
  return (
    <section className={styles.strategies} aria-labelledby="auction-bids">
      <div className={styles.tableHead}>
        <h2 id="auction-bids">입찰가</h2>
        <p className={quote.caption}>입찰가를 누르면 복사돼요</p>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">전략</th>
            <th scope="col" className={styles.num}>
              입찰가
            </th>
            <th scope="col" className={styles.num}>
              <span className={styles.thTip}>
                판매 시 손익
                <FormulaTip
                  label="판매 시 손익"
                  formula="판매 손익 분기 − 입찰가. 팔았을 때 똑같이 나눈 몫보다 더 남는 골드예요."
                />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const row = rows?.find((r) => r.id === id) ?? null;
            const text = STRATEGY_COPY[id];
            const done = copied?.id === id;
            return (
              <tr
                key={id}
                data-kind={id === "useMyself" ? "use" : "sale"}
                data-pick={(row && id === "breakEven") || undefined}
              >
                <th scope="row">
                  <span className={styles.strategyName}>
                    {text.name}
                    {row && id === "breakEven" && <span className={styles.badge}>추천</span>}
                    <FormulaTip label={text.name} formula={text.formula} />
                  </span>
                  <span className={styles.strategyNote}>{text.note}</span>
                </th>
                <td className={styles.num}>
                  {row ? (
                    <button
                      type="button"
                      className={styles.copy}
                      onClick={() => copy(id, row.bid)}
                      aria-label={`${text.name} 입찰가 ${formatGold(row.bid)} 복사`}
                    >
                      <span className={styles.bid}>{formatGold(row.bid)}</span>
                      {done && copied.ok ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className={styles.bid}>—</span>
                  )}
                  {row && (
                    <span className={styles.share}>
                      1인 {formatGold(row.share)}
                    </span>
                  )}
                </td>
                <td
                  className={styles.num}
                  data-sign={
                    row ? Math.sign(row.saleProfit) : undefined
                  }
                >
                  {row ? formatSigned(row.saleProfit) : "—"}
                  {row && row.saleProfit < 0 && <span className={styles.loss}> 손해</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.copyStatus} role="status" aria-live="polite">
        {copied
          ? copied.ok
            ? `${STRATEGY_COPY[copied.id].name} 입찰가를 복사했어요.`
            : "복사하지 못했어요. 값을 직접 선택해 복사해 주세요."
          : ""}
      </p>
      <p className={quote.caption}>
        경매에 쓴 골드는 낙찰자 몫 없이{" "}
        {result ? `나머지 ${result.party - 1}명에게` : "나머지 인원에게"} 고르게
        돌아가요. 표의 &lsquo;1인&rsquo;은 그 값에 낙찰됐을 때 다른 한 사람이
        받는 골드예요.
      </p>
    </section>
  );
}

function Basis() {
  return (
    <details className={styles.basis}>
      <summary>계산 기준</summary>
      <ul>
        <li>
          거래소 판매 수수료는 5%이고, 1골드 미만은 올려서 계산해요.
        </li>
        <li>
          낙찰 골드는 낙찰자에게 돌아가지 않고 나머지 인원이 나눠요. 손익
          분기는 낙찰자에게 남는 골드와 다른 한 사람의 몫이 같아지는
          입찰가예요.
        </li>
        <li>
          선점·이득 단계는 다음 입찰이 10% 이상 높아야 한다는 기준으로
          계산해요. <strong>추정</strong>: 일로아·로아랩이 같은 기준을 쓰지만
          공식 안내 문구는 아직 확인하지 못했어요.
        </li>
        <li>
          판매 손익 분기 = 가격 × 0.95 × (인원 − 1) ÷ 인원, 직접 사용 = 가격
          × (인원 − 1) ÷ 인원이에요. 선점은 판매 손익 분기 ÷ 1.1, 이득
          75%·50%·25%는 각각 ÷ 1.075·1.05·1.025예요.
        </li>
        <li>입찰가와 분배금은 골드 단위로 내려서 보여 줘요.</li>
        <li>
          계산은 브라우저에서만 해요. 입력한 가격은 서버로 보내지 않아요.
        </li>
      </ul>
    </details>
  );
}

function AuctionContent({
  initialPrice,
  initialParty,
}: {
  initialPrice: string;
  initialParty: number;
}) {
  const priceId = useId();
  const partyId = useId();
  const [priceText, setPriceText] = useState(initialPrice);
  const [party, setParty] = useState(initialParty);
  const [customText, setCustomText] = useState(
    PARTY_PRESETS.some((p) => p.size === initialParty)
      ? ""
      : String(initialParty),
  );

  const pError = priceError(priceText);
  const price = parseGold(priceText);
  const cParty = customText ? Number(customText) : null;
  const cError = cParty === null ? null : partyError(cParty);
  const result =
    price !== null && !pError && !cError
      ? calculateAuction(price, party)
      : null;

  // Keep the URL shareable without a server round trip.
  useEffect(() => {
    const params = new URLSearchParams();
    if (price !== null && !pError) params.set("price", String(price));
    params.set("party", String(party));
    window.history.replaceState(null, "", `?${params}`);
  }, [price, pError, party]);

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#auction-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="auction-main">
        <section className={quote.hero} aria-labelledby="auction-heading">
          {/* A still icon: the calculation is instant, so nothing here
              should read as loading. */}
          <span className={styles.heroIcon} aria-hidden="true">
            <Gavel size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 계산</p>
          <h1 id="auction-heading">경매 입찰가</h1>
          <p className={quote.heroCopy}>
            아이템 가격과 파티 인원으로 손해 없는 입찰가를 바로.
          </p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.columns}>
            <form
              className={styles.inputs}
              onSubmit={(event) => event.preventDefault()}
              noValidate
            >
              <h2 className={styles.inputsTitle}>조건</h2>
              <div className={quote.field}>
                <label htmlFor={priceId}>
                  <span>아이템 가격 (거래소 최저가)</span>
                </label>
                <div className={styles.goldInput}>
                  <input
                    id={priceId}
                    value={priceText}
                    onChange={(event) => setPriceText(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    maxLength={16}
                    aria-invalid={!!pError}
                    aria-describedby={pError ? `${priceId}-error` : undefined}
                  />
                  <em aria-hidden="true">G</em>
                </div>
                {pError && (
                  <p
                    id={`${priceId}-error`}
                    className={quote.inputError}
                    role="alert"
                  >
                    {pError}
                  </p>
                )}
              </div>

              <fieldset className={styles.party}>
                <legend>파티 인원</legend>
                <SegmentedControl
                  className={styles.partySegment}
                  aria-label="파티 인원"
                  // A typed size equal to a preset lights that preset too;
                  // an invalid or other typed size lights none.
                  value={!cError && PARTY_PRESETS.some((p) => p.size === party) ? party : null}
                  onValueChange={(value) => {
                    setCustomText("");
                    setParty(value as number);
                  }}
                >
                  {PARTY_PRESETS.map((preset) => (
                    <SegmentedItem
                      key={preset.size}
                      value={preset.size}
                      title={"hint" in preset ? preset.hint : undefined}
                    >
                      {preset.label}
                    </SegmentedItem>
                  ))}
                </SegmentedControl>
                <p className={styles.partyHint}>
                  30인은 필드 보스·카오스게이트 기준이에요.
                </p>
                <div className={quote.field}>
                  <label htmlFor={partyId}>
                    <span>
                      직접 입력 ({MIN_PARTY}~{MAX_PARTY}명)
                    </span>
                  </label>
                  <input
                    id={partyId}
                    className={styles.partyInput}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={3}
                    placeholder="예: 6"
                    value={customText}
                    onChange={(event) => {
                      const text = event.target.value;
                      setCustomText(text);
                      const next = Number(text);
                      if (text && !partyError(next)) setParty(next);
                    }}
                    aria-invalid={!!cError}
                    aria-describedby={cError ? `${partyId}-error` : undefined}
                  />
                  {cError && (
                    <p
                      id={`${partyId}-error`}
                      className={quote.inputError}
                      role="alert"
                    >
                      {cError}
                    </p>
                  )}
                </div>
              </fieldset>
              {!result && !pError && (
                <p className={styles.empty}>
                  {cError && price !== null
                    ? `인원을 ${MIN_PARTY}~${MAX_PARTY}명으로 고치면 계산해요.`
                    : "가격을 넣으면 인원에 맞는 입찰가를 계산해요."}
                </p>
              )}
            </form>

            <div className={styles.output}>
              <BidPick result={result} />
              <Summary result={result} />
              <Strategies result={result} />
              <Basis />
            </div>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 브라우저 안에서만 계산
      </footer>
    </div>
  );
}

export function AuctionBidTool(props: {
  initialPrice: string;
  initialParty: number;
}) {
  return (
    <AuctionContent {...props} />
  );
}
