"use client";

// 지옥 · 나락 보상: 원정대 빠른 전환 (X4 (a), web #1975). One name loads the roster (our roster api, as the 숙제 tool);
// a character's card sets the key level that character can enter. Kept in this browser (lib/tools/hell-roster.ts).
// The cards sit in a box of fixed height from the first paint: a roster landing late, or the one this browser kept
// arriving after the first paint, never moves what is below (A7).
import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CharacterQueryError, fetchSiblings } from "@/lib/character/client";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { keyLevelFor, rosterOf, useHellRoster } from "@/lib/tools/hell-roster";
import { FpEnd } from "@/components/ui/fp-end";
import styles from "./hell-roster.module.css";

const TIME = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

const levelText = (value: number) => value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function HellRoster({
  keyLevels,
  level,
  onPick,
}: {
  keyLevels: readonly number[];
  level: number;
  onPick: (level: number) => void;
}) {
  const id = useId();
  const [roster, setRoster] = useHellRoster();
  const [name, setName] = useState("");
  const load = useMutation({
    mutationFn: (target: string) => fetchSiblings(target, new AbortController().signal),
    onSuccess: (envelope) => {
      setRoster(rosterOf(envelope));
      setName("");
    },
  });
  const limit = useRateLimit(load.error);
  const failure = load.error instanceof CharacterQueryError ? load.error.info : load.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const blocked = load.isPending || limit.seconds > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = name.trim() || roster?.name || "";
    if (!target || blocked) return;
    load.mutate(target);
  }

  // One line, always there: why loading failed, or when the roster was fetched.
  const status = failure
    ? limit.limited
      ? `${rateLimitCopy(failure).title}. ${rateLimitCopy(failure).text}`
      : failure.code === "CHARACTER_NOT_FOUND"
        ? "그 이름의 캐릭터를 찾지 못했어요."
        : "원정대를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
    : roster
      ? `${TIME.format(new Date(roster.fetchedAt))} 기준 아이템 레벨이에요.`
      : "";

  return (
    <section className={styles.roster} aria-labelledby={`${id}-title`}>
      {/* Drawn once whole (data-fp-whole): in a cut first HTML the title sat alone and dropped when the form came. */}
      <div className={styles.head} data-fp-whole="">
        <h2 id={`${id}-title`} className={styles.title}>
          원정대에서 고르기
        </h2>
        <form className={styles.form} onSubmit={submit} noValidate>
          <label htmlFor={`${id}-name`} className={styles.sr}>
            원정대 캐릭터 이름
          </label>
          <input
            id={`${id}-name`}
            name="rosterName"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={roster ? roster.name : "원정대 캐릭터 이름 하나"}
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
          />
          <button
            type="submit"
            className={`${styles.load} hit-44`}
            aria-disabled={blocked || undefined}
            aria-busy={load.isPending || undefined}
          >
            {/* The same label with or without a kept roster: it changing after the first paint moved its text (A7). */}
            {load.isPending ? "불러오는 중…" : retryLabel(limit.seconds, "불러오기")}
          </button>
        </form>
        <FpEnd />
      </div>
      <div className={styles.cards}>
        {roster && roster.members.length > 0 ? (
          <ul className={styles.list} aria-label="원정대 캐릭터">
            {roster.members.map((m) => {
              const target = keyLevelFor(m.itemLevel, keyLevels);
              const pressed = target != null && roster.picked === m.characterName && target === level;
              return (
                <li key={m.characterName}>
                  <button
                    type="button"
                    className={styles.card}
                    aria-pressed={pressed}
                    aria-disabled={target == null || undefined}
                    onClick={() => {
                      if (target == null) return;
                      // A failed reload's sentence ends here: the line goes back to the kept roster's time.
                      // Not while a rate limit counts down (the error holds that countdown).
                      if (load.isError && limit.seconds === 0) load.reset();
                      onPick(target);
                      setRoster({ ...roster, picked: m.characterName });
                    }}
                  >
                    <b>{m.characterName}</b>
                    <small>
                      {m.className} · {levelText(m.itemLevel)}
                    </small>
                    <span className={styles.key}>{target == null ? `입장 불가(${keyLevels[0]} 미만)` : `${target} 열쇠`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.hint}>원정대 캐릭터 이름 하나로 불러오면, 누른 캐릭터가 들어갈 수 있는 열쇠 단계로 바로 맞춰요.</p>
        )}
      </div>
      <p className={styles.status} role="status">
        {status}
      </p>
    </section>
  );
}
