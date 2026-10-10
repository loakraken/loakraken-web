"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshArrow } from "@/components/ui/icons";
import { InlineOrb } from "@/components/landing/orb";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import expand from "@/components/site/expand.module.css";
import { countdownText, rateLimitCopy } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { labelOf } from "@/lib/api/tolerant";
import { CharacterQueryError, fetchReceipt } from "@/lib/character/client";
import {
  GEM_STATUS,
  GRADE_LABEL,
  coverageText,
  excludedLabel,
  includedText,
  isReceiptOff,
  notIncludedText,
  type Receipt,
  type ReceiptCharacter,
} from "@/lib/character/receipt";
import { useCrossfade } from "@/lib/motion";
import { useSecondsUntil } from "./card-refresh";
import { Panel } from "./panel";
import { kstTime, level } from "./parts";
import styles from "./receipt.module.css";

const gold = (value: number | null | undefined) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}G`;

function CharacterRow({ row }: { row: ReceiptCharacter }) {
  const pending = row.status === "PENDING";
  return (
    <li>
      <details className={`${styles.row} ${expand.expand}`}>
        <summary>
          <span className={styles.who}>
            <strong>{row.characterName}</strong>
            <small>
              {row.className ?? "-"} · {level(row.itemLevel)}
            </small>
          </span>
          <b className={pending ? styles.pending : undefined}>{pending ? "계산 대기" : gold(row.gold)}</b>
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
  onRecalculate,
  assumeBook,
  onAssumeBook,
}: {
  data: Receipt;
  refreshing: boolean;
  onRecalculate: () => void;
  assumeBook: boolean;
  onAssumeBook: (next: boolean) => void;
}) {
  const until = data.coverage.nextAvailableAt ? Date.parse(data.coverage.nextAvailableAt) : undefined;
  const seconds = useSecondsUntil(until);
  const notIncluded = notIncludedText(data);
  const [first, ...rest] = data.assumptions;
  return (
    <>
      <div className={styles.total}>
        <strong>{gold(data.total.gold)}</strong>
        <p>{includedText(data)} 합계</p>
        {notIncluded && <p className={styles.muted}>미포함: {notIncluded}</p>}
      </div>

      <div className={styles.assume}>
        <label>
          <input type="checkbox" checked={assumeBook} onChange={(event) => onAssumeBook(event.target.checked)} />
          책 효과 항상 적용 가정
        </label>
        {first && <p>{first}</p>}
      </div>

      <div className={styles.coverage}>
        <p role="status">{coverageText(data)}</p>
        <span className={styles.bar} aria-hidden="true">
          <i style={{ width: `${(data.coverage.ready / Math.max(1, data.coverage.rosterCharacters)) * 100}%` }} />
        </span>
        {data.coverage.pending > 0 && (
          <button
            type="button"
            className={styles.again}
            onClick={onRecalculate}
            aria-disabled={refreshing || seconds > 0 || undefined}
            // Spends official API calls: never pressed again after hydration.
            data-no-replay
          >
            {refreshing ? <InlineOrb /> : <RefreshArrow size={14} aria-hidden="true" />}
            {refreshing ? "계산하는 중" : seconds > 0 ? `${seconds}초 뒤 다시 계산` : "다시 계산(8명씩)"}
          </button>
        )}
      </div>

      <section className={styles.block} aria-label="장비 재련">
        <h3>
          장비 재련 <b>{gold(data.equipment.gold)}</b>
        </h3>
        <ul className={styles.characters}>
          {data.equipment.characters.map((row) => (
            <CharacterRow key={row.characterName} row={row} />
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
 * LOAWA-style roster receipt (원정대 영수증), counting only verified items:
 * equipment refining and tradable gems at current prices. What it leaves out
 * and why sits right under the total; the backend's assumption sentences are
 * shown as they come. Hidden where the receipt is off (the backend route is
 * absent) and never requested for crawlers (the proxy refuses them).
 */
export function ReceiptPanel({ name }: { name: string }) {
  const [assumeBook, setAssumeBook] = useState(false);
  const query = useQuery({
    queryKey: ["receipt", name, assumeBook],
    queryFn: ({ signal }) => fetchReceipt(name, assumeBook, signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
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
            onRecalculate={recalculate}
            assumeBook={assumeBook}
            onAssumeBook={setAssumeBook}
          />
        </div>
      ) : query.isPending ? (
        <p className={styles.muted} role="status">
          <InlineOrb /> 원정대 영수증을 계산하고 있어요. 몇 초 걸릴 수 있어요.
        </p>
      ) : (
        <div className={styles.problem}>
          <p role="alert">
            {limit.limited
              ? `${rateLimitCopy().title}. ${rateLimitCopy().text}`
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
