"use client"

import * as React from "react"
import { cn } from "cn"

// Characters side by side (PM 총괄 10-12 04:58 ⑤ — multi-search K37). Each
// card is one character; every card lists the same rows in the same order and
// height, so a row reads straight across. On a phone the cards scroll
// sideways (snapping to a card) instead of shrinking; the row names stay with
// each card, so a card read alone still makes sense.
//
// The best value in a row (the caller decides "best": higher item level,
// lower price…) is bold with a small "최고" mark — not colour alone.
// The strip is a named region and a tab stop only while it overflows, like
// DataTable, so a keyboard can scroll it.

/** `note`: what the row means, as the name's tooltip (e.g. what is averaged). */
type CompareRow = { id: string; label: string; note?: string }

type CompareCard = {
  id: string
  /** Portrait (official image URL) or anything round; optional. */
  image?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  /** Values by row id. */
  values: Record<string, React.ReactNode>
  /** Row ids where this card holds the best value. */
  best?: string[]
  /** Under the rows: a link to the character, a remove button… */
  footer?: React.ReactNode
}

type CompareCardsProps = {
  /** Names the strip for a screen reader, e.g. "캐릭터 비교". */
  label: string
  rows: CompareRow[]
  cards: CompareCard[]
  className?: string
}

function useOverflowX<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [overflowing, setOverflowing] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setOverflowing(el.scrollWidth > el.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, overflowing] as const
}

function CompareCards({ label, rows, cards, className }: CompareCardsProps) {
  const [ref, overflowing] = useOverflowX<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-slot="compare-cards"
      role="region"
      aria-label={label}
      tabIndex={overflowing ? 0 : undefined}
      className={cn(
        "flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
        className
      )}
    >
      {cards.map((card) => (
        <article
          key={card.id}
          aria-label={typeof card.title === "string" ? card.title : undefined}
          className="grid w-[15rem] shrink-0 snap-start content-start gap-3 rounded-(--radius-xl) bg-(--card) p-4"
        >
          <header className="flex min-w-0 items-center gap-3">
            {card.image && (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary">
                {card.image}
              </span>
            )}
            <span className="grid min-w-0">
              <strong className="truncate font-semibold">{card.title}</strong>
              {card.sub && <span className="truncate text-(length:--text-caption) text-muted-foreground">{card.sub}</span>}
            </span>
          </header>
          <dl className="grid">
            {rows.map((row) => {
              const best = card.best?.includes(row.id)
              return (
                <div
                  key={row.id}
                  data-best={best || undefined}
                  className="flex min-h-9 items-center justify-between gap-3 border-t border-border py-1.5"
                >
                  <dt className="truncate text-(length:--text-caption) text-muted-foreground" title={row.note}>{row.label}</dt>
                  <dd className={cn("flex shrink-0 items-center gap-1.5 tabular-nums whitespace-nowrap", best && "font-semibold")}>
                    {best && (
                      <span className="rounded-full bg-secondary px-1.5 text-[11px] leading-[18px] font-medium text-foreground">
                        최고
                      </span>
                    )}
                    {card.values[row.id] ?? <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              )
            })}
          </dl>
          {card.footer && <footer>{card.footer}</footer>}
        </article>
      ))}
    </div>
  )
}

export { CompareCards }
export type { CompareRow, CompareCard, CompareCardsProps }
