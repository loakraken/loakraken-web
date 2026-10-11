"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { cn } from "cn"
import { characterNameError, normalizeCharacterName } from "@/lib/character/model"

// The dialog half of the global search (command-search.tsx loads this file
// on the first Ctrl K). Bencho's command bar, and the liquid library it
// draws with, load with it.
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
  const router = useRouter()
  const [error, setError] = React.useState("")
  const setOpen = onOpenChange

  const submit = (text: string) => {
    const name = normalizeCharacterName(text)
    const issue = characterNameError(name)
    if (issue) {
      setError(issue)
      return false
    }
    setError("")
    setOpen(false)
    router.push(`/character/${encodeURIComponent(name)}`)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError("")
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
            "fixed top-[18vh] left-1/2 z-50 grid w-[min(360px,calc(100vw-32px))] -translate-x-1/2 justify-items-center gap-2",
            "transition-[opacity,scale] duration-(--duration-base) ease-(--ease-out)",
            "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
            "outline-none"
          )}
        >
          <Dialog.Title className="sr-only">캐릭터 검색</Dialog.Title>
          {/* The bar is 320 wide and 56 tall; the box holds that space so
              nothing moves when the lazy chunk lands. */}
          <div className="grid h-14 w-80 max-w-full place-items-center">
            <React.Suspense fallback={<span className="text-(length:--text-caption) text-muted-foreground">불러오는 중</span>}>
              <CommandBar autoFocus onSubmit={submit} />
            </React.Suspense>
          </div>
          <p role="alert" className="min-h-5 text-(length:--text-caption) text-destructive">
            {error}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CommandSearchDialog
