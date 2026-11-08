"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MedalStarBold } from "@/components/ui/icons";
import { safeGameImage } from "@/lib/character/model";
import { podiumTop } from "@/lib/stats/podium";
import { BotNote } from "@/components/bot/bot-note";
import { ClassIcon } from "./class-icon";
import styles from "./rank-podium.module.css";

/** Odometer digits (rolling-counter idea, our own few lines): each digit rolls
 *  up from 0 once on first paint. Screen readers and tests read the hidden
 *  plain value; the reels are decoration. */
function RollingValue({ text }: { text: string }) {
  return (
    <>
      <span className={styles.valueText} data-value-text="">{text}</span>
      <span className={styles.rolling} aria-hidden="true">
        {Array.from(text).map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className={styles.digit} data-podium-digit="" style={{ ["--d" as string]: Number(ch), ["--i" as string]: i }}>
              <span className={styles.reel}>0123456789</span>
            </span>
          ) : (
            <span key={i} className={styles.digit} data-podium-digit="">{ch}</span>
          ),
        )}
      </span>
    </>
  );
}

export type PodiumEntry = {
  rank: number | null | undefined;
  name: string;
  href: string;
  value: string;
  imageUrl?: string | null;
  className?: string | null;
  guild?: boolean;
};

/** Same reserved box in the first HTML, while fetching, and after a refetch:
 * a list that was still loading keeps unseen room if it comes back with no
 * ranked row, so a background refresh never inserts or removes height. A list
 * known to have none at the first render has no box at all. Page changes are
 * user initiated.
 */
/** The visitor stopped the podium's turning rings (this browser). */
const MOTION_KEY = "loakraken-podium-motion";
const motionListeners = new Set<() => void>();
/** The choice when storage is blocked: kept for this page only. */
let motionFallback: boolean | null = null;
function subscribeMotion(callback: () => void) {
  motionListeners.add(callback);
  const onStorage = (event: StorageEvent) => { if (event.key === MOTION_KEY) callback(); };
  window.addEventListener("storage", onStorage);
  return () => {
    motionListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}
function motionStopped() {
  if (motionFallback !== null) return motionFallback;
  try {
    return localStorage.getItem(MOTION_KEY) === "paused";
  } catch {
    return false;
  }
}
function setMotionStopped(stopped: boolean) {
  try {
    if (stopped) localStorage.setItem(MOTION_KEY, "paused");
    else localStorage.removeItem(MOTION_KEY);
  } catch {
    motionFallback = stopped;
  }
  motionListeners.forEach((listener) => listener());
}

export function RankPodium({
  entries,
  page,
  loading = false,
  reserve = false,
}: {
  entries: readonly PodiumEntry[];
  page: number;
  loading?: boolean;
  /** A guild-name link may correct an out-of-range page to page 1 without input. */
  reserve?: boolean;
}) {
  // An official image that fails to load shows the class icon in the same box.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  // Whether this podium has waited for a list at any point (then its box stays):
  // an empty list whose filter changes loads into the box, and taking the box
  // away when the answer is empty again would move everything below it.
  const [held, setHeld] = useState(() => loading || reserve);
  if ((loading || reserve) && !held) setHeld(true);
  // The medal rings turn without end (user, 11-08), so the visitor can stop
  // them (WCAG 2.2.2); the choice is remembered in this browser. They also
  // rest off-screen and in a hidden tab (set on the element: no re-render).
  const still = useSyncExternalStore(subscribeMotion, motionStopped, () => false);
  const box = useRef<HTMLElement>(null);
  const shown = page === 1 || reserve;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete el.dataset.offscreen;
      else el.dataset.offscreen = "";
    });
    io.observe(el);
    const onVisible = () => {
      if (document.hidden) el.dataset.tabHidden = "";
      else delete el.dataset.tabHidden;
    };
    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [shown]);
  const toggleMotion = () => setMotionStopped(!still);
  if (page !== 1 && !reserve) return null;
  const ranked = !loading && page === 1 ? podiumTop(entries) : [];
  const top = ranked.length ? ranked : null;
  if (!top && !loading && !held) return null;

  return (
    <section
      ref={box}
      className={styles.podium}
      data-rank-podium=""
      data-podium-motion={still ? "paused" : undefined}
      data-podium-state={top ? "ready" : loading ? "loading" : "empty"}
      aria-label="상위 3위"
      aria-busy={loading || undefined}
      aria-hidden={!top || undefined}
    >
      {top ? (
        <>
        <button
          type="button"
          className={styles.motion}
          onClick={toggleMotion}
          data-podium-motion-toggle=""
        >
          {still ? "시상대 효과 켜기" : "시상대 효과 멈춤"}
        </button>
        <ol className={styles.places} role="list">
          {top.map((entry, slot) => {
            const src = safeGameImage(entry.imageUrl);
            return (
              <li
                key={`${entry.rank}-${entry.href}`}
                className={styles.place}
                data-podium-place={slot + 1}
                data-podium-medal={Math.min(3, entry.rank ?? 3)}
              >
                <MedalStarBold className={styles.medal} size={24} data-place={entry.rank} />
                <div className={styles.portraitBox} data-portrait-box="">
                  {src && !entry.guild && !broken.has(src) ? (
                    // Official opaque 612×708 JPEG, hotlinked like character/imagery.tsx.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.portrait}
                      data-podium-image=""
                      src={src}
                      alt=""
                      width={132}
                      height={144}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setBroken((prev) => new Set(prev).add(src))}
                      // A server-drawn list (팔찌·젬 효율) can fail its image before
                      // hydration, when no onError is listening yet: an image already
                      // done with no pixels is broken too (QA 11-04).
                      ref={(img) => {
                        if (img?.complete && img.naturalWidth === 0 && img.currentSrc)
                          setBroken((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
                      }}
                    />
                  ) : (
                    <div className={styles.fallback} data-portrait-fallback={entry.guild ? "guild" : "class"} aria-hidden="true">
                      {entry.guild ? (
                        <span className={styles.guildLetter}>{Array.from(entry.name)[0]}</span>
                      ) : (
                        <ClassIcon name={entry.className ?? ""} size={48} />
                      )}
                    </div>
                  )}
                </div>
                <Link className={styles.name} href={entry.href} prefetch={false} data-podium-name="">
                  {entry.name}
                </Link>
                <strong className={styles.value} data-podium-value="">
                  <RollingValue text={entry.value} />
                </strong>
                <div className={styles.block} data-podium-block="">
                  <span className={styles.placeNumber}>{entry.rank}위</span>
                </div>
                <span className={styles.beam} aria-hidden="true" data-podium-beam="" />
              </li>
            );
          })}
        </ol>
        </>
      ) : (
        // Kept room after a list came back with no ranked row (it was loading):
        // the item-5 empty note, not a blank box. Unread here: the table's own
        // note says it. While loading, unseen room.
        loading ? (
          <div className={styles.unseen} aria-hidden="true" />
        ) : (
          <div className={styles.emptyNote} data-podium-empty="">
            <BotNote mood="puzzled">
              <p>시상대에 오를 순위가 아직 없어요.</p>
            </BotNote>
          </div>
        )
      )}
    </section>
  );
}
