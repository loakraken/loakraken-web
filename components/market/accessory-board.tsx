"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { Diamonds } from "@/components/ui/icons";
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
  type AccessoryCell,
  type AccessoryFilter,
  type AccessoryPick,
  type Level,
} from "@/lib/market/auction-accessories";
import quote from "@/components/tools/material-quote.module.css";
import stats from "@/components/stats/stats.module.css";
import gems from "./gem-board.module.css";
import styles from "./accessory-board.module.css";

const gold = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));
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

function Cell({ cell, picked, onPick }: { cell: AccessoryCell; picked: boolean; onPick: () => void }) {
  const name = `${cell.optionLabels.join(" · ")}`;
  if (cell.status !== "READY")
    return (
      <li className={styles.cell}>
        <span className={styles.pending}>
          <b>{cell.label}</b>
          <small>집계 중</small>
        </span>
      </li>
    );
  return (
    <li className={styles.cell}>
      <button type="button" aria-pressed={picked} onClick={onPick} aria-label={`${name} 매물 보기`}>
        <span className={styles.label}>
          <b>{cell.label}</b>
          <small>{name}</small>
        </span>
        <b className={styles.price}>{gold(cell.minBuyPrice)}</b>
        <Change rate={cell.previousDayChangeRate} />
        <small className={styles.count}>매물 {gold(cell.totalCount)}</small>
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
    refetchInterval: (query) =>
      query.state.data && !query.state.data.data.complete && query.state.dataUpdateCount < 7 ? 5_000 : false,
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

        <p className={stats.notice}>
          {latest ? `${kst.format(new Date(latest))} 확인` : " "} · 전일 대비는 LOAKraken이 전날 마지막으로 확인한
          최저가와 비교해요.
        </p>
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
          <div className={styles.slots} {...pendingProps(board)}>
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
                      picked={isPicked(pick, slot.slot, cell)}
                      onPick={() => go(filter, { slot: slot.slot, levels: cell.levels as Level[], page: 1 })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <section className={gems.listings} aria-labelledby="accessory-listings-heading" {...pendingProps(listings)}>
          <h2 id="accessory-listings-heading">
            {pickedCell ? `${pickedCell.optionLabels.join(" · ")} 매물` : "매물"}
            {page && <small> · {gold(page.totalCount)}개 중 싼 순</small>}
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
