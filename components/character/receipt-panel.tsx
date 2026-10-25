"use client";

import { useRef, useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshArrow } from "@/components/ui/icons";
import { InlineOrb } from "@/components/landing/orb";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import expand from "@/components/site/expand.module.css";
import { remainingText } from "@/lib/time/remaining";
import { countdownText, rateLimitCopy } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { labelOf } from "@/lib/api/tolerant";
import { CharacterQueryError, fetchReceipt } from "@/lib/character/client";
import {
  GEM_STATUS,
  GRADE_LABEL,
  coverageText,
  excludedLabel,
  excludedSummary,
  includedText,
  isReceiptOff,
  memberState,
  nextRefreshDelay,
  nonGoldText,
  notIncludedText,
  observedText,
  rowMarker,
  totalStatus,
  type Receipt,
  type ReceiptCharacter,
} from "@/lib/character/receipt";
import { useCrossfade } from "@/lib/motion";
import { MINUTE, useClock } from "@/components/home/clock";
import { useSecondsUntil } from "./card-refresh";
import { Panel } from "./panel";
import { kstTime, level } from "./parts";
import styles from "./receipt.module.css";

const gold = (value: number | null | undefined) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}G`;

function CharacterRow({ row, now }: { row: ReceiptCharacter; now: number | null }) {
  const state = memberState(row);
  const pending = state === "PENDING";
  // Not found this time (api receipt fan-out), or a status this screen does
  // not know: not counted, not asked for again.
  const unavailable = state === "UNAVAILABLE";
  const marker = rowMarker(row);
  const observed = now == null ? null : observedText(row.observedAt, now);
  return (
    <li>
      <details className={`${styles.row} ${expand.expand}`}>
        <summary>
          <span className={styles.who}>
            <strong>{row.characterName}</strong>
            <small>
              {row.className ?? "-"} · {level(row.itemLevel)}
              {observed && ` · ${observed}`}
            </small>
          </span>
          <span className={styles.amount}>
            {marker && (
              <>
                <span className={`${styles.tag} ${marker.partial ? styles.partialTag : ""}`} aria-hidden="true">
                  {marker.text}
                </span>
                <span className="sr-only">{marker.partial ? "일부만 계산" : `산정 제외 ${row.excluded.length}건`}</span>
              </>
            )}
            <b className={pending || unavailable ? styles.pending : undefined}>
              {pending ? "계산 대기" : unavailable ? "확인 못 함" : gold(row.gold)}
            </b>
          </span>
        </summary>
        {row.parts.length > 0 && (
          <ul className={styles.parts}>
            {row.parts.map((part, i) => (
              <li key={i}>
                <span>
                  {part.slot} · {labelOf(GRADE_LABEL, part.grade)} +{part.fromStage}→+{part.toStage}
                </span>
                <b>{gold(part.gold)}</b>
              </li>
            ))}
          </ul>
        )}
        {row.excluded.length > 0 && (
          <ul className={styles.excluded} aria-label="산정 제외">
            {row.excluded.map((item, i) => (
              <li key={i}>
                <span className={styles.tag}>{excludedLabel(item.reason)}</span>
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

function Body({
  data,
  refreshing,
  auto,
  onRecalculate,
  assumeBook,
  onAssumeBook,
}: {
  data: Receipt;
  refreshing: boolean;
  /** The panel is still filling pending members in by itself. */
  auto: boolean;
  onRecalculate: () => void;
  assumeBook: boolean;
  onAssumeBook: (next: boolean) => void;
}) {
  const until = data.coverage.nextAvailableAt ? Date.parse(data.coverage.nextAvailableAt) : undefined;
  const seconds = useSecondsUntil(until);
  const now = useClock(MINUTE);
  const notIncluded = notIncludedText(data);
  const status = totalStatus(data);
  const left = excludedSummary(data);
  const [leftShown, setLeftShown] = useState(false);
  if (left && !leftShown) setLeftShown(true);
  const idle = data.coverage.pending === 0 || auto;
  const nonGold = nonGoldText(data);
  const [nonGoldShown, setNonGoldShown] = useState(false);
  if (nonGold && !nonGoldShown) setNonGoldShown(true);
  const [first, ...rest] = data.assumptions;
  return (
    <>
      <div className={styles.total} data-status={status}>
        {status === "UNAVAILABLE" ? (
          <>
            <strong>합계 없음</strong>
            <p>아직 계산한 금액이 없어요.</p>
          </>
        ) : (
          <>
            <strong>
              {gold(data.total.gold)}
              {status === "PARTIAL" && <span className={`${styles.tag} ${styles.partialTag}`}>일부 합계</span>}
            </strong>
            <p>
              {status === "PARTIAL"
                ? `${includedText(data)} 중 계산한 것만 더했어요. 실제 합계는 더 커요.`
                : `${includedText(data)} 합계`}
            </p>
          </>
        )}
        {/* Once shown, these lines keep their place: they change length or
            empty as pending members fill in, and nothing under them may move (A7). */}
        {(nonGold || nonGoldShown) && (
          <p className={`${styles.muted} ${styles.leftLine}`} aria-hidden={nonGold ? undefined : true}>
            {nonGold && `골드 외 비용: ${nonGold}`}
          </p>
        )}
        {(left || leftShown) && (
          <p className={`${styles.muted} ${styles.leftLine}`} aria-hidden={left ? undefined : true}>
            {left && `빠진 것: ${left}`}
          </p>
        )}
        {notIncluded && <p className={styles.muted}>미포함: {notIncluded}</p>}
      </div>

      <div className={styles.assume}>
        <label>
          <input type="checkbox" checked={assumeBook} onChange={(event) => onAssumeBook(event.target.checked)} />
          책 효과 항상 적용 가정
        </label>
        {assumeBook && <p>책 효과가 적용된다고 가정했어요 · 끄면 책 없이 계산해요</p>}
        {first && <p>{first}</p>}
      </div>

      <div className={styles.coverage}>
        <p role="status">{coverageText(data, auto)}</p>
        <span className={styles.bar} aria-hidden="true">
          <i style={{ width: `${(data.coverage.ready / Math.max(1, data.coverage.rosterCharacters)) * 100}%` }} />
        </span>
        {/* By hand only once the panel stopped filling members in by itself;
            the slot stays so the row does not change height. While hidden it
            keeps one label: a changing one would resize it and move the bar. */}
        <span className={styles.againSlot} data-idle={idle || undefined}>
          <button
            type="button"
            className={styles.again}
            onClick={onRecalculate}
            aria-disabled={refreshing || seconds > 0 || undefined}
            // Spends official API calls: never pressed again after hydration.
            data-no-replay
          >
            {refreshing && !idle ? <InlineOrb /> : <RefreshArrow size={14} aria-hidden="true" />}
            {idle
              ? "다시 계산(2명씩)"
              : refreshing
                ? "계산하는 중"
                : seconds > 0
                  ? `${remainingText(seconds * 1000)} 뒤 다시 계산`
                  : "다시 계산(2명씩)"}
          </button>
        </span>
      </div>

      <section className={styles.block} aria-label="장비 재련">
        <h3>
          장비 재련 <b>{gold(data.equipment.gold)}</b>
        </h3>
        <ul className={styles.characters}>
          {data.equipment.characters.map((row) => (
            <CharacterRow key={row.characterName} row={row} now={now} />
          ))}
        </ul>
      </section>

      <section className={styles.block} aria-label="보석">
        <h3>
          보석 <b>{gold(data.gems.gold)}</b>
        </h3>
        <p className={styles.muted}>
          거래 가능 {data.gems.tradable}개 중 {data.gems.priced}개 환산 · 귀속 {data.gems.bound}개 제외
          {data.gems.unpriced > 0 && ` · 환산 못 함 ${data.gems.unpriced}개`}
        </p>
        {data.gems.items.length > 0 && (
          <ul className={styles.gems}>
            {data.gems.items.map((gem, i) => (
              <li key={i}>
                <span>
                  {gem.level}레벨 {gem.kind} × {gem.count}
                </span>
                <b className={gem.status === "PRICED" ? undefined : styles.pending}>
                  {gem.status === "PRICED" ? gold(gem.gold) : labelOf(GEM_STATUS, gem.status)}
                </b>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rest.length > 0 && (
        <ul className={styles.notes}>
          {rest.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>
        {data.priceObservedAt && `시세 ${kstTime(data.priceObservedAt)} 기준 · `}계산 {kstTime(data.computedAt)}
      </p>
    </>
  );
}

/**
 * Roster receipt (원정대 영수증), counting only verified items:
 * equipment refining and tradable gems at current prices. What it leaves out
 * and why sits right under the total; the backend's assumption sentences are
 * shown as they come. Hidden where the receipt is off (the backend route is
 * absent) and never requested for crawlers (the proxy refuses them).
 */
/**
 * Whether this deployment shows the receipt (RECEIPT_TOOL, decided by the
 * server page): when off the panel is never drawn, so the roster tab does not
 * show a loading box that then disappears.
 */
export const ReceiptEnabled = createContext(true);

export function ReceiptPanel({ name }: { name: string }) {
  if (!useContext(ReceiptEnabled)) return null;
  return <ReceiptPanelBody name={name} />;
}

function ReceiptPanelBody({ name }: { name: string }) {
  // Books on by default (PM 총괄 10-11 00:20): the receipt assumes them unless turned off.
  const [assumeBook, setAssumeBook] = useState(true);
  // Pending members are filled in by itself, two per request (api receipt
  // fan-out): while this panel is open and the tab is visible (React Query
  // pauses intervals in a hidden tab), at the backend's nextAvailableAt and
  // never sooner than 6 s (the visitor's official-call limit). It stops after two answers in a row that filled nobody
  // or on a failure (a rate limit shows its countdown); then "다시 계산" is by hand.
  const [fill, setFill] = useState({
    book: assumeBook,
    at: 0,
    pending: null as number | null,
    idle: 0,
    stopped: false,
  });
  const stopped = fill.stopped;
  const query = useQuery({
    queryKey: ["receipt", name, assumeBook],
    queryFn: ({ signal }) => fetchReceipt(name, assumeBook, signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const answer = q.state.data?.data;
      if (!answer || q.state.error) return false;
      return nextRefreshDelay(answer, Date.now(), stopped) ?? false;
    },
  });
  const pendingNow = query.data?.data.coverage.pending;
  // Each new answer: did it fill anyone in? Another book choice is another
  // receipt, which fills in by itself again.
  if (fill.book !== assumeBook) setFill({ book: assumeBook, at: 0, pending: null, idle: 0, stopped: false });
  else if (pendingNow != null && query.dataUpdatedAt !== fill.at) {
    const idle = fill.pending != null && pendingNow >= fill.pending ? fill.idle + 1 : 0;
    setFill({ ...fill, at: query.dataUpdatedAt, pending: pendingNow, idle, stopped: fill.stopped || idle >= 2 });
  }
  const auto = !stopped && !query.error && (pendingNow ?? 0) > 0;
  const fade = useCrossfade(query.isPending);
  const limit = useRateLimit(query.error);
  const info = query.error instanceof CharacterQueryError ? query.error.info : null;
  // A double click fires twice before React re-renders; each request spends up to 8 calls.
  const lock = useRef(false);
  const data = query.data?.data;
  if (!data && isReceiptOff(info)) return null;

  function recalculate() {
    if (lock.current || query.isFetching) return;
    lock.current = true;
    // By hand restarts filling in by itself.
    setFill((f) => ({ ...f, pending: null, idle: 0, stopped: false }));
    void query.refetch().finally(() => (lock.current = false));
  }

  return (
    <Panel title="원정대 영수증" meta="검증된 항목 기준 환산" wide>
      {data ? (
        <div ref={fade}>
          {limit.limited && (
            <p className={styles.muted} role="status">
              {countdownText(limit.seconds)}
            </p>
          )}
          <Body
            data={data}
            refreshing={query.isFetching}
            auto={auto}
            onRecalculate={recalculate}
            assumeBook={assumeBook}
            onAssumeBook={setAssumeBook}
          />
        </div>
      ) : query.isPending ? (
        <p className={styles.muted} role="status">
          {/* No time promise: members come in two at a time (api receipt fan-out);
              from the first answer the count line shows how far it got. */}
          <InlineOrb /> 원정대 캐릭터 정보를 받고 있어요. 받은 만큼 먼저 보여 드려요.
        </p>
      ) : (
        <div className={styles.problem}>
          <p role="alert">
            {limit.limited
              ? `${rateLimitCopy(info).title}. ${rateLimitCopy(info).text}`
              : info?.code === "CHARACTER_NOT_FOUND"
                ? "원정대를 찾지 못했어요."
                : "원정대 영수증을 계산하지 못했어요. 잠시 뒤 다시 시도해 주세요."}
          </p>
          {limit.limited && <RateLimitNote seconds={limit.seconds} />}
          <button type="button" className={styles.again} onClick={() => query.refetch()} disabled={limit.seconds > 0}>
            다시 시도
          </button>
        </div>
      )}
    </Panel>
  );
}
