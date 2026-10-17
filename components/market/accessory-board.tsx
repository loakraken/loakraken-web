"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Diamonds } from "@/components/ui/icons";
import { useTallest } from "@/components/ui/use-tallest";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchAccessoryBoard, fetchAccessoryListings } from "@/lib/market/client";
import {
  ACCESSORY_LISTING_MAX_PAGE,
  GRADES,
  QUALITIES,
  ROLES,
  accessorySearch,
  isPicked,
  polishText,
  type AccessoryBoard,
  type AccessoryCell,
  type AccessoryFilter,
  type AccessoryPick,
  type Level,
  type Slot,
} from "@/lib/market/auction-accessories";
import { goldText } from "@/lib/market/board";
import { boardRefresh } from "@/lib/market/refresh";
import { ChangeMark, UpdateAnnouncer, useChangedCells, type Pulse } from "@/components/ui/changed-cells";
import quote from "@/components/tools/material-quote.module.css";
import stats from "@/components/stats/stats.module.css";
import gems from "./gem-board.module.css";
import styles from "./accessory-board.module.css";

/** Gold amounts as the exchange board writes them (…G); counts stay plain numbers. */
const gold = (n: number | null | undefined) => (n == null ? "-" : goldText(n));
const count = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));
/** Most cells a slot has: two key effects × three grades without 하하 (one effect: 3). */
const CELL_ROOM = 8;
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function Change({ rate }: { rate: number | null | undefined }) {
  if (rate == null) return <small className={gems.flat}>-</small>;
  const direction = rate > 0 ? "up" : rate < 0 ? "down" : undefined;
  return (
    <small className={gems.change} data-direction={direction}>
      {rate > 0 ? "▲" : rate < 0 ? "▼" : ""}
      {Math.abs(rate).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%
    </small>
  );
}

function Slots({
  data,
  pending,
  pickedAt,
  onPick,
}: {
  data: AccessoryBoard;
  pending: ReturnType<typeof pendingProps>;
  pickedAt: (slot: Slot, cell: AccessoryCell) => boolean;
  onPick: (slot: Slot, cell: AccessoryCell) => void;
}) {
  const cells = useMemo(
    () => data.slots.flatMap((slot) => slot.cells.map((cell) => ({ id: `${slot.slot}|${cell.levels.join(",")}`, cell }))),
    [data],
  );
  const changed = useChangedCells(cells, (row) => row.id, { price: (row) => row.cell.minBuyPrice });
  // The cell's own ▲/▼ is the day change: the refresh mark is the tint only.
  const pulseOf = (id: string) => {
    const pulse = changed.pulse(id, "price");
    return pulse && { ...pulse, dir: 0 as const };
  };
  return (
    <div className={styles.slots} {...pending}>
      {data.slots.map((slot) => (
        <section key={slot.slot} className={styles.slot} aria-labelledby={`slot-${slot.slot}`}>
          <h2 id={`slot-${slot.slot}`}>
            {slot.slotName}
            <small> · {slot.options.map((o) => o.shortName).join(" · ")}</small>
          </h2>
          <ul className={styles.cells}>
            {slot.cells.map((cell) => (
              <Cell
                key={cell.levels.join(",")}
                cell={cell}
                pulse={pulseOf(`${slot.slot}|${cell.levels.join(",")}`)}
                picked={pickedAt(slot.slot, cell)}
                onPick={() => onPick(slot.slot, cell)}
              />
            ))}
            {/* A slot with one key effect has 3 cells: the rest keep their room so
                a role change does not move what is below (A7). */}
            {Array.from({ length: Math.max(0, CELL_ROOM - slot.cells.length) }, (_, i) => (
              <li key={`room-${i}`} className={styles.room} aria-hidden="true" />
            ))}
          </ul>
        </section>
      ))}
      <UpdateAnnouncer text={changed.summary ? `장신구 시세 ${changed.summary}` : ""} />
    </div>
  );
}

function Cell({ cell, picked, onPick, pulse }: { cell: AccessoryCell; picked: boolean; onPick: () => void; pulse?: Pulse }) {
  const name = `${cell.optionLabels.join(" · ")}`;
  if (cell.status !== "READY")
    return (
      <li className={styles.cell}>
        <span key={cell.label} className={styles.pending}>
          <b>{cell.label}</b>
          <small>집계 중</small>
        </span>
      </li>
    );
  return (
    <li className={styles.cell}>
      <button type="button" aria-pressed={picked} onClick={onPick} aria-label={`${name} 매물 보기`}>
        {/* Right-aligned numbers rewritten in place start elsewhere and count
            as moving (A7): new values draw new text; the button (and focus) stays. */}
        <Fragment key={`${name}|${cell.minBuyPrice}|${cell.previousDayChangeRate}|${cell.totalCount}`}>
          <span className={styles.label}>
            <b>{cell.label}</b>
            <small>{name}</small>
          </span>
          <b className={styles.price}>
            <ChangeMark pulse={pulse}>{gold(cell.minBuyPrice)}</ChangeMark>
          </b>
          <Change rate={cell.previousDayChangeRate} />
          <small className={styles.count}>매물 {count(cell.totalCount)}</small>
        </Fragment>
      </button>
    </li>
  );
}

/**
 * 장신구 시세 (API list #10 + its board): for each slot, the lowest buy-now
 * price of every grade combination of its key polish effects, by grade
 * (고대·유물), role and minimum quality; pressing a combination lists its
 * cheapest ten listings below in a box that keeps one height (A6·A7).
 */
export function AccessoryBoardView({ initialFilter, initialPick }: { initialFilter: AccessoryFilter; initialPick: AccessoryPick | null }) {
  const router = useRouter();
  const qualityId = useId();
  const [filter, setFilter] = useState(initialFilter);
  const [pick, setPick] = useState<AccessoryPick | null>(initialPick);
  const board = useQuery({
    queryKey: ["accessory-board", filter],
    queryFn: ({ signal }) => fetchAccessoryBoard(filter, signal),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: boardRefresh,
  });
  const listings = useQuery({
    queryKey: ["accessory-listings", filter, pick],
    queryFn: ({ signal }) => fetchAccessoryListings(filter, pick!, signal),
    enabled: pick != null,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const boardLimit = useRateLimit(board.error);
  const listingLimit = useRateLimit(listings.error);
  const data = board.data?.data;
  const page = listings.data?.data;
  const pages = page ? Math.max(1, Math.min(ACCESSORY_LISTING_MAX_PAGE, Math.ceil(page.totalCount / 10))) : 1;
  const latest = data?.slots
    .flatMap((slot) => slot.cells)
    .reduce<string | null>((at, cell) => (cell.observedAt && (!at || cell.observedAt > at) ? cell.observedAt : at), null);
  const pickedCell = pick
    ? data?.slots.find((s) => s.slot === pick.slot)?.cells.find((c) => isPicked(pick, pick.slot, c))
    : undefined;

  function go(nextFilter: AccessoryFilter, nextPick: AccessoryPick | null) {
    setFilter(nextFilter);
    setPick(nextPick);
    const search = accessorySearch(nextFilter, nextPick);
    router.replace(search.size ? `?${search}` : "?", { scroll: false });
  }
  // A new grade, role or quality changes every cell: the pick is dropped.
  const refilter = (patch: Partial<AccessoryFilter>) => go({ ...filter, ...patch }, null);
  // The board keeps its tallest room when an answer is shorter or fails (A7).
  const [boardRef, boardHeight] = useTallest();
  const notice = `${latest ? `${kst.format(new Date(latest))} 확인` : "\u00a0"} · 전일 대비는 LOAKraken이 전날 마지막으로 확인한 최저가와 비교해요.`;

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#accessories-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="accessories-main" className={stats.main}>
        <section className={quote.hero} aria-labelledby="accessories-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Diamonds size={18} />
          </span>
          <p className={quote.heroKicker}>경매장</p>
          <h1 id="accessories-heading">장신구 시세</h1>
          <p className={quote.heroCopy}>4티어 장신구를 부위별 핵심 연마 효과의 등급 조합으로 나눠 즉시 구매 최저가를 보여줘요.</p>
        </section>

        <form className={stats.filters} onSubmit={(e) => e.preventDefault()} aria-label="장신구 시세 조건">
          <span className={stats.segment} role="group" aria-label="등급">
            {GRADES.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter.grade === item.id} onClick={() => refilter({ grade: item.id })}>
                {item.label}
              </button>
            ))}
          </span>
          <span className={stats.segment} role="group" aria-label="역할">
            {ROLES.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter.role === item.id} onClick={() => refilter({ role: item.id })}>
                {item.label}
              </button>
            ))}
          </span>
          <label htmlFor={qualityId}>
            품질
            <Select
              id={qualityId}
              value={filter.minQuality}
              onValueChange={(v) => refilter({ minQuality: Number(v) })}
              items={QUALITIES.map((q) => ({ value: q, label: q === 0 ? "무관" : `${q} 이상` }))}
            />
          </label>
        </form>

        {/* Drawn anew when it says something else (text rewritten in place moves, A7). */}
        <p key={notice} className={stats.notice}>
          {notice}
        </p>
        <div ref={boardRef} style={boardHeight ? { minHeight: boardHeight } : undefined}>
          {board.isError && !data ? (
            <div className={stats.problem}>
              <p>{boardLimit.limited ? countdownText(boardLimit.seconds) : "장신구 시세를 불러오지 못했어요."}</p>
              <button type="button" onClick={() => board.refetch()} disabled={boardLimit.seconds > 0}>
                {retryLabel(boardLimit.seconds)}
              </button>
            </div>
          ) : !data ? (
            <p className={`${stats.muted} ${styles.boardHold}`} role="status">
              장신구 시세를 불러오고 있어요…
            </p>
          ) : (
            // Keyed by the conditions the shown prices are for: a new grade or
            // role starts the comparison afresh (not "every price changed"),
            // the minute's refresh of the same conditions marks what moved.
            <Slots
              key={`${data.grade}|${data.role}|${data.minQuality}`}
              data={data}
              pending={pendingProps(board)}
              pickedAt={(slot, cell) => isPicked(pick, slot, cell)}
              onPick={(slot, cell) => go(filter, { slot, levels: cell.levels as Level[], page: 1 })}
            />
          )}
        </div>

        <section className={gems.listings} aria-labelledby="accessory-listings-heading" {...pendingProps(listings)}>
          <h2 id="accessory-listings-heading">
            {pickedCell ? `${pickedCell.optionLabels.join(" · ")} 매물` : "매물"}
            {page && <small> · {count(page.totalCount)}개 중 싼 순</small>}
          </h2>
          {!pick ? (
            <p className={stats.muted}>위에서 조합을 누르면 즉시 구매가가 싼 매물 10개를 보여 드려요.</p>
          ) : listings.isError && !page ? (
            <div className={stats.problem}>
              <p>{listingLimit.limited ? countdownText(listingLimit.seconds) : "매물을 불러오지 못했어요."}</p>
              <button type="button" onClick={() => listings.refetch()} disabled={listingLimit.seconds > 0}>
                {retryLabel(listingLimit.seconds)}
              </button>
            </div>
          ) : !page ? (
            <p className={stats.muted} role="status">
              매물을 불러오고 있어요…
            </p>
          ) : page.items.length === 0 ? (
            <p className={stats.muted}>즉시 구매할 수 있는 매물이 없어요.</p>
          ) : (
            <>
              <DataTable label="장신구 매물" className={stats.table}>
                <caption className={stats.srOnly}>장신구 매물 {pick.page}쪽</caption>
                <thead>
                  <tr>
                    <th scope="col" className={stats.left}>
                      이름
                    </th>
                    <th scope="col">품질</th>
                    <th scope="col" className={stats.left}>
                      연마 효과
                    </th>
                    <th scope="col">즉시 구매가</th>
                    <th scope="col">거래 가능</th>
                  </tr>
                </thead>
                <tbody key={listings.dataUpdatedAt}>
                  {page.items.map((item, i) => (
                    <tr key={`${item.name}-${i}`}>
                      <th scope="row">{item.name}</th>
                      <td>{item.quality ?? "-"}</td>
                      <td className={stats.left}>{polishText(item) || "-"}</td>
                      <td data-strong>{gold(item.buyPrice || null)}</td>
                      <td>{item.tradeAllowCount == null ? "-" : item.tradeAllowCount === 0 ? "불가" : `${item.tradeAllowCount}회`}</td>
                    </tr>
                  ))}
                  {/* A short page keeps ten rows of room (box and page buttons stay put, A7). */}
                  {Array.from({ length: Math.max(0, 10 - page.items.length) }, (_, i) => (
                    <tr key={`filler-${i}`} aria-hidden="true" className={gems.filler}>
                      <td colSpan={5}>{" "}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {pages > 1 && (
                <nav className={stats.pager} aria-label="매물 쪽 이동">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <button key={p} type="button" aria-current={p === pick.page ? "page" : undefined} onClick={() => go(filter, { ...pick, page: p })}>
                      {p}
                    </button>
                  ))}
                </nav>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
