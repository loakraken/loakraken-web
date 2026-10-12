"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { RefreshArrow } from "@/components/ui/icons";
import { InlineOrb } from "@/components/landing/orb";
import { failureOf } from "@/lib/api/rate-limit";
import { remainingText } from "@/lib/time/remaining";
import { postRosterPowerRefresh } from "@/lib/character/client";
import { powerSummary, viewOfRefresh, type PowerRecord } from "@/lib/character/roster-list";
import type { RosterPowerEnvelope } from "@/lib/character/roster-power";
import { useSecondsUntil } from "./card-refresh";
import { number } from "./parts";
import styles from "./detail.module.css";

export const rosterPowerKey = (name: string) => ["roster-combat-power", name] as const;
const refreshKey = (name: string) => ["roster-combat-power-refresh", name] as const;

/** True while this roster's combat powers are being read (the list dims, A8). */
export const useRosterPowerRefreshing = (name: string) => useIsMutating({ mutationKey: refreshKey(name) }) > 0;

const wait = (seconds: number) => remainingText(seconds * 1000) ?? "0초";

/**
 * 원정대 전투력 (L19): the six-man mean and the total by combat power, and the
 * button that reads the characters without a record. Every part keeps its
 * room from the first render (loading, loaded, failed, all recorded), so the
 * list under it never moves (A6·A7). A character without a record and one the
 * service does not record look the same, and the result is never told in
 * counts (B5).
 */
export function RosterPower({
  name,
  siblings,
  records,
  query,
}: {
  name: string;
  siblings: readonly { characterName: string }[];
  records: ReadonlyMap<string, PowerRecord>;
  query: UseQueryResult<RosterPowerEnvelope>;
}) {
  const view = query.data?.data;
  const summary = powerSummary(siblings, records);
  const client = useQueryClient();
  const refresh = useMutation({
    mutationKey: refreshKey(name),
    mutationFn: () => postRosterPowerRefresh(name, AbortSignal.timeout(35_000)),
    onSuccess: (result) => {
      // The answer is the whole roster after the read: no second request.
      client.setQueryData<RosterPowerEnvelope>(rosterPowerKey(name), {
        code: "CHARACTER_ROSTER_COMBAT_POWER_SUCCESS",
        message: result.message,
        data: viewOfRefresh(result.data),
      });
      // A read records like a search, so this character may have a new history point.
      void client.invalidateQueries({ queryKey: ["history", name] });
    },
  });
  const failure = failureOf(refresh.error);
  const cooling = failure?.code === "ROSTER_REFRESH_COOLDOWN";
  const limited = failure?.code === "LOST_ARK_RATE_LIMITED" || failure?.code === "CLIENT_RATE_LIMITED";
  const availableAt = view?.refreshAvailableAt ? Date.parse(view.refreshAvailableAt) : undefined;
  const seconds = useSecondsUntil(cooling || limited ? failure?.retryAt : availableAt);
  const busy = refresh.isPending;
  const blocked = busy || seconds > 0;
  // Synchronous lock: a double click fires twice before React re-renders.
  const lock = useRef(false);
  function start() {
    if (lock.current || blocked) return;
    lock.current = true;
    refresh.mutate(undefined, { onSettled: () => (lock.current = false) });
  }

  const missing = (view?.missingCount ?? 0) > 0;
  const status = busy
    ? "기록이 없는 캐릭터를 차례로 불러오고 있어요. 몇 초 걸릴 수 있어요."
    : refresh.data
      ? refresh.data.data.remaining > 0
        ? "전투력을 불러왔어요. 남은 캐릭터는 다시 눌러 이어서 불러올 수 있어요."
        : "전투력을 불러왔어요."
      : cooling
        ? "얼마 전에 불러왔어요. 잠시 뒤 다시 불러올 수 있어요."
        : limited
          ? "요청이 많아 잠시 쉬어 가요."
          : refresh.isError
            ? "전투력을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
            : missing
              ? "기록이 없는 캐릭터를 공식 정보에서 한 번에 12명까지 불러와요."
              : "";

  return (
    <section className={styles.rosterPower} aria-label="원정대 전투력" aria-busy={query.isPending || busy || undefined}>
      <p className={styles.rosterSummary}>
        {query.isPending ? (
          " "
        ) : query.isError ? (
          <span className={styles.muted}>전투력 기록을 불러오지 못했어요.</span>
        ) : summary.sixAverage == null ? (
          <span className={styles.muted}>아직 전투력 기록이 없어요.</span>
        ) : (
          <>
            전투력 식스맨 평균 <b>{number(summary.sixAverage)}</b>
            <small> (상위 {summary.sixCount}명)</small>
            {" · "}총합 <b>{number(summary.total)}</b>
            <small>
              {summary.recorded < summary.count ? ` (${summary.recorded}명 기준)` : ` (${summary.count}명)`}
            </small>
          </>
        )}
      </p>
      {/* Two fixed rows: the button (or a note), then the status line. */}
      <div className={styles.rosterPowerAction}>
        {view && !missing && <span className={styles.muted}>모든 캐릭터의 전투력 기록이 있어요.</span>}
        {missing && (
          <button
            type="button"
            className={styles.rosterPowerButton}
            // Spends official API calls: never pressed again after hydration.
            data-no-replay
            onClick={start}
            // aria-disabled, not disabled: keyboard focus stays on the button.
            aria-disabled={blocked || undefined}
          >
            {busy ? <InlineOrb /> : <RefreshArrow size={14} aria-hidden="true" />}
            {busy ? "불러오는 중…" : seconds > 0 ? `${wait(seconds)} 뒤 다시 불러오기` : "전투력 불러오기"}
          </button>
        )}
        <p className={styles.rosterPowerStatus} aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  );
}
