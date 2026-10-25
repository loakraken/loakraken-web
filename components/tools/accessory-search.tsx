"use client";
// T4 악세 경매 검색기 (checklist N13, backend #431). Conditions go to the
// backend, which reads the official auction house; the list shows each
// listing as the official answer has it. The official count is not shown as
// a total (the main-stat filter runs after it), a partial page range says so,
// and nothing names a source (사용자 결정 10-12).
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, SearchNormal } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { Select } from "@/components/ui/select";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { failureOf, rateLimitCopy, secondsUntil, retryLabel, RATE_LIMITED } from "@/lib/api/rate-limit";
import { AccessorySearchError, postAccessorySearch } from "@/lib/accessory-search/client";
import {
  ENLIGHTENMENT_MAX,
  GRADES,
  LEVELS,
  OPTIONS_BY,
  POLISH_OPTIONS,
  ROLES,
  SLOTS,
  coverageText,
  levelLabel,
  polishValue,
  type Grade,
  type Level,
  type PolishOption,
  type Role,
  type SearchItem,
  type SearchRequest,
  type Slot,
} from "@/lib/accessory-search/model";
import { koreanGold } from "@/lib/spec-up/model";
import { ListingDetail } from "./accessory-detail";
import quote from "./material-quote.module.css";
import styles from "./accessory-search.module.css";

const ANY = "ANY";
const OFF = "OFF";
const RANGE_STEPS = [50, 60, 70, 80, 90];
const QUALITY_STEPS = [50, 70, 90];

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Seconds until retryAt for the shared 429 notice or a busy 503, ticking. */
function useWait(error: unknown) {
  const failure = failureOf(error);
  const waits = failure?.code === RATE_LIMITED || failure?.code === "MARKET_SEARCH_BUSY";
  const retryAt = waits ? failure?.retryAt : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [retryAt]);
  return { code: failure?.code ?? null, seconds: secondsUntil(retryAt, now) };
}

function failureCopy(code: string | null, limit?: "client") {
  switch (code) {
    case RATE_LIMITED:
      return rateLimitCopy({ limit });
    case "MARKET_SEARCH_BUSY":
      return { title: "검색이 몰리고 있어요", text: "잠시 뒤 다시 검색해 주세요." };
    case "NOT_FOUND":
      return { title: "악세 경매 검색은 아직 열리지 않았어요", text: "준비가 끝나면 이 화면에서 바로 검색할 수 있어요." };
    case "INVALID_AUCTION_FILTER":
    case "INVALID_REQUEST":
      return { title: "이 조건으로는 검색할 수 없어요", text: "부위에 붙지 않는 연마 효과나 범위를 넘는 값이 있는지 확인해 주세요." };
    default:
      return { title: "검색하지 못했어요", text: "잠시 뒤 다시 시도해 주세요." };
  }
}

export function AccessorySearchTool() {
  const [slot, setSlot] = useState<Slot>("NECKLACE");
  const [grade, setGrade] = useState<Grade>("ANCIENT");
  const [role, setRole] = useState<Role>("DEALER");
  const [polish, setPolish] = useState<Partial<Record<PolishOption, Level | typeof ANY | typeof OFF>>>({});
  const [enlightenment, setEnlightenment] = useState<string>(ANY);
  const [range, setRange] = useState<string>(ANY);
  const [quality, setQuality] = useState<string>(ANY);
  const [request, setRequest] = useState<SearchRequest | null>(null);

  const options = OPTIONS_BY[role][slot];
  const enlightenmentMax = ENLIGHTENMENT_MAX[grade][slot];

  const search = useInfiniteQuery({
    queryKey: ["accessory-search", request],
    queryFn: ({ pageParam, signal }) => postAccessorySearch({ ...request!, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => last.data.nextPage ?? undefined,
    enabled: request !== null,
    staleTime: 120_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const wait = useWait(search.error);
  const pages = search.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data.items);
  const last = pages.at(-1)?.data;
  const pagesRead = pages.reduce((sum, page) => sum + page.data.scannedPages, 0);
  const failure = search.error instanceof AccessorySearchError ? search.error.info.code : search.error ? "ERROR" : null;
  const limitKind = search.error instanceof AccessorySearchError ? search.error.info.limit : undefined;
  const busy = search.isFetching || wait.seconds > 0;

  const submit = () => {
    if (busy) return;
    const lines = options.flatMap((option) => {
      const value = polish[option] ?? OFF;
      if (value === OFF) return [];
      return [{ option, level: value === ANY ? null : value }];
    });
    setRequest({
      slot,
      grade,
      polish: lines,
      enlightenmentMin: enlightenment === ANY ? null : Math.min(Number(enlightenment), enlightenmentMax),
      mainStatRangeMinPct: range === ANY ? null : Number(range),
      minQuality: quality === ANY ? null : Number(quality),
      sort: "BUY_PRICE",
      page: 1,
    });
  };

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#accessory-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="accessory-main">
        <section className={quote.hero} aria-labelledby="accessory-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <SearchNormal size={18} />
          </span>
          <p className={quote.heroKicker}>경매장</p>
          <h1 id="accessory-heading">악세 경매 검색</h1>
          <p className={quote.heroCopy}>연마 효과·깨달음·힘민지 범위로 T4 장신구 매물을 찾아요.</p>
          <Link href="/tools" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 도구 전체
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={quote.card} aria-labelledby="accessory-conditions">
              <h2 id="accessory-conditions">검색 조건</h2>
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <Segment label="부위" value={slot} items={SLOTS} onChange={(v) => setSlot(v as Slot)} />
                <Segment label="등급" value={grade} items={GRADES} onChange={(v) => setGrade(v as Grade)} />
                <Segment label="역할" value={role} items={ROLES} onChange={(v) => setRole(v as Role)} />

                <fieldset className={styles.polish}>
                  <legend>연마 효과</legend>
                  {/* One row per effect the slot carries for this role (at most two). */}
                  <div className={styles.polishRows}>
                    {options.map((option) => (
                      <Field key={option} label={POLISH_OPTIONS[option].name}>
                        {(id) => (
                          <Select
                            aria-labelledby={id}
                            value={polish[option] ?? OFF}
                            items={[
                              { value: OFF, label: "상관없음" },
                              { value: ANY, label: "붙어 있기만" },
                              ...LEVELS.map((level) => ({ value: level.id, label: `${level.label} 이상` })),
                            ]}
                            onValueChange={(next) =>
                              setPolish((prev) => ({ ...prev, [option]: next as Level | typeof ANY | typeof OFF }))
                            }
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </fieldset>

                <div className={styles.numbers}>
                  <Field label="깨달음 최소">
                    {(id) => (
                      <Select
                        aria-labelledby={id}
                        value={enlightenment === ANY ? ANY : String(Math.min(Number(enlightenment), enlightenmentMax))}
                        items={[
                          { value: ANY, label: "상관없음" },
                          ...Array.from({ length: enlightenmentMax }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 이상` })),
                        ]}
                        onValueChange={setEnlightenment}
                      />
                    )}
                  </Field>
                  <Field label="힘민지 범위 최소">
                    {(id) => (
                      <Select
                        aria-labelledby={id}
                        value={range}
                        items={[{ value: ANY, label: "상관없음" }, ...RANGE_STEPS.map((v) => ({ value: String(v), label: `${v}% 이상` }))]}
                        onValueChange={setRange}
                      />
                    )}
                  </Field>
                  <Field label="품질 최소">
                    {(id) => (
                      <Select
                        aria-labelledby={id}
                        value={quality}
                        items={[{ value: ANY, label: "상관없음" }, ...QUALITY_STEPS.map((v) => ({ value: String(v), label: `${v} 이상` }))]}
                        onValueChange={setQuality}
                      />
                    )}
                  </Field>
                </div>
                <button type="submit" className={styles.submit} aria-disabled={busy || undefined}>
                  {search.isFetching && !search.isFetchingNextPage ? "검색하는 중…" : "검색"}
                </button>
              </form>
              <p className={quote.caption}>즉시 구매가가 낮은 순서로 보여 드려요. 힘민지 범위는 부위와 연마 단계별 최솟값~최댓값 중 위치예요.</p>
            </section>

            <section className={quote.card} aria-labelledby="accessory-results">
              <h2 id="accessory-results">매물</h2>
              {/* Held lines: the status and coverage never move the list (A7). */}
              <p className={styles.meta} aria-live="polite">
                {last ? `${kst.format(new Date(last.observedAt))} 조회` : ""}
                {last && coverageText(last, pagesRead) ? ` · ${coverageText(last, pagesRead)}` : ""}
              </p>
              <div aria-busy={search.isFetching || undefined} data-stale={(search.isFetching && !search.isFetchingNextPage) || undefined} className={styles.results}>
                {failure && !search.isFetchingNextPage ? (
                  <div className={styles.failure} role="alert">
                    <strong>{failureCopy(failure, limitKind).title}</strong>
                    <p>{failureCopy(failure, limitKind).text}</p>
                    {failure !== "NOT_FOUND" && (
                      <button type="button" aria-disabled={busy || undefined} onClick={() => !busy && void search.refetch()}>
                        {retryLabel(wait.seconds, "다시 검색")}
                      </button>
                    )}
                  </div>
                ) : request === null ? (
                  <p className={styles.muted}>조건을 고르고 검색을 눌러 주세요.</p>
                ) : !search.data ? (
                  <p className={styles.muted} role="status">
                    매물을 찾고 있어요
                  </p>
                ) : items.length === 0 ? (
                  <p className={styles.muted}>
                    {last?.complete ? "조건에 맞는 매물이 없어요." : `찾은 페이지(${pagesRead}쪽) 안에는 조건에 맞는 매물이 없어요.`}
                  </p>
                ) : (
                  <ol className={styles.list}>
                    {items.map((item, i) => (
                      <Listing
                        key={`${item.name}-${i}`}
                        item={item}
                        slotLabel={SLOTS.find((s) => s.id === request?.slot)?.label ?? ""}
                      />
                    ))}
                  </ol>
                )}
              </div>
              {search.hasNextPage && !failure && (
                <button
                  type="button"
                  className={styles.more}
                  aria-disabled={search.isFetchingNextPage || undefined}
                  onClick={() => !search.isFetchingNextPage && void search.fetchNextPage()}
                >
                  {search.isFetchingNextPage ? "더 찾는 중…" : "더 보기"}
                </button>
              )}
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · T4 악세 경매 검색</footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className={quote.field}>
      <span id={id}>{label}</span>
      {children(id)}
    </div>
  );
}

function Segment({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={styles.segment}>
      <span id={id}>{label}</span>
      {/* Two or three short labels fit one row at every width: fixed, no measuring (A6). */}
      <SegmentedControl aria-labelledby={id} orientation="horizontal" value={value} onValueChange={(v) => onChange(v as string)}>
        {items.map((item) => (
          <SegmentedItem key={item.id} value={item.id} className="px-3">
            {item.label}
          </SegmentedItem>
        ))}
      </SegmentedControl>
    </div>
  );
}

function Listing({ item, slotLabel }: { item: SearchItem; slotLabel: string }) {
  return (
    <li className={styles.item}>
      {/* The whole row opens the listing's card (사용자 10-16). */}
      <ListingDetail item={item} slotLabel={slotLabel} polishValue={polishValue} />
      <div className={styles.itemHead}>
        <strong>{item.name}</strong>
        <span className={styles.price}>
          {item.buyPrice == null ? <span className={styles.muted}>입찰만 가능</span> : `${koreanGold(item.buyPrice)}G`}
        </span>
      </div>
      <ul className={styles.polishLines} aria-label="연마 효과">
        {item.polish.map((line, i) => (
          <li key={`${line.name}-${i}`} data-core={line.option ? "" : undefined}>
            {line.shortName ?? line.name} {polishValue(line)}
            {levelLabel(line.level) && <b> {levelLabel(line.level)}</b>}
          </li>
        ))}
      </ul>
      <dl className={styles.facts}>
        <div>
          <dt>품질</dt>
          <dd>{item.quality ?? "—"}</dd>
        </div>
        <div>
          <dt>깨달음</dt>
          <dd>{item.enlightenment ?? "—"}</dd>
        </div>
        <div>
          <dt>힘민지 범위</dt>
          <dd>{item.mainStatRangePct == null ? "—" : `${item.mainStatRangePct.toFixed(2)}%`}</dd>
        </div>
        <div>
          <dt>입찰 시작가</dt>
          <dd>{item.bidStartPrice == null ? "—" : `${koreanGold(item.bidStartPrice)}G`}</dd>
        </div>
        <div>
          <dt>거래</dt>
          <dd>{item.tradeAllowCount == null ? "—" : item.tradeAllowCount === 0 ? "거래 불가" : `${item.tradeAllowCount}회 가능`}</dd>
        </div>
        <div>
          <dt>종료</dt>
          <dd>{item.endDate ? kst.format(new Date(item.endDate)) : "—"}</dd>
        </div>
      </dl>
    </li>
  );
}
