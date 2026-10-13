"use client";

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
 */
export function BannerRank({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const rank = query.data ? bannerRank(query.data.data) : null;
  return (
    <p className={styles.bannerRank}>
      {rank ? (
        <Tooltip>
          <TooltipTrigger className={styles.bannerRankBadge} aria-label={`${rank.text}. ${rank.note}`}>
            {rank.tier && <b>{rank.tier}</b>}
            {rank.text}
          </TooltipTrigger>
          <TooltipContent>{rank.note}</TooltipContent>
        </Tooltip>
      ) : (
        " "
      )}
    </p>
  );
}
