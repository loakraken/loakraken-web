"use client";

import { useState } from "react";
import Link from "next/link";
import { MedalStarBold } from "@/components/ui/icons";
import { safeGameImage } from "@/lib/character/model";
import { podiumTop } from "@/lib/stats/podium";
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
  // Whether the first render was still waiting for the list (then its box stays).
  const [waited] = useState(() => loading || reserve);
  if (page !== 1 && !reserve) return null;
  const ranked = !loading && page === 1 ? podiumTop(entries) : [];
  const top = ranked.length ? ranked : null;
  if (!top && !loading && !waited) return null;

  return (
    <section
      className={styles.podium}
      data-rank-podium=""
      data-podium-state={top ? "ready" : loading ? "loading" : "empty"}
      aria-label="상위 3위"
      aria-busy={loading || undefined}
      aria-hidden={!top || undefined}
    >
      {top ? (
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
                      width={88}
                      height={96}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setBroken((prev) => new Set(prev).add(src))}
                    />
                  ) : (
                    <div className={styles.fallback} data-portrait-fallback={entry.guild ? "guild" : "class"} aria-hidden="true">
                      {entry.guild ? (
                        <span className={styles.guildLetter}>{Array.from(entry.name)[0]}</span>
                      ) : (
                        <ClassIcon name={entry.className ?? ""} size={32} />
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
              </li>
            );
          })}
        </ol>
      ) : (
        // Like the character rank panel's unseen content: occupies room, unread.
        <div className={styles.unseen} aria-hidden="true" />
      )}
    </section>
  );
}
