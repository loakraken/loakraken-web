"use client"

import * as React from "react"

// Global character search on Ctrl K / ⌘K: Bencho's command bar in a dialog.
// Only this listener ships with every page. The dialog, the bar and the
// liquid library load on the first open (PM 총괄 condition for liquid-gooey:
// lazy, within the +30KB route budget). A page that already has its own
// character field (the home hero, #character-search) keeps Ctrl K for it.
const CommandSearchDialog = React.lazy(() => import("@/components/ui/command-search-dialog"))

function CommandSearch() {
  const [open, setOpen] = React.useState(false)
  // Mounted on the first open and kept, so closing can animate out.
  const [wanted, setWanted] = React.useState(false)

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      if (document.getElementById("character-search")) return
      event.preventDefault()
      setWanted(true)
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!wanted) return null
  return (
    <React.Suspense fallback={null}>
      <CommandSearchDialog open={open} onOpenChange={setOpen} />
    </React.Suspense>
  )
}

export { CommandSearch }
