"use client";

import { Fragment, useEffect, useId, useState } from "react";
import { ListingName, listingKey, useListingRefocus } from "./listing-detail";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Diamonds } from "@/components/ui/icons";
import { PendingText } from "@/components/ui/pending-text";
import { Select } from "@/components/ui/select";
import { countdownText, failureOf, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchGemBoard, fetchGemListings, fetchGemSkills } from "@/lib/market/client";
import {
  GEM_KINDS,
  GEM_LEVELS,
  GEM_LISTING_MAX_PAGE,
  gemGrid,
  gemPickSearch,
  gemTarget,
  pickAfterFailure,
  skillsFor,
  type GemCell,
  type GemClass,
  type GemKind,
  type GemPick,
} from "@/lib/market/auction-gems";
import { goldText } from "@/lib/market/board";
import { SUPPORT_CLASSES } from "@/lib/character/detail";
import { boardRefresh } from "@/lib/market/refresh";
import { ChangeMark, UpdateAnnouncer, useChangedCells, type Pulse } from "@/components/ui/changed-cells";
import quote from "@/components/tools/material-quote.module.css";
import stats from "@/components/stats/stats.module.css";
import styles from "./gem-board.module.css";

/** Gold amounts as the exchange board writes them (…G); counts stay plain numbers. */
const gold = (n: number | null | undefined) => (n == null ? "-" : goldText(n));
const count = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const endKst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function Change({ rate }: { rate: number | null | undefined }) {
  if (rate == null) return <small className={styles.flat}>-</small>;
  const direction = rate > 0 ? "up" : rate < 0 ? "down" : undefined;
  return (
    <small className={styles.change} data-direction={direction}>
      {rate > 0 ? "▲" : rate < 0 ? "▼" : ""}
      {Math.abs(rate).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%
    </small>
  );
}

const NO_CELLS: GemCell[] = [];
const cellId = (cell: GemCell) => `${cell.kind}-${cell.level}`;

function Cell({ cell, picked, onPick, pulse }: { cell: GemCell | undefined; picked: boolean; onPick: () => void; pulse?: Pulse }) {
  if (!cell || cell.status !== "READY")
    return (
      <td className={styles.cell}>
        <span className={styles.pending}>
          <PendingText />
        </span>
      </td>
    );
  return (
    <td className={styles.cell}>
      <button type="button" aria-pressed={picked} onClick={onPick} aria-label={`${cell.itemName} 매물 보기`}>
        {/* A price that changed on the minute's refresh tints once (the cell's
            own ▲/▼ is the day change, so no second arrow and no width change).
            Right-aligned text rewritten in place starts elsewhere and counts as
            moving (A7): new values draw new text, as on the accessory board. */}
        <Fragment key={`${cell.minBuyPrice}|${cell.previousDayChangeRate}|${cell.totalCount}`}>
          <b>
            <ChangeMark pulse={pulse}>{gold(cell.minBuyPrice)}</ChangeMark>
          </b>
          <Change rate={cell.previousDayChangeRate} />
          <small>매물 {count(cell.totalCount)}</small>
        </Fragment>
      </button>
    </td>
  );
}

/**
 * The listings' class and skill (api #542): a class, then one of its skills
 * that works on the picked kind. Only the listings narrow; the board prices
 * stay those of every gem. One row from the first HTML whatever the list is
 * doing (loading, failed, switched off after the page came), so nothing moves.
 */
function GemFilter({
  pick,
  classes,
  note,
  onChange,
}: {
  pick: GemPick | null;
  classes: readonly GemClass[] | null;
  note: string | null;
  onChange: (className: string | null, skill: number | null) => void;
}) {
  const classId = useId();
  const skillId = useId();
  const hintId = useId();
  const ready = !!classes && !!pick && !note;
  const skills = classes && pick ? skillsFor(classes, pick.className, pick.kind) : [];
  // Skills with only a support effect are not in the backend's list yet (no
  // official option to search by): say so for a supporter class.
  const supportNote = pick?.className && SUPPORT_CLASSES.includes(pick.className) ? " 일부 서포터 스킬은 아직 고를 수 없어요." : "";
  const hint =
    note ??
    (pick
      ? `직업·스킬은 아래 매물만 걸러요. 표의 최저가는 모든 보석 기준이에요.${supportNote}`
      : "위 표에서 칸을 고르면 직업·스킬로 거를 수 있어요.");
  return (
    <form className={styles.filter} aria-label="매물 직업·스킬" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={classId}>직업</label>
      <Select
        id={classId}
        className={styles.classSelect}
        aria-describedby={hintId}
        value={pick?.className ?? ""}
        disabled={!ready}
        onValueChange={(v) => onChange(v || null, null)}
        items={[{ value: "", label: "모든 직업" }, ...(classes ?? []).map((c) => ({ value: c.className, label: c.className }))]}
      />
      <label htmlFor={skillId}>스킬</label>
      <Select
        id={skillId}
        className={styles.skillSelect}
        aria-describedby={hintId}
        value={pick?.skill ? String(pick.skill) : ""}
        disabled={!ready || !pick?.className}
        onValueChange={(v) => onChange(pick?.className ?? null, v ? Number(v) : null)}
        items={[{ value: "", label: "모든 스킬" }, ...skills.map((s) => ({ value: String(s.code), label: s.name }))]}
      />
      {/* A new sentence is drawn anew: text rewritten in place counts as moving (A7). */}
      <small key={hint} id={hintId}>
        {hint}
      </small>
    </form>
  );
}

/**
 * 보석 시세 (API list #8·#9): the lowest buy-now price of each T4 gem, its
 * change from yesterday's last observed price (ours) and the listing count;
 * pressing a cell lists the cheapest ten listings of that gem below, which
 * can be narrowed to a class and skill. The listings box keeps one height
 * from the first HTML (before a pick, while loading, failed, short), so
 * nothing under it moves (A6·A7).
 */
export function GemBoardView({
  initialPick,
  filter = "off",
}: {
  initialPick: GemPick | null;
  /** The class/skill filter as the server found it: its list came with the page, or not (no row). */
  filter?: "on" | "off";
}) {
  const router = useRouter();
  const [pick, setPick] = useState<GemPick | null>(initialPick);
  const skillList = useQuery({
    queryKey: ["gem-skills"],
    queryFn: ({ signal }) => fetchGemSkills(signal),
    enabled: filter !== "off",
    staleTime: Infinity,
    retry: false,
  });
  const classes = skillList.data?.data.classes ?? null;
  const board = useQuery({
    queryKey: ["gem-board"],
    queryFn: ({ signal }) => fetchGemBoard(signal),
    staleTime: 60_000,
    retry: false,
    refetchInterval: boardRefresh,
  });
  const listings = useQuery({
    queryKey: ["gem-listings", pick],
    queryFn: ({ signal }) => fetchGemListings(pick!, signal),
    enabled: pick != null,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const boardLimit = useRateLimit(board.error);
  // A busy filtered search (its share used up) waits like the rate limit.
  const listingLimit = useRateLimit(listings.error, ["MARKET_SEARCH_BUSY"]);
  const listingFailure = failureOf(listings.error)?.code;
  const skillFailure = failureOf(skillList.error)?.code;
  const data = board.data?.data;
  const cellOf = data ? gemGrid(data) : () => undefined;
  const changed = useChangedCells(data?.cells ?? NO_CELLS, cellId, { price: (cell) => cell.minBuyPrice });
  const pulseOf = (cell: GemCell | undefined) => {
    const pulse = cell && changed.pulse(cellId(cell), "price");
    return pulse && { ...pulse, dir: 0 as const };
  };
  const latest = data?.cells.reduce<string | null>(
    (at, cell) => (cell.observedAt && (!at || cell.observedAt > at) ? cell.observedAt : at),
    null,
  );

  function choose(next: GemPick) {
    setPick(next);
    router.replace(`?${gemPickSearch(next)}`, { scroll: false });
  }
  // The filter switched off while a shared address still names a class: the
  // same cell again without it, and the address cleaned (no dead retry).
  // The pick changes during render (React's "storing information from previous
  // renders"); only the address waits for the effect.
  const fallback = pick ? pickAfterFailure(pick, listingFailure) : null;
  const [dropped, setDropped] = useState<GemPick | null>(null);
  if (fallback) {
    setPick(fallback);
    setDropped(fallback);
  }
  useEffect(() => {
    if (dropped) router.replace(`?${gemPickSearch(dropped)}`, { scroll: false });
  }, [dropped, router]);
  // Another cell keeps the class, and the skill only if it works on that kind.
  function chooseCell(kind: GemKind, level: number) {
    const className = pick?.className ?? null;
    const keeps = classes && pick?.skill ? skillsFor(classes, className, kind).some((s) => s.code === pick.skill) : false;
    choose({ kind, level, page: 1, className, skill: keeps ? pick!.skill : null });
  }
  const filterNote =
    skillFailure === "GEM_FILTER_DISABLED" || listingFailure === "GEM_FILTER_DISABLED"
      ? "지금은 직업·스킬로 거를 수 없어요."
      : skillList.isError
        ? "직업·스킬 목록을 불러오지 못했어요."
        : null;
  const pickedCell = pick ? cellOf(pick.kind, pick.level) : undefined;
  const page = listings.data?.data;
  const pages = page ? Math.max(1, Math.min(GEM_LISTING_MAX_PAGE, Math.ceil(page.totalCount / 10))) : 1;

  // While a listing's card is open the table keeps the page it was opened
  // from: the minute's refresh does not redraw the rows (and the card) under
  // it. The card says so if that listing is no longer in the latest page.
  const [opened, setOpened] = useState<{ key: string; page: NonNullable<typeof page>; version: number } | null>(null);
  const shown = opened?.page ?? page;
  const latestKeys = new Set((page?.items ?? []).map(listingKey));
  const { body, refocus } = useListingRefocus((shown ?? page)?.items);
  const openFor = (key: string) => (open: boolean, keepFocus: boolean) => {
    setOpened(open && shown ? { key, page: shown, version: opened?.version ?? listings.dataUpdatedAt } : null);
    refocus(!open && keepFocus ? key : null);
  };

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#gems-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="gems-main" className={stats.main}>
        <section className={quote.hero} aria-labelledby="gems-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Diamonds size={18} />
          </span>
          <p className={quote.heroKicker}>경매장</p>
          <h1 id="gems-heading">보석 시세</h1>
          <p className={quote.heroCopy}>4티어 겁화·작열 보석의 레벨별 즉시 구매 최저가예요. 칸을 누르면 싼 매물부터 보여 드려요.</p>
        </section>

        <p className={stats.notice}>
          {latest ? `${kst.format(new Date(latest))} 확인` : " "} · 전일 대비는 LOAKraken이 전날 마지막으로 확인한
          최저가와 비교해요.
        </p>
        {board.isError && !data ? (
          <div className={stats.problem}>
            <p>{boardLimit.limited ? countdownText(boardLimit.seconds) : "보석 시세를 불러오지 못했어요."}</p>
            <button type="button" onClick={() => board.refetch()} disabled={boardLimit.seconds > 0}>
              {retryLabel(boardLimit.seconds)}
            </button>
          </div>
        ) : (
          <DataTable label="보석 시세" className={`${stats.table} ${styles.board}`} aria-busy={!data || undefined}>
            <caption className={stats.srOnly}>4티어 보석 레벨별 즉시 구매 최저가</caption>
            <thead>
              <tr>
                <th scope="col">레벨</th>
                {GEM_KINDS.map((kind) => (
                  <th key={kind} scope="col">
                    {kind}의 보석
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GEM_LEVELS.map((level) => (
                <tr key={level}>
                  <th scope="row">{level}레벨</th>
                  {GEM_KINDS.map((kind: GemKind) =>
                    data ? (
                      <Cell
                        key={kind}
                        cell={cellOf(kind, level)}
                        pulse={pulseOf(cellOf(kind, level))}
                        picked={pick?.kind === kind && pick.level === level}
                        onPick={() => chooseCell(kind, level)}
                      />
                    ) : (
                      <td key={kind} className={styles.cell}>
                        <span className={styles.pending}>{" "}</span>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        <section className={styles.listings} aria-labelledby="gem-listings-heading" {...pendingProps(listings)}>
          <h2 id="gem-listings-heading">
            {pick ? `${pick.level}레벨 ${pick.kind}의 보석 매물` : "매물"}
            {/* Drawn anew for each cell, filter and count: rewritten in place it counts as moving (A7). */}
            {page && pick && <small key={`${gemPickSearch(pick)}:${page.totalCount}`}> · {count(page.totalCount)}개 중 싼 순</small>}
          </h2>
          {filter !== "off" && (
            <GemFilter
              pick={pick}
              classes={classes}
              note={filterNote}
              onChange={(className, skill) => pick && choose({ ...pick, page: 1, className, skill })}
            />
          )}
          {!pick ? (
            <p className={stats.muted}>위 표에서 칸을 누르면 즉시 구매가가 싼 매물 10개를 보여 드려요.</p>
          ) : listings.isError && !page ? (
            <div className={stats.problem}>
              <p>
                {listingLimit.limited
                  ? countdownText(listingLimit.seconds)
                  : listingFailure === "INVALID_GEM_FILTER"
                    ? "이 직업·스킬로는 이 보석을 찾을 수 없어요. 조건을 바꿔 주세요."
                    : "매물을 불러오지 못했어요."}
              </p>
              <button type="button" onClick={() => listings.refetch()} disabled={listingLimit.seconds > 0}>
                {retryLabel(listingLimit.seconds)}
              </button>
            </div>
          ) : !page ? (
            <p className={stats.muted} role="status">
              매물을 불러오고 있어요…
            </p>
          ) : page.items.length === 0 ? (
            <p className={stats.muted}>
              즉시 구매할 수 있는 매물이 없어요{pickedCell?.totalCount ? "(입찰만 가능한 매물만 있음)" : ""}.
            </p>
          ) : (
            <>
              <DataTable label="보석 매물" className={`${stats.table} ${styles.listingTable}`}>
                <caption className={stats.srOnly}>
                  {pick.level}레벨 {pick.kind}의 보석 매물 {pick.page}쪽
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={stats.left}>
                      효과
                    </th>
                    <th scope="col">즉시 구매가</th>
                    <th scope="col">입찰가</th>
                    <th scope="col">경매 종료</th>
                    <th scope="col">거래 가능</th>
                  </tr>
                </thead>
                <tbody ref={body} key={opened?.version ?? listings.dataUpdatedAt}>
                  {(shown ?? page).items.map((item, i) => (
                    <tr key={`${item.name}-${i}`}>
                      <th scope="row">
                        <ListingName
                          item={item}
                          label={gemTarget(item) ?? item.name}
                          kind="보석"
                          observedAt={(shown ?? page).observedAt}
                          gone={opened?.key === listingKey(item) && !latestKeys.has(listingKey(item))}
                          onOpenChange={openFor(listingKey(item))}
                        />
                      </th>
                      <td data-strong>{gold(item.buyPrice || null)}</td>
                      <td>{gold(item.bidPrice || item.bidStartPrice)}</td>
                      <td>{item.endDate ? endKst.format(new Date(item.endDate)) : "-"}</td>
                      <td>{item.tradeAllowCount == null ? "-" : item.tradeAllowCount === 0 ? "불가" : `${item.tradeAllowCount}회`}</td>
                    </tr>
                  ))}
                  {/* A short page keeps ten rows of room, so the box and the
                      page buttons stay put from page to page (A7). */}
                  {Array.from({ length: Math.max(0, 10 - (shown ?? page).items.length) }, (_, i) => (
                    <tr key={`filler-${i}`} aria-hidden="true" className={styles.filler}>
                      <td colSpan={5}>{" "}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {pages > 1 && (
                <nav className={stats.pager} aria-label="매물 쪽 이동">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === pick.page ? "page" : undefined}
                      onClick={() => choose({ ...pick, page: p })}
                    >
                      {p}
                    </button>
                  ))}
                </nav>
              )}
            </>
          )}
        </section>
        <UpdateAnnouncer text={changed.summary ? `보석 시세 ${changed.summary}` : ""} />
      </main>
    </div>
  );
}
