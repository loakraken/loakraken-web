"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "cn"
import { ResultPanel, optionId } from "@/components/ui/bencho/result-panel"
import { SEARCH_HINT, SearchTabs, useSearchResults } from "@/components/ui/search-results"

// The dialog half of the global search (command-search.tsx loads this file
// on the first Ctrl K). Bencho's command bar, and the liquid library it
// draws with, load with it. Under the bar opens the result panel (PM 총괄
// 10-12 01:07·01:11); its rows, keys and messages come from
// useSearchResults, shared with the character page's search box (#1113).
// The field keeps focus as a combobox; ↑↓ move, Enter opens, Shift+Enter
// stars a character, Esc closes (the dialog's own).
const CommandBar = React.lazy(() =>
  import("@/components/ui/bencho/command-bar").then((m) => ({ default: m.CommandBar }))
)

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
  const setOpen = onOpenChange
  const close = () => {
    setOpen(false)
    setText("")
  }
  const results = useSearchResults({ open, text, onLeave: close })
  const { groups, rows, current } = results

  return (
    <Dialog.Root
      open={open}
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
          {/* The bar is the box's full width and 56 tall; the box holds that
              space so nothing moves when the lazy chunk lands. With no send
              button (#1113) the panel hangs straight under the whole bar. */}
          <div className="relative grid h-14 w-full place-items-center">
            <React.Suspense fallback={<span className="text-(length:--text-caption) text-muted-foreground">불러오는 중…</span>}>
              <CommandBar
                autoFocus
                placeholder="캐릭터 · 메뉴 · 기능 검색…"
                onSubmit={results.submit}
                onValueChange={(value) => {
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
                  "aria-describedby": results.error ? errorId : undefined,
                  "aria-controls": panelId,
                  "aria-autocomplete": "list",
                  "aria-activedescendant": current ? optionId(panelId, current) : undefined,
                }}
              />
            </React.Suspense>
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
                  <span>{SEARCH_HINT}</span>
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
