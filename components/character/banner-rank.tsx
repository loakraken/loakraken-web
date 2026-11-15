"use client";

import { useId, useState } from "react";
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
 * Length rule (PM 총괄 11-16): up to 5 digits the badge is one full line at every width. A 6+ digit rank does
 * not fit one line below 400px, so there it takes two (tier and rank, then 상위 and the share). The row's
 * height is fixed by the first render: two lines only when the rank is already known to be long (the server's
 * answer in the first HTML). A long rank arriving later, into a one-line row, keeps that row and leaves 상위
 * out below 400px (the name still says the full rank), so nothing moves. The name is the
 * badge's own text, then a sentence that is never drawn, so it starts with what is shown (WCAG 2.5.3).
 */
export function BannerRank({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const rank = query.data ? bannerRank(query.data.data) : null;
  // Read once: the row keeps the height it was first drawn with.
  const [twoLines] = useState(() => rank?.long === true);
  const late = rank?.long === true && !twoLines;
  const id = useId();
  return (
    <p className={twoLines ? `${styles.bannerRank} ${styles.bannerRankTwo}` : styles.bannerRank}>
      {rank ? (
        <Tooltip>
          <TooltipTrigger
            className={late ? `${styles.bannerRankBadge} ${styles.bannerRankShort}` : styles.bannerRankBadge}
            aria-labelledby={`${id}-text ${id}-more`}
          >
            <span id={`${id}-text`} className={styles.bannerRankText}>
              {rank.tier && <b>{rank.tier}</b>}{" "}
              {/* On a phone the label is left out so the badge stays left of the
                  render (A37); the name above and the hidden sentence still say it. */}
              <span className={styles.bannerRankLabel}>{rank.label} </span>
              {rank.rank}
              {rank.share && (
                <>
                  <span className={styles.bannerRankSep}> ·</span>
                  <br className={styles.bannerRankBreak} />{" "}
                  <span className={styles.bannerRankTopWord}>상위 </span>
                  {rank.share}
                </>
              )}
            </span>
            {/* Never drawn (no box, so no text past the column for any scan); read through aria-labelledby. */}
            {/* The late short form leaves 상위 out of the drawn text, so this sentence says it in full. */}
            <span id={`${id}-more`} hidden>{late ? `${rank.text}, ${rank.note}` : `${rank.label} 순위, ${rank.note}`}</span>
          </TooltipTrigger>
          <TooltipContent>{rank.note}</TooltipContent>
        </Tooltip>
      ) : (
        " "
      )}
    </p>
  );
}
