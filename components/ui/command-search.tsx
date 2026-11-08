"use client"

import * as React from "react"
import { cn } from "cn"
import { SearchNormal } from "@/components/ui/icons"

// Global character search: a header button, or Ctrl K / ⌘K, opens Bencho's
// command bar in a dialog. Only the button and the listener ship with every
// page; the dialog, the bar and the liquid library load on the first open
// (PM 총괄 condition for liquid-gooey: lazy, within the +30KB route budget),
// and start loading as soon as the pointer or focus reaches the button. A
// page that already has its own character field (the home hero,
// #character-search) keeps Ctrl K for it; the button still opens the dialog.
const load = () => import("@/components/ui/command-search-dialog")
const OPEN_EVENT = "loakraken:open-character-search"

/**
 * Opens the header's search from elsewhere on the page (the /about closing
 * button); on close, focus goes back to `from`.
 */
function openCharacterSearch(from?: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: from ?? null }))
}
const CommandSearchDialog = React.lazy(load)
const noop = () => () => {}

function CommandSearch({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  // Mounted on the first open and kept, so closing can animate out.
  const [wanted, setWanted] = React.useState(false)
  // Where focus goes back on close: the button when it opened the dialog, the
  // element that asked when another part of the page opened it, otherwise
  // whatever had focus (Base UI's default).
  const button = React.useRef<HTMLButtonElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const [returnTo, setReturnTo] = React.useState<"button" | "opener" | null>(null)
  // ⌘K on Apple keyboards; the server draws Ctrl K and the client corrects it.
  const mac = React.useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false
  )

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      if (document.getElementById("character-search")) return
      event.preventDefault()
      setReturnTo(null)
      setWanted(true)
      setOpen(true)
    }
    const onOpen = (event: Event) => {
      const from = (event as CustomEvent<HTMLElement | null>).detail
      opener.current = from
      setReturnTo(from ? "opener" : null)
      setWanted(true)
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  return (
    <>
      <button
        ref={button}
        type="button"
        data-slot="command-search-trigger"
        aria-label="캐릭터 검색"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onPointerEnter={() => void load()}
        onFocus={() => void load()}
        onClick={() => {
          setReturnTo("button")
          setWanted(true)
          setOpen(true)
        }}
        className={cn(
          "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-foreground",
          "transition-[background-color,transform,scale] duration-(--duration-fast) ease-(--ease-out)",
          "pointer-fine:hover:bg-hover-surface active:scale-(--press-scale)",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
          "[&_svg]:size-5",
          className
        )}
      >
        <SearchNormal aria-hidden />
        {/* The shortcut, for keyboards: hidden on touch, where it means nothing,
            and at 600px and below, where the header row has no room for it. */}
        <kbd
          aria-hidden="true"
          // The family only: the whole `font` shorthand also took the page's size
          // (17px on /about), and 'Ctrl K' broke onto two lines there (user 11-08).
          className="hidden whitespace-nowrap rounded-(--radius-xs) bg-muted px-1.5 py-0.5 [font-family:inherit] text-(length:--text-caption) leading-none text-muted-foreground pointer-fine:min-[601px]:inline"
        >
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      {wanted && (
        <React.Suspense fallback={null}>
          <CommandSearchDialog open={open} onOpenChange={setOpen} returnFocus={returnTo === "button" ? button : returnTo === "opener" ? opener : undefined} />
        </React.Suspense>
      )}
    </>
  )
}

export { CommandSearch, openCharacterSearch }
