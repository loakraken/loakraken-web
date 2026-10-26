"use client"

// The result panel under the character page's search box (#1113): the same
// rows, keys and messages as the header search (useSearchResults). Loaded on
// the box's first focus, so the character page's first JS does not grow.
import * as React from "react"
import { ResultPanel, optionId } from "@/components/ui/bencho/result-panel"
import { SEARCH_HINT, SearchTabs, useSearchResults } from "@/components/ui/search-results"

export default function SearchDropdown({
  open,
  text,
  panelId,
  onLeave,
  onEscape,
  bindKeys,
  onActiveId,
}: {
  open: boolean
  text: string
  panelId: string
  /** A row opened something (the panel closes and the box empties). */
  onLeave: () => void
  /** Escape from a tab: close as from the field, focus back to the field. */
  onEscape: () => void
  /** The field forwards its keys here (↑↓, Enter on a row, Shift+Enter). */
  bindKeys: (handler: ((event: React.KeyboardEvent<HTMLInputElement>) => void) | null) => void
  /** The active option's element id, for the field's aria-activedescendant. */
  onActiveId: (id: string | undefined) => void
}) {
  const results = useSearchResults({ open, text, onLeave })
  const { groups, rows, current } = results
  React.useEffect(() => {
    bindKeys(results.onKey)
    return () => bindKeys(null)
  })
  React.useEffect(() => {
    onActiveId(open && current ? optionId(panelId, current) : undefined)
  }, [open, current, panelId, onActiveId])
  return (
    <>
      <ResultPanel
        open={open && groups.length > 0}
        id={panelId}
        label="검색 결과"
        groups={groups}
        activeId={current}
        onActive={results.setActive}
        onPick={(item) => rows.find((r) => r.id === item.id)?.run()}
        header={
          <div className="grid gap-1.5">
            {results.showTabs && <SearchTabs tab={results.tab} onTab={results.setTab} onEscape={onEscape} />}
            <span>{SEARCH_HINT}</span>
          </div>
        }
        className="left-0! right-auto! w-[min(400px,calc(100vw-32px))]!"
      />
      {results.error && (
        <p role="alert" className="sr-only">
          {results.error}
        </p>
      )}
      <p role="status" className="sr-only">
        {open ? results.announce : ""}
      </p>
    </>
  )
}
