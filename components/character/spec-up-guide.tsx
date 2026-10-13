"use client";
// 스펙업 tab body (backend #318, PM-프론트 10-11 16:37 ⑤): what to upgrade
// next, ranked by combat power per 10,000 gold (or by the gain alone). Every
// number comes from the backend; candidates it could not compute fold into one
// line per reason, and "적용해 보기" opens the simulator tab with the change.
import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import type { Character } from "@/lib/character/model";
import { NO_EDITS } from "@/lib/combat-power/model";
import { SpecUpQueryError, fetchSpecUp } from "@/lib/spec-up/client";
import {
  SORTS,
  editsFor,
  kindLabel,
  koreanGold,
  specUpQuery,
  splitCandidates,
  tryParam,
  type Candidate,
  type Sort,
} from "@/lib/spec-up/model";
import { GameIcon } from "./imagery";
import { SpecUpGoal } from "./spec-up-goal";
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
      return rateLimitCopy();
    default:
      return { title: "스펙업 가이드를 불러오지 못했어요", text: "잠시 뒤 다시 시도해 주세요." };
  }
}

function CostCell({ candidate }: { candidate: Candidate }) {
  const cost = candidate.cost;
  if (!cost)
    return (
      <td data-cell="cost" data-label="기대 비용">
        —
      </td>
    );
  if (cost.status === "OK" && cost.amount != null)
    return (
      <td data-cell="cost" data-label="기대 비용" data-figure="" title={`${cost.amount.toLocaleString("ko-KR")}${cost.unit === "GOLD" ? "G" : ` ${cost.unit}`}`}>
        {cost.unit === "GOLD" ? `${koreanGold(cost.amount)}G` : `${cost.amount.toLocaleString("ko-KR")} ${cost.unit}`}
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
  const [sort, setSort] = useState<Sort>("EFFICIENCY");
  const query = useQuery({
    queryKey: specUpQuery(name, data.fetchedAt, sort),
    queryFn: ({ signal }) => fetchSpecUp(name, sort, signal),
    staleTime: 60_000,
    // A new sort keeps the old list on screen until the new one arrives.
    placeholderData: keepPreviousData,
    // The tab asked for this list a moment ago; "다시 불러오기" refetches.
    refetchOnMount: false,
    retryOnMount: false,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(query.error);
  const guide = query.data?.data;
  const failure = query.error instanceof SpecUpQueryError ? query.error.info.code : query.error ? "ERROR" : null;
  const { ok, folded } = guide ? splitCandidates(guide.candidates) : { ok: [], folded: [] };
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
      </div>
      {/* Its own line, held before the answer arrives (CLS 0). */}
      <p className={styles.specUpPrices}>
        {guide?.pricesAt ? `시세 ${kstTime(guide.pricesAt)} 기준` : ""}
      </p>

      <div
        aria-live="polite"
        aria-busy={query.isFetching || undefined}
        className={styles.specUpList}
        data-stale={query.isPlaceholderData || undefined}
      >
        <p className={styles.specUpPrices} role="status">
          {query.isPlaceholderData ? "새 순서로 다시 불러오고 있어요" : ""}
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
          <>
            {ok.length === 0 ? (
              <p className={styles.muted}>지금 계산할 수 있는 후보가 없어요.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.specUpTable}`}>
                  <caption className={styles.sr}>
                    스펙업 후보, {SORTS.find((s) => s.id === sort)?.label} 순
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">순위</th>
                      <th scope="col">종류</th>
                      <th scope="col">대상</th>
                      <th scope="col">전 → 후</th>
                      <th scope="col">전투력 증가</th>
                      <th scope="col">기대 비용</th>
                      <th scope="col">1만 골드당 전투력</th>
                      <th scope="col">
                        <span className={styles.sr}>시뮬레이터</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ok.map((c, i) => {
                      const tryable = editsFor(c.change, NO_EDITS) != null && c.change;
                      return (
                        // Keyed by the order of the list on screen: a new
                        // order draws new rows instead of sliding the old ones (A7).
                        <tr key={`${guide.sort}:${c.id}`}>
                          <td data-cell="rank">{i + 1}</td>
                          <td data-cell="kind">{kindLabel(c.kind)}</td>
                          <th scope="row" data-cell="target">
                            <span className={styles.specUpTarget}>
                              <GameIcon src={c.icon} grade={c.grade} size={28} />
                              <span>{c.target}</span>
                            </span>
                          </th>
                          <td data-cell="change">
                            {c.from ?? "—"} → {c.to ?? "—"}
                          </td>
                          <td data-cell="gain" data-label="전투력" className={styles.specUpGain} data-figure="">
                            {c.deltaCombatPower == null ? "—" : `+${two(c.deltaCombatPower)}`}
                            {c.deltaPercent != null && <small> ({c.deltaPercent.toFixed(3)}%)</small>}
                          </td>
                          <CostCell candidate={c} />
                          <td data-cell="eff" data-label="1만 골드당" data-figure="">
                            {c.combatPowerPer10kGold == null ? "—" : two(c.combatPowerPer10kGold)}
                          </td>
                          <td data-cell="try">
                            {tryable && (
                              <Link
                                href={`?${new URLSearchParams({ tab: "simulator", try: tryParam(tryable) })}`}
                                replace
                                scroll={false}
                                className="hit-44"
                                aria-label={`${c.target} ${c.to ?? ""} 시뮬레이터에서 적용해 보기`}
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
                              {c.target}
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
          </>
        )}
      </div>
      <SpecUpGoal data={data} />
    </div>
  );
}
