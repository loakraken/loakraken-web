"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "cn"
import { ResultPanel, optionId } from "@/components/ui/bencho/result-panel"
import { CommandField } from "@/components/ui/command-field"
import { SEARCH_HINT, SearchTabs, useSearchResults } from "@/components/ui/search-results"

// The dialog half of the global search (command-search.tsx loads this file
// on the first Ctrl K). The field opens as a plain pill (command-field.tsx);
// the liquid surface Bencho's bar draws with comes in its own chunk once the
// dialog has opened and the page is idle, or after the first key, never in
// the click or key itself (PM 총괄 11-08, option b). Under the bar opens the
// result panel (PM 총괄
// 10-12 01:07·01:11); its rows, keys and messages come from
// useSearchResults, shared with the character page's search box (#1113).
// The field keeps focus as a combobox; ↑↓ move, Enter opens, Shift+Enter
// toggles a character's favourite (including the typed name on the lookup
// row), Esc closes (the dialog's own).
const LiquidPill = React.lazy(() =>
  import("@/components/ui/bencho/liquid-pill").then((m) => ({ default: m.LiquidPill }))
)

/** Runs `run` when the page is idle (or after `timeout` ms at the latest). */
function whenIdle(run: () => void, timeout: number) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 50)
  return () => window.clearTimeout(id)
}


function CommandSearchDialog({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close (the header button when it opened the dialog). */
  returnFocus?: React.RefObject<HTMLElement | null>
}) {
  const panelId = React.useId()
  const errorId = React.useId()
  const [text, setText] = React.useState("")
  // The liquid surface: wanted (opened and idle, or typed in), then drawn.
  const [liquid, setLiquid] = React.useState(false)
  const [drawn, setDrawn] = React.useState(false)
  const [wanted, setWanted] = React.useState(false)
  const setOpen = onOpenChange
  // Each open starts plain: the liquid mounts again only when idle.
  const plain = () => {
    setLiquid(false)
    setDrawn(false)
    setWanted(false)
  }
  // While open, the page may hide what would show through the 30% backdrop
  // around the bar and panel: the home hero's large heading and its own search
  // box read as a second search under this one on phones (user 11-12).
  React.useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.setAttribute("data-search-open", "")
    return () => root.removeAttribute("data-search-open")
  }, [open])
  const close = () => {
    setOpen(false)
    setText("")
    plain()
  }
  React.useEffect(() => {
    if (!open || !wanted || liquid) return
    return whenIdle(() => setLiquid(true), 600)
  }, [open, wanted, liquid])
  const onDrawn = React.useCallback(() => setDrawn(true), [])
  const results = useSearchResults({ open, text, onLeave: close })
  const { groups, rows, current } = results

  return (
    <Dialog.Root
      open={open}
      // The open animation is done: the liquid may come at the next idle.
      // Closed some other way: the next open starts plain too.
      onOpenChangeComplete={(next) => (next ? setWanted(true) : plain())}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else {
          close()
          results.reset()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-(--duration-base) ease-(--ease-out)",
            "data-starting-style:opacity-0 data-ending-style:opacity-0"
          )}
        />
        <Dialog.Popup
          data-slot="command-search"
          finalFocus={returnFocus ?? true}
          className={cn(
            // Wider than the old 360 (#1113), and never past a 320 screen.
            "fixed top-[18vh] left-1/2 z-50 grid w-[min(400px,calc(100vw-32px))] -translate-x-1/2 justify-items-center gap-2",
            "transition-[opacity,scale] duration-(--duration-base) ease-(--ease-out)",
            "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
            "outline-none"
          )}
        >
          <Dialog.Title className="sr-only">캐릭터 검색</Dialog.Title>
          {/* The bar is the box's full width and 56 tall: the plain field from
              the first frame, the liquid surface under it later, both in the
              same box, so nothing moves. With no send button (#1113) the
              panel hangs straight under the whole bar. */}
          <div className="relative grid h-14 w-full place-items-center">
            {liquid && (
              <React.Suspense fallback={null}>
                <LiquidPill onShown={onDrawn} />
              </React.Suspense>
            )}
            <CommandField
              liquid={drawn}
              autoFocus
              placeholder="캐릭터 · 메뉴 · 기능 검색…"
              onSubmit={results.submit}
              onValueChange={(value) => {
                // The first key also asks for the liquid (at the next idle, not now).
                // A clear (Enter runs the search, then empties the field) does not:
                // it comes as the dialog closes and would let the liquid mount
                // during the next open's transition (#1423 click-path review).
                if (value) setWanted(true)
                setText(value)
                results.setActive(null)
                results.clearStatus()
                if (results.error) results.setError("")
              }}
              onInputKeyDown={results.onKey}
              inputProps={{
                role: "combobox",
                name: "q",
                autoComplete: "off",
                spellCheck: false,
                // The list, not the dialog: shown only when there are rows (frontend-a11y).
                "aria-expanded": open && groups.length > 0,
                "aria-invalid": results.error ? true : undefined,
                // The keys line too (Shift+Enter is only told there).
                "aria-describedby": results.error ? `${errorId} ${panelId}-hint` : `${panelId}-hint`,
                "aria-controls": panelId,
                "aria-autocomplete": "list",
                "aria-activedescendant": current ? optionId(panelId, current) : undefined,
              }}
            />
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
                  <SearchTabs tab={results.tab} onTab={results.setTab} onEscape={close} hidden={!results.showTabs} />
                  <span id={`${panelId}-hint`}>{SEARCH_HINT}</span>
                </div>
              }
              // result-panel.css is unlayered (left 0, right 0, origin 0 0), so
              // the utilities need !important to win.
              className="left-0! right-0! origin-[50%_0]!"
            />
          </div>
          <p id={errorId} role="alert" className="min-h-5 text-(length:--text-caption) text-destructive">
            {results.error}
          </p>
          {/* How many rows the typed text found, or the last favourite change (polite). */}
          <p role="status" className="sr-only">
            {results.announce}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CommandSearchDialog
