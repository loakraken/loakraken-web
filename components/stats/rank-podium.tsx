"use client";

import Link from "next/link";
import { MedalStarBold } from "@/components/ui/icons";
import { safeGameImage } from "@/lib/character/model";
import { ClassIcon } from "./class-icon";
import styles from "./rank-podium.module.css";

export type PodiumEntry = {
  rank: number | null | undefined;
  name: string;
  href: string;
  value: string;
  imageUrl?: string | null;
  className?: string | null;
  guild?: boolean;
};

/** Same reserved box in the first HTML, while fetching, and after a refetch.
 * An empty/short/unranked first page keeps unseen room: a background refresh
 * can never insert or remove height. Page changes are user initiated.
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
  if (page !== 1 && !reserve) return null;
  const first = entries.find((entry) => entry.rank === 1);
  const second = entries.find((entry) => entry.rank === 2);
  const third = entries.find((entry) => entry.rank === 3);
  const top = !loading && page === 1 && first && second && third ? [first, second, third] : null;

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
          {top.map((entry) => {
            const src = safeGameImage(entry.imageUrl);
            return (
              <li key={`${entry.rank}-${entry.href}`} className={styles.place} data-podium-place={entry.rank}>
                <MedalStarBold className={styles.medal} size={24} data-place={entry.rank} />
                <div className={styles.portraitBox} data-portrait-box="">
                  <div className={styles.cone} data-podium-cone="" aria-hidden="true" />
                  {src && !entry.guild ? (
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
                <strong className={styles.value} data-podium-value="">{entry.value}</strong>
                <div className={styles.block} data-podium-block="">
                  <div className={styles.glow} data-podium-glow="" aria-hidden="true" />
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
