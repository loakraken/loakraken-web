"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRank } from "@/lib/character/client";
import { bannerRank } from "@/lib/character/rank";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./character.module.css";

/** How the row is laid out: "auto" lets the browser wrap (first paint only), 1 or 2 lines once fixed. */
type Lines = "auto" | 1 | 2;
/** Short steps when the words do not fit the row's lines: 0 all, 1 without 상위, 2 also without the tier. */
type Short = 0 | 1 | 2;

const rowClass = (lines: Lines) =>
  lines === "auto" ? `${styles.bannerRank} ${styles.bannerRankWraps}` : lines === 2 ? `${styles.bannerRank} ${styles.bannerRankTwo}` : styles.bannerRank;
const badgeClass = (short: Short) =>
  short === 2
    ? `${styles.bannerRankBadge} ${styles.bannerRankShort} ${styles.bannerRankShorter}`
    : short === 1
      ? `${styles.bannerRankBadge} ${styles.bannerRankShort}`
      : styles.bannerRankBadge;

/**
 * 배너 순위 (character screen checklist §14.1 ⑤): the combat power rank over
 * every character LOAKraken has seen, with its tier, under the banner
 * numbers. Same query as the 순위 panel (one request). The line is there from
 * the first HTML, empty until the rank arrives or when there is none, so the
 * banner never moves (A6). Never called an official rank.
 *
 * Fit (PM 총괄 11-16): the badge is two unbreakable halves, [tier rank] and [상위 share]. When the rank is in
 * the first HTML the browser lays them out on one line if they fit and on two if not (any tier, length, font,
 * width; the site font is display:optional, so nothing changes after the first paint). That line count is then
 * kept: a refetched rank of another length, or a rank arriving into a row first drawn empty (always one line),
 * is fitted to the row's lines by short steps (without 상위, then also without the tier). Only a change of the
 * row's width (a resize) lets a row that had its rank at the first paint wrap again. The name is the badge's own
 * text, then a sentence that is never drawn and always says the full rank (WCAG 2.5.3).
 */
export function BannerRank({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["character-rank", name],
    queryFn: ({ signal }) => fetchRank(name, signal),
    staleTime: 5 * 60_000,
  });
  const rank = query.data ? bannerRank(query.data.data) : null;
  // Read once: a row drawn with its rank may wrap; one drawn empty stays one line.
  const [known] = useState(() => rank !== null);
  const [lines, setLines] = useState<Lines>(known ? "auto" : 1);
  const [short, setShort] = useState<Short>(0);
  const row = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const text = rank?.text;

  // Measured before paint with the classes set on the elements for the reading only, then put back; the state
  // that follows renders the same classes. "mount" and "resize" read the natural line count (rows known at the
  // first paint); "text" keeps the line count and finds the first short step that fits.
  const decide = useRef<(why: "mount" | "resize" | "text") => void>(() => {});
  decide.current = (why) => {
    const el = row.current;
    const badge = el?.querySelector("button");
    const halves = badge?.querySelector<HTMLElement>(`.${styles.bannerRankHalves}`);
    if (!el || !badge || !halves) return;
    const [keepRow, keepBadge] = [el.className, badge.className];
    const fits = (l: 1 | 2, s: Short) => {
      el.className = rowClass(l);
      badge.className = badgeClass(s);
      return halves.scrollWidth <= halves.clientWidth + 0.5;
    };
    let nextLines: 1 | 2 = lines === "auto" ? 1 : lines;
    if (known && why !== "text") {
      el.className = rowClass("auto");
      badge.className = badgeClass(0);
      const [first, second] = halves.children;
      nextLines = second && second.getBoundingClientRect().top > first.getBoundingClientRect().top + 1 ? 2 : 1;
    }
    const nextShort = ([0, 1, 2] as const).find((s) => fits(nextLines, s)) ?? 2;
    el.className = keepRow;
    badge.className = keepBadge;
    setLines(nextLines);
    setShort(nextShort);
  };

  const first = useRef(true);
  useLayoutEffect(() => {
    if (!rank) return;
    decide.current(first.current ? "mount" : "text");
    first.current = false;
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    let width = el.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const now = el.getBoundingClientRect().width;
      if (Math.abs(now - width) < 0.5) return; // Height changes are ours, not a resize.
      width = now;
      decide.current("resize");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <p ref={row} className={rowClass(lines)}>
      {rank ? (
        <Tooltip>
          <TooltipTrigger className={badgeClass(short)} aria-labelledby={`${id}-text ${id}-more`}>
            <span id={`${id}-text`} className={styles.bannerRankText}>
              <span className={styles.bannerRankHalves}>
                <span className={styles.bannerRankHalf}>
                  {rank.tier && <b className={styles.bannerRankTier}>{rank.tier} </b>}
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
                A short step leaves words out of the drawn text, so then this sentence says the rank in full. */}
            <span id={`${id}-more`} hidden>
              {short > 0
                ? `${rank.tier ? `${rank.tier} ` : ""}${rank.text}, ${rank.note}`
                : `${rank.label} 순위, ${rank.note}`}
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
