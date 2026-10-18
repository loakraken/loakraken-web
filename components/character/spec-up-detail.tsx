"use client";
// 스펙업 후보 줄 상세 (사용자 결정 10-18, 이슈 #887): the row's target opens
// the shared item card — beside the row on a pointer, a bottom sheet on touch —
// with what the candidate costs in detail: the market listing (gems, books),
// the refining materials and gold, and the stats before and after. Read only
// when a row is opened; every number is the backend's, and the material total
// matches the row's cost (the server keeps them equal).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ItemDetail,
  ItemDetailSection,
  ItemLine,
  ItemStat,
  ItemTooltip,
  ItemTooltipContent,
  ItemTooltipTrigger,
} from "@/components/ui/item-tooltip";
import { itemGrade } from "@/components/character/item-tooltip";
import { rateLimitCopy } from "@/lib/api/rate-limit";
import { SpecUpQueryError, fetchSpecUpDetail } from "@/lib/spec-up/client";
import {
  breathLabel,
  materialsTotal,
  refiningLink,
  specUpDetailQuery,
  type DetailStat,
  type SpecUpDetail,
} from "@/lib/spec-up/detail";
import { kindLabel, koreanGold, type Candidate } from "@/lib/spec-up/model";
import { safeGameImage } from "@/lib/character/model";
import { GameIcon } from "./imagery";
import { kstTime } from "./parts";
import styles from "./detail.module.css";

/** Prices refresh by the minute, like every market screen. */
const DETAIL_STALE_MS = 60_000;

const two = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gold = (value: number | null | undefined) => (value == null ? "시세 확인 중" : `${koreanGold(Math.round(value))}G`);
const qty = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

function statValue(value: DetailStat["before"], unit: string | null) {
  if (value == null) return "—";
  const text = typeof value === "number" ? value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : value;
  return unit ? `${text}${unit}` : text;
}

function failureText(error: unknown) {
  const code = error instanceof SpecUpQueryError ? error.info.code : "";
  if (code === "SPEC_UP_CANDIDATE_NOT_FOUND") return "이 후보가 바뀌었어요. 목록을 새로 불러오고 있어요.";
  if (code === "CLIENT_RATE_LIMITED") return rateLimitCopy().text;
  if (code === "CHARACTER_NOT_CACHED") return "캐릭터 정보를 먼저 불러와 주세요.";
  return "상세를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.";
}

function DetailBody({ detail, characterName }: { detail: SpecUpDetail; characterName: string }) {
  const c = detail.candidate;
  const total = materialsTotal(detail);
  const link = refiningLink(characterName, detail.refine);
  const before = detail.combatPowerBefore;
  const after = detail.combatPowerAfter;
  return (
    <>
      <ItemDetailSection label="전투력">
        {before != null && after != null ? (
          <ItemStat label={`${two(before)} → ${two(after)}`} value={`+${two(after - before)}`} tone="up" emphasis />
        ) : (
          <ItemStat label="오르는 전투력" value={c.deltaCombatPower == null ? "—" : `+${two(c.deltaCombatPower)}`} tone="up" emphasis />
        )}
      </ItemDetailSection>
      {detail.stats.length > 0 && (
        <ItemDetailSection label="바뀌는 능력치">
          {detail.stats.map((s) => (
            <ItemStat key={s.name} label={s.name} value={`${statValue(s.before, s.unit)} → ${statValue(s.after, s.unit)}`} />
          ))}
        </ItemDetailSection>
      )}
      {detail.market && detail.market.length > 0 && (
        <ItemDetailSection label="시세">
          {detail.market.map((m) => {
            // SELL: the gem in the slot now, its expected sale taken off the cost.
            const sell = m.role === "SELL";
            return (
              <div key={`${m.role}:${m.itemName}`} className={styles.specUpDetailItem}>
                <GameIcon src={m.icon} grade={m.grade} size={28} />
                <ItemStat
                  label={
                    <>
                      {sell ? "판매 기대" : "구매"} · {m.itemName}
                      {m.quantity > 1 && <span className={styles.specUpDetailSub}> ×{m.quantity}</span>}
                    </>
                  }
                  value={
                    <>
                      {sell ? `−${gold(m.expectedSalePrice)}` : gold(m.price == null ? null : m.price * m.quantity)}
                      {m.listedCount != null && (
                        <small className={styles.specUpDetailSub}> · 매물 {m.listedCount.toLocaleString("ko-KR")}개</small>
                      )}
                    </>
                  }
                />
              </div>
            );
          })}
          {c.cost?.status === "OK" && c.cost.amount != null && <ItemStat label="기대 비용" value={gold(c.cost.amount)} emphasis />}
          {detail.market.some((m) => m.role === "SELL") && (
            <ItemLine tone="muted">판매 기대는 최저가에서 거래소 수수료 5%를 뺀 값이에요.</ItemLine>
          )}
        </ItemDetailSection>
      )}
      {detail.refine && (
        <ItemDetailSection label={`재련 +${detail.refine.fromStage} → +${detail.refine.toStage}`}>
          {detail.refine.expectedAttempts != null && (
            <ItemStat label="기대 시도" value={`${qty(detail.refine.expectedAttempts)}회`} />
          )}
          {detail.refine.firstAttemptSuccessRateBp != null && (
            <ItemStat label="첫 시도 성공 확률" value={`${qty(detail.refine.firstAttemptSuccessRateBp / 100)}%`} />
          )}
          {breathLabel(detail.refine.breath) && <ItemStat label="숨결" value={breathLabel(detail.refine.breath)} />}
        </ItemDetailSection>
      )}
      {detail.materials && detail.materials.length > 0 && (
        <ItemDetailSection label="필요 재료 (기대값)">
          {detail.materials.map((m) => (
            <div key={m.itemName} className={styles.specUpDetailItem}>
              <GameIcon src={m.icon} size={28} />
              <ItemStat
                label={
                  <>
                    {m.itemName} <span className={styles.specUpDetailSub}>×{qty(m.quantity)}</span>
                  </>
                }
                value={m.priceStatus === "OK" && m.gold != null ? gold(m.gold) : "시세 확인 중"}
              />
            </div>
          ))}
          {detail.goldFee != null && detail.goldFee > 0 && <ItemStat label="재련 골드" value={gold(detail.goldFee)} />}
          {total != null && <ItemStat label="기대 비용" value={gold(total)} emphasis />}
        </ItemDetailSection>
      )}
      {(detail.pricesAt || link) && (
        <ItemDetailSection>
          {detail.pricesAt && <ItemLine tone="muted">시세 {kstTime(detail.pricesAt)} 기준</ItemLine>}
          {link && (
            <Link href={link} className={`${styles.specUpDetailLink} hit-44`}>
              재련 계획에서 단계별로 보기
            </Link>
          )}
        </ItemDetailSection>
      )}
    </>
  );
}

/**
 * The target cell of a candidate row as a button that opens its detail. Opens
 * on a press only (moving across the table must not fetch or pop cards).
 */
export function SpecUpRowDetail({
  characterName,
  fetchedAt,
  candidate,
}: {
  characterName: string;
  fetchedAt: string | null | undefined;
  candidate: Candidate;
}) {
  // Asked to open; the card itself opens once its detail (or an error) is in,
  // so it opens at its final size. Opening first with a one-line "loading"
  // card and growing it moved the phone popover's top edge (PM-프론트 #901 P1).
  const [wanted, setWanted] = useState(false);
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: specUpDetailQuery(characterName, fetchedAt, candidate.id),
    queryFn: ({ signal }) => fetchSpecUpDetail(characterName, candidate.id, signal),
    enabled: wanted,
    staleTime: DETAIL_STALE_MS,
    retry: false,
  });
  const data = detail.data?.data;
  const ready = !!data || detail.isError;
  const open = wanted && ready;
  // A candidate no longer in the list: the list is read again by itself
  // (PM-프론트 #901 P2), the card says so meanwhile.
  const gone = detail.error instanceof SpecUpQueryError && detail.error.info.code === "SPEC_UP_CANDIDATE_NOT_FOUND";
  useEffect(() => {
    if (gone) void queryClient.invalidateQueries({ queryKey: ["spec-up", characterName] });
  }, [gone, queryClient, characterName]);
  const icon = safeGameImage(candidate.icon);
  return (
    <ItemTooltip open={open} onOpenChange={(next) => setWanted(next)}>
      <ItemTooltipTrigger
        openOnHover={false}
        className={styles.specUpTargetButton}
        aria-busy={(wanted && !ready) || undefined}
        data-loading={(wanted && !ready) || undefined}
      >
        <span className={styles.specUpTarget}>
          <GameIcon src={candidate.icon} grade={candidate.grade} size={28} />
          <span>{candidate.target}</span>
        </span>
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={`${candidate.target} 상세`}>
        <ItemDetail
          grade={itemGrade(candidate.grade)}
          title={candidate.target}
          icon={
            icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
              <img src={icon} alt="" width={56} height={56} referrerPolicy="no-referrer" />
            ) : undefined
          }
          lines={[`${kindLabel(candidate.kind)} · ${candidate.from ?? "—"} → ${candidate.to ?? "—"}`]}
        >
          {data ? (
            <DetailBody detail={data} characterName={characterName} />
          ) : (
            // Loading and failure are announced; the loaded card is read on its own.
            <div role="status">
              {detail.isError ? (
                <ItemLine tone="warn">{failureText(detail.error)}</ItemLine>
              ) : (
                <ItemLine tone="muted">상세를 불러오는 중…</ItemLine>
              )}
            </div>
          )}
        </ItemDetail>
      </ItemTooltipContent>
    </ItemTooltip>
  );
}
