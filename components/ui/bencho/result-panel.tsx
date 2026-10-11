"use client";
// MIT © 2026 Lorenzo Cabra — https://bencho.dev/blocks/picker
// From Bencho "Assignees" (full licence in ./NOTICE): the card that unfolds
// out of the pill's corner, the rows dealt out under it, and the portrait row
// (face · name · second line). For the header search's result panel
// (PM 총괄 2026-10-12 01:11). Our changes, and only these:
//  1. framer-motion → motion/react `m` under LazyMotion (features load with
//     this module, which the header loads only when the search opens);
//     lucide → none needed (the tick is gone, see 3).
//  2. One choice moves you on: no multi-select, no stack of faces in the
//     pill, no tick box. The pill is the header's own search input; this is
//     only the card under it.
//  3. Data in: groups of rows ({ id, title, sub?, side?, avatar? }), the
//     active row (aria-activedescendant is the caller's — the input keeps
//     focus, as a combobox does), onPick and onActive.
//  4. The active row reads by the hover tint AND a 2px bar on its left
//     (--ring), so it is not colour alone and stays legible (user 10-12:
//     hover colour must not hide text).
//  5. Tokens: Bencho's are mapped on the root (result-panel.css), nothing
//     global. Height caps at 60% of the screen and scrolls inside.
//  6. Reduced motion: the card and rows appear at once.
// The springs and their reasons are Bencho's and are kept as published.
import "./result-panel.css";
import type { ReactNode } from "react";
import { AnimatePresence, LazyMotion, m as motion, useReducedMotion } from "motion/react";

const loadFeatures = () => import("@/lib/motion-dom-animation").then((mod) => mod.default);

type ResultItem = {
  id: string;
  title: ReactNode;
  /** the second line: class · item level, a menu's section, … */
  sub?: ReactNode;
  /** right side: a menu's category, "Enter", … */
  side?: ReactNode;
  /** a portrait (official image URL) or anything round (an icon, an initial) */
  avatar?: { src?: string | null; fallback?: ReactNode };
};

type ResultGroup = { id: string; title?: ReactNode; items: ResultItem[] };

type ResultPanelProps = {
  open: boolean;
  /** the listbox id — the input's aria-controls */
  id: string;
  /** the listbox's name, e.g. "검색 결과" */
  label: string;
  groups: ResultGroup[];
  /** the row the input's arrows point at (aria-activedescendant = optionId(id, activeId)) */
  activeId?: string | null;
  onPick: (item: ResultItem) => void;
  /** pointer over a row: let the arrows carry on from there */
  onActive?: (id: string) => void;
  /** above the rows (ours, 10-12): what must not move when rows arrive later */
  header?: ReactNode;
  /** under the rows: key hints, an empty state */
  footer?: ReactNode;
  className?: string;
};

/** The option element's id for a row, for the input's aria-activedescendant. */
const optionId = (panelId: string, rowId: string) => `${panelId}-opt-${rowId}`;

function ResultPanel({ open, id, label, groups, activeId, onPick, onActive, header, footer, className }: ResultPanelProps) {
  const reduce = useReducedMotion();
  let order = 0;
  return (
    <LazyMotion features={loadFeatures}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={className ? `rsp ${className}` : "rsp"}
            /* ── it unfolds OUT OF the pill ──────────────────
               The origin is the card's top-left, which is the
               pill's own left edge, so it opens down and out
               from the corner it belongs to rather than growing
               from its middle like a box appearing.

               The scale starts high — 0.86 across, 0.72 down —
               because a card is a rounded rectangle and a scale
               drags its corner radius with it. From a third of
               its height the corners arrive visibly squashed;
               from three quarters, with the spring doing the
               work, they do not. The BOUNCE is where the
               character is, not the distance. */
            initial={reduce ? false : { opacity: 0, y: -10, scaleX: 0.86, scaleY: 0.72 }}
            animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8, scaleX: 0.92, scaleY: 0.86 }}
            transition={{
              /* zeta about 0.63 — it goes past and comes back,
                 which is the whole of "bubbly" */
              type: "spring", stiffness: 460, damping: 23, mass: 0.9,
              opacity: { duration: 0.12 },
            }}
          >
            {header && <div className="rsp-head">{header}</div>}
            <div className="rsp-scroll" id={id} role="listbox" aria-label={label}>
              {groups.map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.id} role="group" aria-labelledby={group.title ? `${id}-g-${group.id}` : undefined}>
                    {group.title && (
                      <div className="rsp-head" id={`${id}-g-${group.id}`} role="presentation">
                        {group.title}
                      </div>
                    )}
                    {group.items.map((item) => {
                      const i = order++;
                      const active = item.id === activeId;
                      return (
                        <motion.div
                          key={item.id}
                          id={optionId(id, item.id)}
                          className="rsp-row"
                          role="option"
                          aria-selected={active}
                          data-active={active || undefined}
                          /* the input keeps focus; a press must not take it */
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onPick(item)}
                          onPointerEnter={() => onActive?.(item.id)}
                          /* they deal out under the card rather than
                             arriving with it — four rows appearing at
                             once is a panel, four arriving in order is
                             a list being handed to you. Fast and close
                             together: 40ms apart is a stagger you feel
                             rather than one you wait through. (ours) Only
                             the first eight deal; the rest are there. */
                          initial={reduce || i >= 8 ? false : { opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            type: "spring", stiffness: 620, damping: 34, mass: 0.7,
                            delay: 0.04 * i + 0.03,
                          }}
                        >
                          {item.avatar && (
                            <span className="rsp-av" aria-hidden="true">
                              {item.avatar.src ? (
                                // eslint-disable-next-line @next/next/no-img-element -- official CDN portrait, 32px
                                <img src={item.avatar.src} alt="" draggable={false} loading="lazy" decoding="async" />
                              ) : (
                                item.avatar.fallback
                              )}
                            </span>
                          )}
                          <span className="rsp-who">
                            <span className="rsp-name">{item.title}</span>
                            {item.sub && <span className="rsp-sub">{item.sub}</span>}
                          </span>
                          {item.side && <span className="rsp-side">{item.side}</span>}
                        </motion.div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
            {footer && <div className="rsp-foot">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

export { ResultPanel, optionId };
export type { ResultItem, ResultGroup, ResultPanelProps };
