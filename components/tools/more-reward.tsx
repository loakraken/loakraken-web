"use client";

import { Fragment, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, Gift } from "@/components/ui/icons";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { MarketQueryError, postMaterialPrices } from "@/lib/market/client";
import {
  marketFailureCopy,
  priceBases,
  type MaterialPrice,
  type PriceBasis,
} from "@/lib/market/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { MINUTE, useClock } from "@/components/home/clock";
import {
  CHOICE_EXCHANGES,
  EXCHANGES,
  GUARANTEE_EXCHANGES,
  guaranteeRecipe,
  guaranteeValue,
  INPUT_MATERIALS,
  MORE_DATA,
  exchangeValue,
  boundGoldFor,
  gateKey,
  gateResult,
  marketNames,
  priceNames,
  type GateResult,
  type MoreGate,
  type MoreRaid,
} from "@/lib/tools/more-reward";
import quote from "./material-quote.module.css";
import styles from "./more-reward.module.css";

type Quantities = Record<string, Partial<Record<string, number>>>;

const STORE_KEY = "loakraken:more-reward:quantities";
const count = (value: number) => Math.round(value).toLocaleString("ko-KR");
/** Decided without quantities: fixed items alone already cover the cost. */
/** "방금 기준" · "3분 전 기준" from the newest price reading. */
const agoText = (now: number, iso: string) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE));
  return minutes === 0 ? "방금 기준" : `${minutes}분 전 기준`;
};

const certain = (r: GateResult) => !r.hasInput && r.gain >= 0;
const decided = (r: GateResult) => r.hasInput || certain(r);

const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}`;
const unitText = (value: number) =>
  value.toLocaleString("ko-KR", { maximumFractionDigits: value < 1 ? 4 : 2 });

// Per-viewer convenience: quantities typed from the game survive a reload.
// Read through useSyncExternalStore so the server render (no storage) and the
// first client render agree.
const subscribe = () => () => {};
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}
function parseStored(raw: string | null): Quantities {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Quantities) : {};
  } catch {
    return {};
  }
}
function writeStored(value: Quantities) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Storage may be blocked; the screen works without it.
  }
}

function GateDetail({
  title,
  result,
  quantities,
  onQuantity,
  boundGold,
  excludeBound,
  note,
}: {
  title: string;
  result: GateResult;
  quantities: Partial<Record<string, number>>;
  onQuantity: (name: string, value: number) => void;
  boundGold: number | null;
  excludeBound: boolean;
  note: (name: string) => string | null;
}) {
  return (
    <div className={styles.detail}>
      <p className={styles.detailTitle}>{title}</p>
      <dl className={styles.sums}>
        <div>
          <dt>더보기 골드</dt>
          <dd>{count(result.paid)}G</dd>
        </div>
        <div>
          <dt>받는 재료 가치</dt>
          <dd>{count(result.value)}G</dd>
        </div>
        <div data-gain={result.gain >= 0 ? "up" : "down"}>
          <dt>이득</dt>
          <dd>{signed(result.gain)}G</dd>
        </div>
      </dl>
      {excludeBound && result.paid < result.cost && (
        <p className={styles.small}>
          더보기 골드 {count(result.cost)}G 중 귀속 골드 {count(result.cost - result.paid)}G는 빼고 계산했어요.
        </p>
      )}
      {excludeBound && boundGold === null && (
        <p className={styles.small}>
          이 관문은 귀속 골드를 하나로 정할 수 없어(자료 없음, 또는 노말과 싱글이 다름) 전액으로 계산했어요.
        </p>
      )}
      <ul className={styles.lines}>
        {result.lines.map((line) => (
          <li key={line.name}>
            <span>
              {line.name} <b>×{count(line.qty)}</b>
              {line.entered && <small>직접 입력</small>}
              {note(line.name) && <small>{note(line.name)}</small>}
            </span>
            <span>
              {line.unit == null ? "값 없음 · 0G" : `1개 ${unitText(line.unit)}G · ${count(line.value)}G`}
            </span>
          </li>
        ))}
      </ul>
      <fieldset className={styles.inputs}>
        <legend>재련 재료 수량</legend>
        <p className={styles.small}>
          재련 재료 수량은 공식 공개 자료가 없어요. 게임 입장 화면의 &lsquo;관문 정보&rsquo;에서 보이는 더보기
          수량을 넣어 주세요.
        </p>
        <div className={styles.inputGrid}>
          {INPUT_MATERIALS.map((name) => (
            <label key={name}>
              <span>{name}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={quantities[name] ?? ""}
                onChange={(event) =>
                  onQuantity(name, Number(event.target.value.replace(/\D/g, "") || 0))
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function RaidRows({
  raid,
  results,
  open,
  setOpen,
  renderDetail,
  bestKey,
}: {
  bestKey: string | null;
  raid: MoreRaid;
  results: Record<string, GateResult>;
  open: string | null;
  setOpen: (key: string | null) => void;
  renderDetail: (raid: MoreRaid, modeLabel: string, gate: MoreGate) => ReactNode;
}) {
  return (
    <>
      {raid.modes.map((mode, mi) => {
        const openGate = mode.gates.find((g) => open === gateKey(raid.id, mode.label, g.gate));
        return (
          <Fragment key={mode.label}>
            <tr>
              <th scope="row" className={styles.raid}>
                {mi === 0 ? raid.name : <span className={styles.sr}>{raid.name}</span>}
              </th>
              <td className={styles.mode}>{mode.label}</td>
              {[1, 2, 3].map((n) => {
                const gate = mode.gates.find((g) => g.gate === n);
                if (!gate) return <td key={n} aria-hidden="true" />;
                const key = gateKey(raid.id, mode.label, n);
                const r = results[key];
                return (
                  <td key={n}>
                    <button
                      type="button"
                      className={styles.cell}
                      aria-expanded={open === key}
                      data-gain={decided(r) ? (r.gain >= 0 ? "up" : "down") : "none"}
                      data-pick={bestKey === key || undefined}
                      onClick={() => setOpen(open === key ? null : key)}
                    >
                      {decided(r) ? (
                        <>
                          {bestKey === key && <em className={styles.pick}>추천</em>}
                          <b>
                            {certain(r) && <span className={styles.atLeast}>최소 </span>}
                            {signed(r.gain)}
                          </b>
                          <small>
                            {r.gain >= 0 ? "누르기" : "넘기기"} ·{" "}
                            {certain(r)
                              ? "재련 재료 빼고도 이득"
                              : r.paid > 0
                                ? `${(r.value / r.paid).toFixed(2)}배`
                                : "무료"}
                          </small>
                        </>
                      ) : (
                        <>
                          <b>수량 확인 중</b>
                          <small>더보기 {count(r.paid)}G · 재료 입력</small>
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
            {openGate && (
              <tr className={styles.detailRow}>
                <td colSpan={5}>{renderDetail(raid, mode.label, openGate)}</td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export function MoreRewardTool() {
  const [basis, setBasis] = useState<PriceBasis>("RECENT_PRICE");
  const [excludeBound, setExcludeBound] = useState(false);
  const storedRaw = useSyncExternalStore(subscribe, readRaw, () => null);
  const stored = useMemo(() => parseStored(storedRaw), [storedRaw]);
  const [edited, setEdited] = useState<Quantities | null>(null);
  const quantities = edited ?? stored;
  const [userUnits, setUserUnits] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);


  const names = useMemo(() => priceNames(), []);
  const requested = useMemo(() => marketNames(), []);
  const prices = useQuery({
    queryKey: ["more-reward-prices", basis, requested],
    queryFn: ({ signal }) => postMaterialPrices({ priceBasis: basis, names: requested }, signal),
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const now = useClock(MINUTE);
  const limit = useRateLimit(prices.error);
  const priceList: MaterialPrice[] = prices.data?.data.items ?? [];
  const market = new Map(
    priceList
      .filter((p) => p.status === "PRICED" && p.unitPriceGold != null)
      .map((p) => [p.name, p.unitPriceGold as number]),
  );
  const marketPrice = (name: string) => market.get(name) ?? null;
  const unpricedNames = names.filter(
    (n) =>
      prices.data &&
      !market.has(n) &&
      exchangeValue(n, marketPrice) == null &&
      guaranteeValue(n, marketPrice) == null &&
      !(INPUT_MATERIALS as readonly string[]).includes(n),
  );
  const exchangeNote = (name: string) => {
    const recipe = EXCHANGES[name];
    // Only when the recipe actually priced it (not typed, contents priced).
    if (recipe && !userUnits[name] && exchangeValue(name, marketPrice) != null) return `${recipe.into}(${recipe.per}개 교환) 구성 시세 ÷ ${recipe.per}`;
    const least = guaranteeRecipe(name, marketPrice);
    if (least && !userUnits[name])
      return `최소 보장 가치: ${least.into}(${GUARANTEE_EXCHANGES[name].per}개 교환)에서 가장 싼 결과 ÷ ${GUARANTEE_EXCHANGES[name].per} · 결과 확률이 공개되지 않아 하한으로 매겨요`;
    return null;
  };
  const unitValue = (name: string) => {
    const typed = userUnits[name];
    if (typed !== undefined && typed !== "") return Number(typed);
    return market.get(name) ?? exchangeValue(name, marketPrice) ?? guaranteeValue(name, marketPrice);
  };
  // Automatic values the user may overwrite (고급 설정).
  const autoNames = [...Object.keys(EXCHANGES), ...Object.keys(GUARANTEE_EXCHANGES)].filter(
    (name) => names.includes(name) && !market.has(name),
  );
  const autoValue = (name: string) => exchangeValue(name, marketPrice) ?? guaranteeValue(name, marketPrice);

  const results: Record<string, GateResult> = {};
  for (const raid of MORE_DATA.raids)
    for (const mode of raid.modes)
      for (const gate of mode.gates) {
        const key = gateKey(raid.id, mode.label, gate.gate);
        results[key] = gateResult(
          gate,
          quantities[key] ?? {},
          unitValue,
          boundGoldFor(raid.id, mode.label, gate.gate),
          excludeBound,
        );
      }
  const entered = Object.values(results).filter(decided);
  const pending = Object.values(results).length - entered.length;
  const best = MORE_DATA.raids
    .flatMap((raid) =>
      raid.modes.flatMap((mode) =>
        mode.gates.map((g) => ({ key: gateKey(raid.id, mode.label, g.gate), title: `${raid.name} ${mode.label} ${g.gate}관문`, r: results[gateKey(raid.id, mode.label, g.gate)] })),
      ),
    )
    .filter((x) => decided(x.r))
    .sort((a, b) => b.r.gain - a.r.gain)[0];
  const failure =
    prices.error instanceof MarketQueryError
      ? prices.error.info
      : prices.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  const observedAt = priceList.map((p) => p.observedAt).sort().at(-1);

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#more-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="more-main">
        <section className={quote.hero} aria-labelledby="more-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Gift size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 · 보상</p>
          <h1 id="more-heading">더보기 손익</h1>
          <p className={quote.heroCopy}>관문마다 더보기를 누르면 남는지, 지금 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={styles.main} aria-labelledby="gates-heading">
              <h2 id="gates-heading" className={styles.sectionTitle}>
                관문별 더보기
              </h2>
              <div className={styles.verdict} aria-live="polite">
                {entered.length === 0 ? (
                  <p>시세를 불러오고 있어요. 관문을 눌러 재련 재료 수량을 넣으면 그 관문도 판정해요.</p>
                ) : (
                  <>
                    <p className={styles.verdictHead}>
                      누를 더보기 <b>{entered.filter((r) => r.gain >= 0).length}</b>관문
                      <span> · 결론 난 {entered.length}관문 중</span>
                    </p>
                    {best && best.r.gain >= 0 ? (
                      <p>
                        <em className={styles.pick}>추천</em> {best.title} <b className={styles.up}>{signed(best.r.gain)}G</b>
                      </p>
                    ) : (
                      <p>
                        <span className={styles.down} aria-hidden="true">✕ </span>결론 난 관문은 모두 손해예요.
                      </p>
                    )}
                    {pending > 0 && (
                      <p className={styles.small}>
                        나머지 {pending}관문은 재련 재료 수량이 확인되지 않아 판정에서 뺐어요(관문을 눌러 수량을 넣으면 판정).
                      </p>
                    )}
                  </>
                )}
              </div>
              <p className={styles.condition}>
                {priceBases.find((b) => b.value === basis)?.label} 기준
                {observedAt && now != null && ` · ${agoText(now, observedAt)}`} · 귀속 골드 제외 {excludeBound ? "켬" : "끔"} ·{" "}
                <a href="#value-heading">값 매기기 바꾸기</a>
              </p>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <caption className={styles.sr}>레이드·난이도·관문별 더보기 이득</caption>
                  <thead>
                    <tr>
                      <th scope="col">레이드</th>
                      <th scope="col">난이도</th>
                      <th scope="col">1관문</th>
                      <th scope="col">2관문</th>
                      <th scope="col">3관문</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MORE_DATA.raids.map((raid) => (
                      <RaidRows
                        key={raid.id}
                        raid={raid}
                        results={results}
                        open={open}
                        setOpen={setOpen}
                        bestKey={best && best.r.gain >= 0 ? best.key : null}
                        renderDetail={(r, label, gate) => {
                          const key = gateKey(r.id, label, gate.gate);
                          return (
                            <GateDetail
                              title={`${r.name} ${label} ${gate.gate}관문`}
                              result={results[key]}
                              quantities={quantities[key] ?? {}}
                              boundGold={boundGoldFor(r.id, label, gate.gate)}
                              excludeBound={excludeBound}
                              note={exchangeNote}
                              onQuantity={(name, value) => {
                                const next = {
                                  ...quantities,
                                  [key]: { ...quantities[key], [name]: value },
                                };
                                setEdited(next);
                                writeStored(next);
                              }}
                            />
                          );
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.small}>
                이득 = 받는 재료 가치 − 더보기 골드. 더보기 골드는 공식 공지 또는 실측 출처 2곳이 같은 값, 고정 품목은
                실측 출처 2곳이 같은 수량만 넣었어요(확인 {MORE_DATA.checkedAt}). &ldquo;최소&rdquo;는 재련 재료를 빼고
                고정 품목만으로 매긴 하한이에요.
              </p>
            </section>

            <aside className={styles.side} aria-labelledby="value-heading">
              <h2 id="value-heading" className={styles.sectionTitle}>
                재료 값 매기기
              </h2>
              <p className={styles.small}>
                거래소 {priceBases.find((b) => b.value === basis)?.label} 기준으로 자동으로 매기고 1분마다 새로 불러와요
                {observedAt && now != null && ` · ${agoText(now, observedAt)}`}.
              </p>
              {failure && (
                <div className={quote.notice}>
                  <div role="alert">
                    <strong>{marketFailureCopy(failure).title}</strong>
                    <p>{marketFailureCopy(failure).text}</p>
                  </div>
                  <button
                    type="button"
                    className={quote.outlinePill}
                    aria-disabled={prices.isFetching || limit.seconds > 0 || undefined}
                    aria-busy={prices.isFetching || undefined}
                    onClick={() => !prices.isFetching && limit.seconds === 0 && prices.refetch()}
                  >
                    {retryLabel(limit.seconds, "시세 다시 불러오기")}
                  </button>
                </div>
              )}
              <details className={styles.advanced}>
                <summary>고급 설정</summary>
              <SegmentedControl
                fill
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
              <label className={styles.switch}>
                <span>
                  <strong>귀속 골드 비용 제외</strong>
                  <small>더보기 골드는 귀속 골드부터 빠져요. 그만큼은 손익에 넣지 않아요.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={excludeBound}
                  onChange={(event) => setExcludeBound(event.target.checked)}
                />
                <i aria-hidden="true" />
              </label>
              {autoNames.length > 0 && (
                <fieldset className={styles.inputs}>
                  <legend>자동 값 바꾸기</legend>
                  <p className={styles.small}>비워 두면 자동 값(교환 구성 시세·최소 보장 가치)을 써요.</p>
                  <div className={styles.inputGrid}>
                    {autoNames.map((name) => {
                      const auto = autoValue(name);
                      return (
                        <label key={name}>
                          <span>{name}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder={auto == null ? "0" : auto.toFixed(2)}
                            value={userUnits[name] ?? ""}
                            onChange={(event) =>
                              setUserUnits((prev) => ({ ...prev, [name]: event.target.value.replace(/[^\d.]/g, "") }))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              </details>
              {unpricedNames.length > 0 && (
                <fieldset className={styles.inputs}>
                  <legend>시세가 없는 재료</legend>
                  <p className={styles.small}>거래소에 없는 재료는 1개 값을 직접 넣어 주세요. 넣지 않으면 0G예요.</p>
                  {unpricedNames.some((n) => (CHOICE_EXCHANGES as readonly string[]).includes(n)) && (
                    <p className={styles.small}>
                      죽음의 손·사령의 잔영은 결과 확률이 공개되지 않은 주머니로 바뀌고, 어떤 재료가 어떤 주머니가
                      되는지 아직 확인 중이라 자동으로 값을 매기지 않아요.
                    </p>
                  )}
                  <div className={styles.inputGrid}>
                    {unpricedNames.map((name) => (
                      <label key={name}>
                        <span>{name}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="0"
                          value={userUnits[name] ?? ""}
                          onChange={(event) =>
                            setUserUnits((prev) => ({ ...prev, [name]: event.target.value.replace(/[^\d.]/g, "") }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

            </aside>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공식 공지·거래소 시세 기반 계산
      </footer>
    </div>
  );
}
