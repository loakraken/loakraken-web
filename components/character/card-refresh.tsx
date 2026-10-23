"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshArrow } from "@/components/ui/icons";
import { InlineOrb } from "@/components/landing/orb";
import { failureOf, secondsUntil } from "@/lib/api/rate-limit";
import { remainingText } from "@/lib/time/remaining";
import { refreshSummary } from "@/lib/character/card-collection";
import { postCardRefresh } from "@/lib/character/client";
import styles from "./card-collection.module.css";

/** Seconds left until a time, ticking each second while positive. */
export function useSecondsUntil(until: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);
  return secondsUntil(until, now);
}

const wait = (seconds: number) => remainingText(seconds * 1000) ?? "0초";

/**
 * "기록 채우기" (backend #138): reads the same-server roster (up to 12
 * characters, several seconds) into the card records, then a 10-minute
 * cooldown. Pressing shows progress at once and cannot double-submit; the
 * result is told in words, never the backend field names.
 */
export function CardRefresh({ name }: { name: string }) {
  const client = useQueryClient();
  const refill = useMutation({
    mutationFn: () => postCardRefresh(name, AbortSignal.timeout(35_000)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["card-collection", name] }),
  });
  const failure = failureOf(refill.error);
  const cooling = failure?.code === "CARD_COLLECTION_REFRESH_COOLDOWN";
  const limited = failure?.code === "LOST_ARK_RATE_LIMITED";
  const until = refill.data
    ? Date.parse(refill.data.data.nextAvailableAt)
    : cooling || limited
      ? failure?.retryAt
      : undefined;
  const seconds = useSecondsUntil(until);
  const busy = refill.isPending;
  const blocked = busy || seconds > 0;
  // Synchronous lock: a double click fires twice before React re-renders, and
  // each refill spends up to 12 official calls.
  const lock = useRef(false);
  function start() {
    if (lock.current || blocked) return;
    lock.current = true;
    refill.mutate(undefined, { onSettled: () => (lock.current = false) });
  }

  const status = busy
    ? "원정대 카드 기록을 불러오는 중이에요. 몇 초 걸릴 수 있어요."
    : refill.data
      ? refreshSummary(refill.data.data, refill.submittedAt)
      : cooling
        ? "얼마 전에 채웠어요."
        : limited
          ? "요청이 많아 잠시 쉬어 가요."
          : refill.isError
            ? "기록을 채우지 못했어요. 잠시 뒤 다시 시도해 주세요."
            : "";

  return (
    <div className={styles.refill}>
      <button
        type="button"
        className={styles.refillButton}
        // Spends official API calls: never pressed again after hydration.
        data-no-replay
        onClick={start}
        // aria-disabled, not disabled: keyboard focus stays on the button.
        aria-disabled={blocked || undefined}
        aria-describedby={`card-refill-note-${name}`}
      >
        {busy ? <InlineOrb /> : <RefreshArrow size={14} aria-hidden="true" />}
        {busy ? "불러오는 중…" : seconds > 0 ? `${wait(seconds)} 뒤 다시 채우기` : "기록 채우기"}
      </button>
      <p className={styles.refillStatus} aria-live="polite">
        {status}
      </p>
      <p className={styles.refillNote} id={`card-refill-note-${name}`}>
        원정대 캐릭터를 차례로 조회해 카드 기록을 채워요. 채우는 동안과 직후 1분쯤은 다른 캐릭터 검색이 잠시 막힐 수 있어요.
      </p>
    </div>
  );
}
