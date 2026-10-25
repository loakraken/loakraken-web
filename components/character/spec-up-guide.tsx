"use client";
// 스펙업 tab body (backend #318, PM-프론트 10-11 16:37 ⑤): what to upgrade
// next, ranked by combat power per 10,000 gold (or by the gain alone). Every
// number comes from the backend; candidates it could not compute fold into one
// line per reason, and "적용해 보기" opens the simulator tab with the change.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeMark, useChangedCells, type Pulse } from "@/components/ui/changed-cells";
import { failureOf, rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import type { Character } from "@/lib/character/model";
import { NO_EDITS } from "@/lib/combat-power/model";
import { SpecUpQueryError, fetchSpecUp } from "@/lib/spec-up/client";
import {
  SORTS,
  editsFor,
  keepOrder,
  kindLabel,
  KRAKEN_NOTE_ALL,
  krakenUnavailableCopy,
  krakenUnavailableNote,
  isFreeCost,
  listChangeCopy,
  sortCaption,
  splitKrakenCandidates,
  costPriceNote,
  costRoom,
  gemTarget,
  koreanGold,
  specUpQuery,
  splitCandidates,
  tryParam,
  type Candidate,
  type Sort,
} from "@/lib/spec-up/model";
import { MINUTE, useClock } from "@/components/home/clock";
import { SpecUpGoal } from "./spec-up-goal";
import { SpecUpRowDetail } from "./spec-up-detail";
import { kstTime } from "./parts";
import styles from "./detail.module.css";

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function failureCopy(code: string) {
  switch (code) {
    case "SPEC_UP_DISABLED":
      return { title: "스펙업 가이드는 아직 열리지 않았어요", text: "준비가 끝나면 이 탭에서 바로 보여 드려요." };
    case "CHARACTER_NOT_CACHED":
      return { title: "캐릭터 정보를 먼저 불러와 주세요", text: "위의 갱신 버튼으로 정보를 받은 뒤 다시 열어 주세요." };
    case "CLIENT_RATE_LIMITED":
      return rateLimitCopy({ code });
    default:
      return { title: "스펙업 가이드를 불러오지 못했어요", text: "잠시 뒤 다시 시도해 주세요." };
  }
}

/** "—" for a per-gold figure; a cost of 0 says why it was not worked out (read out only). */
function NoFigure({ candidate }: { candidate: Candidate }) {
  if (!isFreeCost(candidate.cost)) return <>—</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className={styles.sr}>비용이 없어 계산하지 않아요</span>
    </>
  );
}

function CostCell({ candidate, pulse, now }: { candidate: Candidate; pulse?: Pulse; now: number | null }) {
  const cost = candidate.cost;
  // Gem costs carry their price time (api #759): a second line on every gem
  // row, fresh or not, so a refresh that turns one stale keeps the row's height.
  const note = now == null ? null : costPriceNote(cost, now);
  if (!cost)
    return (
      <td data-cell="cost" data-label="기대 비용">
        —
      </td>
    );
  if (isFreeCost(cost))
    return (
      <td data-cell="cost" data-label="기대 비용" className={styles.specUpMuted}>
        추가 비용 없음
      </td>
    );
  if (cost.status === "OK" && cost.amount != null)
    return (
      <td
        data-cell="cost"
        data-label="기대 비용"
        data-figure=""
        // Holds the width of a longer cost of this size (see costRoom): the
        // minute's refresh does not widen the column or the phone card (A7).
        data-room={cost.unit === "GOLD" ? costRoom(cost.amount) : undefined}
        data-stale={note?.stale || undefined}
        title={`${cost.amount.toLocaleString("ko-KR")}${cost.unit === "GOLD" ? "G" : ` ${cost.unit}`}${note ? ` · ${note.text}` : ""}`}
      >
        {/* Right-aligned text rewritten in place starts elsewhere and counts as
            moving (A7): a new amount draws new text. */}
        <ChangeMark key={cost.amount} pulse={pulse}>
          {cost.unit === "GOLD" ? `${koreanGold(cost.amount)}G` : `${cost.amount.toLocaleString("ko-KR")} ${cost.unit}`}
        </ChangeMark>
        {note && <small className={styles.specUpCostTime}>{note.text}</small>}
      </td>
    );
  return (
    <td data-cell="cost" data-label="기대 비용" className={styles.specUpMuted} title={cost.basis}>
      {cost.status === "PENDING" ? "시세 대기" : "비용 미확인"}
    </td>
  );
}

export default function SpecUpGuide({ data }: { data: Character }) {
  const name = data.characterName;
  // For gem price times ("21:05 시세" / a date when not today).
  const now = useClock(MINUTE);
  const [sort, setSort] = useState<Sort>("EFFICIENCY");
  // 크라켄 점수 순 (api #573) leaves 작열 (cooldown) gems out by default; the user can add them.
  const [cooldown, setCooldown] = useState(false);
  // The efficiency list (the tab's first answer) tells whether the backend
  // knows 크라켄 점수 (api #573 fields present). If not, 크라켄 점수 순 is not
  // sent — an older backend refuses the value — and the list stays as it is.
  const queryClient = useQueryClient();
  const efficiency = queryClient.getQueryData<{ data: { krakenRuleVersion?: unknown; krakenSortUnavailableReason?: unknown } }>(
    specUpQuery(name, data.fetchedAt, "EFFICIENCY"),
  )?.data;
  const krakenKnown = efficiency
    ? efficiency.krakenRuleVersion !== undefined || efficiency.krakenSortUnavailableReason !== undefined
    : null;
  const requestSort: Sort = sort === "KRAKEN" && krakenKnown === false ? "EFFICIENCY" : sort;
  const includeCooldownGems = requestSort === "KRAKEN" ? cooldown : null;
  const query = useQuery({
    queryKey: specUpQuery(name, data.fetchedAt, requestSort, includeCooldownGems),
    queryFn: ({ signal }) => fetchSpecUp(name, requestSort, signal, includeCooldownGems),
    staleTime: 60_000,
    // A new sort keeps the old list on screen until the new one arrives.
    placeholderData: keepPreviousData,
    // The tab asked for this list a moment ago; "다시 불러오기" refetches.
    refetchOnMount: false,
    retryOnMount: false,
    retry: false,
    refetchOnWindowFocus: false,
    // Costs follow the cached prices: every minute while the tab is visible
    // (user 10-16), after a rate limit's retryAt, and not again after another
    // failure (e.g. the character snapshot left the cache) — the list shown stays.
    refetchInterval: (q) => {
      const retryAt = failureOf(q.state.error)?.retryAt;
      if (retryAt) return Math.max(60_000, retryAt - Date.now());
      return q.state.error ? false : 60_000;
    },
  });
  const limit = useRateLimit(query.error);
  const guide = query.data?.data;
  // A failed refresh keeps the list it had; the failure shows only without one.
  const failure = guide
    ? null
    : query.error instanceof SpecUpQueryError
      ? query.error.info.code
      : query.error
        ? "ERROR"
        : null;
  // Rows keep their place across refreshes of the same sort (see keepOrder).
  const [order, setOrder] = useState<{ sort: string; ids: string[] } | null>(null);
  // Bumped by '새 순서로 보기': the rows are drawn anew in the new order rather
  // than the old ones sliding into place, which counts as moving (A7, #857).
  const [generation, setGeneration] = useState(0);
  // "새 순서로 정렬했어요" for a moment in the same fixed line, and focus kept
  // there, since the pressed button goes away.
  const [sorted, setSorted] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!sorted) return;
    // Without scrolling: on a phone the line may sit above the screen.
    statusRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setSorted(false), 3_000);
    return () => window.clearTimeout(timer);
  }, [sorted, generation]);
  // Another list came (sort or cooldown choice, #921): one sentence on the status
  // line for a moment, focus left on the pressed button. Not on the first list.
  const [told, setTold] = useState<string | null>(null);
  const [toldKey, setToldKey] = useState<string | null>(null);
  useEffect(() => {
    if (!told) return;
    const timer = window.setTimeout(() => setTold(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [told]);
  // One list = its sort and, for 크라켄 점수 순, whether 작열 gems are in (#908):
  // a different cooldown choice is a different list, not a reordered refresh.
  const listKey = guide ? `${guide.sort}:${guide.sort === "KRAKEN" ? String(guide.cooldownGemsIncluded) : ""}` : null;
  const krakenShown = guide?.sort === "KRAKEN";
  if (guide && listKey && !query.isPlaceholderData && toldKey !== listKey) {
    setToldKey(listKey);
    if (toldKey !== null) setTold(listChangeCopy(toldKey, guide.sort, guide.cooldownGemsIncluded));
  }
  // Known before the press: the efficiency list already says why (the reason
  // does not depend on the sort), so the bar changes in the same frame.
  const offReason =
    sort === "KRAKEN" ? (krakenKnown === false ? "DISABLED" : (guide?.krakenSortUnavailableReason ?? null)) : null;
  const notice = krakenUnavailableCopy(offReason);
  const note = krakenUnavailableNote(offReason);
  const candidates = useMemo(
    () => (guide ? keepOrder(guide.candidates, order?.sort === listKey ? order.ids : null) : []),
    [guide, order, listKey],
  );
  const shownIds = candidates.map((c) => c.id).join("|");
  if (guide && listKey && !query.isPlaceholderData && (order?.sort !== listKey || order.ids.join("|") !== shownIds))
    setOrder({ sort: listKey, ids: candidates.map((c) => c.id) });
  // One array per answer (the change marks compare row lists by identity).
  // 크라켄 점수 순 ranks every candidate with a score change, in the answer's
  // order (an UNSUPPORTED engraving line can still raise the score); only when
  // the answer itself is KRAKEN — a fallback to EFFICIENCY keeps that order.
  const { ok, folded } = useMemo(
    () => (guide ? (krakenShown ? splitKrakenCandidates(candidates) : splitCandidates(candidates)) : { ok: [], folded: [] }),
    [guide, candidates, krakenShown],
  );
  // The backend's own order differs from the rows on screen (prices moved).
  const reordered =
    !!guide && guide.candidates.map((c) => c.id).join("|") !== shownIds && order?.sort === listKey;
  const changed = useChangedCells(ok, (c) => c.id, {
    cost: (c) => c.cost?.amount,
    eff: (c) => (krakenShown ? c.krakenScorePer100kGold : c.combatPowerPer10kGold),
  });
  // Tint only: the cells carry no arrow of their own room (no width change).
  const pulseOf = (id: string, key: string) => {
    const pulse = changed.pulse(id, key);
    return pulse && { ...pulse, dir: 0 as const };
  };
  // Each cost basis once, under the table (the same code is the same sentence).
  // In code order, so a new sort does not reorder these lines (A7).
  const bases = [...new Map(ok.flatMap((c) => (c.cost ? [[c.cost.code, c.cost.basis] as const] : []))).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, basis]) => basis);

  return (
    <div className={styles.specUp}>
      <p className={styles.simulatorLead}>
        바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 골드 대비 효율이 높은 순서로 보여 드려요.
      </p>
      {/* 사용자 결정(PM 총괄 19:48): 해설은 아직 없다는 한 줄. */}
      <p className={styles.specUpNote}>세팅 해설 기능은 준비 중이에요.</p>

      <div className={styles.specUpBar}>
        <div role="group" aria-label="정렬" className={styles.specUpSorts}>
          {SORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={sort === item.id}
              onClick={() => setSort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* One slot held in the bar for every sort (A7: nothing below moves on a
            press or a late answer): the cooldown toggle, or why 크라켄 점수 순 is
            off. Its room is the widest of the toggle and every note. */}
        <span className={styles.specUpKrakenSlot}>
          <button
            type="button"
            className={styles.specUpCooldown}
            aria-pressed={cooldown}
            data-off={sort !== "KRAKEN" || !!note || undefined}
            onClick={() => setCooldown((on) => !on)}
          >
            작열 보석 포함
          </button>
          <span className={styles.specUpKrakenRoom} aria-hidden="true">
            {KRAKEN_NOTE_ALL.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </span>
          <span className={styles.specUpKrakenNote} role="status">
            {note && (
              <>
                <span aria-hidden="true">{note}</span>
                <span className={styles.sr}>{notice}</span>
              </>
            )}
          </span>
        </span>
      </div>
      {/* Its own line, held before the answer arrives (CLS 0). */}
      <p className={styles.specUpPrices}>
        {guide?.pricesAt ? `시세 ${kstTime(guide.pricesAt)} 기준` : ""}
      </p>

      <div
        // Not a live region (#921): a new list would be read out whole. The
        // status line below tells what happened in one sentence.
        // Busy while a list is coming for the first time or for a new sort,
        // not on the quiet minute refresh.
        aria-busy={(query.isFetching && (!guide || query.isPlaceholderData)) || undefined}
        className={styles.specUpList}
        data-stale={query.isPlaceholderData || undefined}
      >
        <p className={styles.specUpPrices} role="status" ref={statusRef} tabIndex={-1}>
          {query.isPlaceholderData ? (
            "새 순서로 다시 불러오고 있어요…"
          ) : reordered && guide ? (
            // The rows stayed put on the refresh; the new order is one press away
            // (PM 총괄 판정 b). Pressed, the rows take the new order at once.
            // Short, so it stays one line at 360 in the line's fixed height (A37):
            // the rows are the order from before the prices moved.
            <>
              시세 갱신 전 순서예요 ·{" "}
              <button
                type="button"
                className={`${styles.specUpReorder} hit-44`}
                onClick={() => {
                  if (listKey) setOrder({ sort: listKey, ids: guide.candidates.map((c) => c.id) });
                  setGeneration((g) => g + 1);
                  setSorted(true);
                }}
              >
                새 순서로 보기
              </button>
            </>
          ) : sorted ? (
            "새 순서로 정렬했어요"
          ) : (
            (told ?? "")
          )}
        </p>
        {failure ? (
          <div className={styles.specUpFailure} role="alert">
            <strong>{failureCopy(failure).title}</strong>
            <p>{failureCopy(failure).text}</p>
            {failure !== "SPEC_UP_DISABLED" && (
              <button
                type="button"
                aria-disabled={query.isFetching || limit.seconds > 0 || undefined}
                onClick={() => !query.isFetching && limit.seconds === 0 && void query.refetch()}
              >
                {retryLabel(limit.seconds, "다시 불러오기")}
              </button>
            )}
          </div>
        ) : !guide ? (
          <p className={styles.specUpLoading} role="status">
            후보를 계산하고 있어요
          </p>
        ) : (
          // Keyed by the list (sort and cooldown choice): another list is drawn
          // anew, so the lines under the table are not slid down as it grows (A7).
          // The minute refresh keeps the key, and its change marks (#857).
          <Fragment key={listKey}>
            {ok.length === 0 ? (
              <p className={styles.muted}>지금 계산할 수 있는 후보가 없어요.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.specUpTable}`}>
                  <caption className={styles.sr}>
                    스펙업 후보, {sortCaption(guide.sort)}{reordered ? "(시세 갱신 전 순서)" : ""}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">순위</th>
                      <th scope="col">종류</th>
                      <th scope="col">대상</th>
                      <th scope="col">전 → 후</th>
                      <th scope="col">{krakenShown ? "크라켄 점수" : "전투력 증가"}</th>
                      <th scope="col">기대 비용</th>
                      <th scope="col">{krakenShown ? "10만 골드당 점수" : "1만 골드당 전투력"}</th>
                      <th scope="col">
                        <span className={styles.sr}>시뮬레이터</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ok.map((c, i) => {
                      const tryable = editsFor(c.change, NO_EDITS) != null && c.change;
                      return (
                        // Keyed by the order of the list on screen: a new sort
                        // or '새 순서로 보기' draws new rows instead of sliding
                        // the old ones (A7).
                        <tr key={`${listKey}:${generation}:${c.id}`}>
                          <td data-cell="rank">{i + 1}</td>
                          <td data-cell="kind">{kindLabel(c.kind)}</td>
                          <th scope="row" data-cell="target">
                            {/* The target opens the row's detail (시세·재련 재료·전후 능력치, #887). */}
                            <SpecUpRowDetail
                              characterName={name}
                              fetchedAt={data.fetchedAt}
                              candidate={c}
                              cooldownGemsIncluded={guide.cooldownGemsIncluded ?? null}
                            />
                          </th>
                          <td data-cell="change">
                            {c.from ?? "—"} → {c.to ?? "—"}
                          </td>
                          {krakenShown ? (
                            <td data-cell="gain" data-label="크라켄 점수" className={styles.specUpGain} data-figure="">
                              {c.deltaKrakenScore == null ? "—" : `+${two(c.deltaKrakenScore)}`}
                            </td>
                          ) : (
                            <td data-cell="gain" data-label="전투력" className={styles.specUpGain} data-figure="">
                              {c.deltaCombatPower == null ? "—" : `+${two(c.deltaCombatPower)}`}
                              {c.deltaPercent != null && <small> ({c.deltaPercent.toFixed(3)}%)</small>}
                            </td>
                          )}
                          <CostCell candidate={c} pulse={pulseOf(c.id, "cost")} now={now} />
                          {krakenShown ? (
                            <td data-cell="eff" data-label="10만 골드당" data-figure="">
                              <ChangeMark key={c.krakenScorePer100kGold ?? "none"} pulse={pulseOf(c.id, "eff")}>
                                {c.krakenScorePer100kGold == null ? <NoFigure candidate={c} /> : two(c.krakenScorePer100kGold)}
                              </ChangeMark>
                            </td>
                          ) : (
                            <td data-cell="eff" data-label="1만 골드당" data-figure="">
                              <ChangeMark key={c.combatPowerPer10kGold ?? "none"} pulse={pulseOf(c.id, "eff")}>
                                {c.combatPowerPer10kGold == null ? <NoFigure candidate={c} /> : two(c.combatPowerPer10kGold)}
                              </ChangeMark>
                            </td>
                          )}
                          <td data-cell="try">
                            {tryable && (
                              <Link
                                href={`?${new URLSearchParams({ tab: "simulator", try: tryParam(tryable) })}`}
                                replace
                                scroll={false}
                                className="hit-44"
                                aria-label={`${gemTarget(c.target, c.gemType)} ${c.to ?? ""} 시뮬레이터에서 적용해 보기`}
                              >
                                적용해 보기
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {guide.total > ok.length && (
              <p className={styles.muted}>
                계산된 후보 {guide.total}개 중 위에서 {ok.length}개를 보여 드려요.
              </p>
            )}
            {bases.length > 0 && (
              <ul className={styles.specUpBases} aria-label="비용 기준">
                {bases.map((basis) => (
                  <li key={basis}>{basis}</li>
                ))}
              </ul>
            )}
            {folded.length > 0 && (
              <section className={styles.specUpFolded} aria-labelledby="spec-up-folded">
                <h3 id="spec-up-folded">아직 계산하지 않은 후보</h3>
                <ul>
                  {folded.map((group) => (
                    <li key={group.code}>
                      <details>
                        <summary>
                          <b>{group.kinds.join("·")}</b> {group.candidates.length}개 — {group.reason}
                        </summary>
                        <ul>
                          {group.candidates.map((c) => (
                            <li key={c.id}>
                              {gemTarget(c.target, c.gemType)}
                              {(c.from || c.to) && ` (${c.from ?? "—"} → ${c.to ?? "—"})`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Fragment>
        )}
      </div>
      <SpecUpGoal data={data} />
    </div>
  );
}
