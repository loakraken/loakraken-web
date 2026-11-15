"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRank } from "@/lib/character/client";
import { bannerRank } from "@/lib/character/rank";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./character.module.css";

/**
 * 배너 순위 (character screen checklist §14.1 ⑤): the combat power rank over
 * every character LOAKraken has seen, with its tier, under the banner
 * numbers. Same query as the 순위 panel (one request). The line is there from
 * the first HTML, empty until the rank arrives or when there is none, so the
 * banner never moves (A6). Never called an official rank.
 *
 * Fit (PM 총괄 11-16): the badge is two unbreakable halves, [tier rank] and [상위 share]. When the rank is in
 * the first HTML the browser lays them out on one line if they fit and on two if not, for any tier, rank
 * length, font and width; the site font is display:optional, so the face never changes after the first
 * paint and neither does the height (only a resize can). A row first drawn empty (the server gave up after
 * its 1 s wait) keeps its one line: a rank arriving later shows in full if that fits, else without 상위.
 * The name is the badge's own text, then a sentence that is never drawn, so it starts with what is shown
 * (WCAG 2.5.3).
 */
export function BannerRank({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const rank = query.data ? bannerRank(query.data.data) : null;
  // Read once: a row drawn with its rank may grow to two lines; one drawn empty keeps one line.
  const [wraps] = useState(() => rank !== null);
  const [short, setShort] = useState(false);
  const row = useRef<HTMLParagraphElement>(null);
  const halves = useRef<HTMLSpanElement>(null);
  const id = useId();
  const text = rank?.text;

  // The one-line row: full when it fits, else without 상위. Measured before paint (the full form drawn for the
  // measurement only), again when the row's width changes. The badge is held to the row, so the test is
  // whether the unwrapped halves run past their own box.
  useLayoutEffect(() => {
    const el = row.current;
    const badge = el?.querySelector("button");
    if (wraps || !el || !badge) return;
    const decide = () => {
      if (!halves.current) return;
      const was = badge.classList.contains(styles.bannerRankShort);
      badge.classList.remove(styles.bannerRankShort);
      const over = halves.current.scrollWidth > halves.current.clientWidth + 0.5;
      badge.classList.toggle(styles.bannerRankShort, was);
      setShort(over);
    };
    decide();
    const observer = new ResizeObserver(decide);
    observer.observe(el);
    return () => observer.disconnect();
  }, [wraps, text]);

  const rowClass = wraps ? `${styles.bannerRank} ${styles.bannerRankWraps}` : styles.bannerRank;
  const badgeClass = !wraps && short ? `${styles.bannerRankBadge} ${styles.bannerRankShort}` : styles.bannerRankBadge;
  return (
    <p ref={row} className={rowClass}>
      {rank ? (
        <Tooltip>
          <TooltipTrigger className={badgeClass} aria-labelledby={`${id}-text ${id}-more`}>
            <span id={`${id}-text`} className={styles.bannerRankText}>
              <span ref={halves} className={styles.bannerRankHalves}>
                <span className={styles.bannerRankHalf}>
                  {rank.tier && <b>{rank.tier} </b>}
                  {/* On a phone the label is left out so the badge stays left of the
                      render (A37); the name above and the hidden sentence still say it. */}
                  <span className={styles.bannerRankLabel}>{rank.label} </span>
                  {rank.rank}
                </span>
                {rank.share && (
                  // The "·" before it is drawn in its leading gap, which is cut off when it starts a line.
                  <span className={`${styles.bannerRankHalf} ${styles.bannerRankShare}`}>
                    <span className={styles.bannerRankTopWord}>상위 </span>
                    {rank.share}
                  </span>
                )}
              </span>
            </span>
            {/* Never drawn (no box, so no text past the column for any scan); read through aria-labelledby.
                The short form leaves 상위 out of the drawn text, so then this sentence says the rank in full. */}
            <span id={`${id}-more`} hidden>
              {!wraps && short ? `${rank.text}, ${rank.note}` : `${rank.label} 순위, ${rank.note}`}
            </span>
          </TooltipTrigger>
          <TooltipContent>{rank.note}</TooltipContent>
        </Tooltip>
      ) : (
        " "
      )}
    </p>
  );
}
