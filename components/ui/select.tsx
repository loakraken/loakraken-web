"use client"

import * as React from "react"
import { ChevronDown } from "@/components/ui/icons"
import { triggerClassName } from "@/components/ui/select-trigger"
import type { SelectProps } from "@/components/ui/select-full"

// A styled single-choice list (user 10-11 P1: the native <select> opened the
// OS's own list). The full part is Base UI Select (select-full.tsx): a
// labelable button (label htmlFor works), arrow keys, Home/End, typeahead,
// Esc, and a listbox a screen reader announces; the open list is our card,
// anchored on the chosen item (macOS-style) with a mouse.
//
// It is heavy for a closed field (Base UI's positioning, +30KB on routes that
// load nothing else of it), so a page first draws this light button — same
// classes, same name and value — and loads the full select when the pointer
// or focus reaches it. A press that lands before it has loaded opens it as
// soon as it arrives, with focus on the field.
//
// Same choice on phones: one look on every screen, and the list is fully
// touch-operable, so the platform picker would only bring back the look the
// user flagged.

// Typed as the generic component it is.
type Full = <V extends string | number>(props: SelectProps<V>) => React.ReactNode
// Once loaded, every select on the page swaps without waiting.
let loaded: Full | null = null
const load = () =>
  import("@/components/ui/select-full").then((module) => {
    loaded = module.SelectFull as Full
    return loaded
  })

function Select<V extends string | number>(props: SelectProps<V>) {
  const { id, value, items, size = "md", className, disabled } = props
  // What the user asked of the field: focus only ("rest") or a press ("open").
  const [full, setFull] = React.useState<null | "rest" | "open">(null)
  // The full select, set only once its code is here. Until then the light
  // button stays mounted and keeps focus (QA 2026-11-13 10시: swapping at
  // focus to a Suspense fallback put focus on <body> while the code loaded,
  // so the first key was lost and a quick Tab landed on the field again).
  // A key pressed meanwhile still reaches the light button and asks "open",
  // which the full select reads when it mounts.
  const [Loaded, setLoaded] = React.useState<{ Full: Full } | null>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  // Set just before the swap: the light button's blur as React removes it is
  // not the user leaving.
  const swapping = React.useRef(false)
  const want = (mode: "rest" | "open") => {
    setFull((was) => (mode === "open" ? "open" : (was ?? "rest")))
    const swap = (Full: Full) => {
      swapping.current = true
      setLoaded({ Full })
    }
    if (loaded) swap(loaded)
    else load().then(swap, () => {})
  }
  // The user left the field while its code was loading (Tab, a click or focus
  // elsewhere): forget the request, so it never opens or takes focus later
  // (codex #1576 P2). Escape keeps the field but drops a pending open.
  const leave = () => {
    if (!swapping.current) setFull(null)
  }
  const pending = full !== null && !Loaded
  React.useEffect(() => {
    if (!pending) return
    const away = (event: Event) => {
      if (!button.current?.contains(event.target as Node)) leave()
    }
    document.addEventListener("focusin", away, true)
    document.addEventListener("pointerdown", away, true)
    return () => {
      document.removeEventListener("focusin", away, true)
      document.removeEventListener("pointerdown", away, true)
    }
  }, [pending])
  const label = items.find((item) => item.value === value)?.label

  const light = (
    // A closed select-only combobox: its listbox does not exist until the full
    // select loads (on focus or hover), so there is nothing for aria-controls
    // to name yet; aria-expanded is false.
    <button
      ref={button}
      type="button"
      id={id}
      data-slot="select"
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="combobox"
      aria-expanded={false}
      aria-haspopup="listbox"
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={props["aria-describedby"]}
      disabled={disabled}
      className={triggerClassName(size, className)}
      onPointerEnter={() => void load().catch(() => {})}
      // A press opens on click, once the whole press is over: swapping at
      // pointerdown (or on the focus it brings) would hand the rest of the
      // press to the full trigger, which reads the release as "close".
      onPointerDown={(event) => {
        if (event.button === 0) event.preventDefault()
      }}
      onFocus={() => want("rest")}
      onBlur={leave}
      onClick={() => want("open")}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault()
          want("open")
        } else if (event.key === "Escape") {
          setFull((was) => (was === "open" ? "rest" : was))
        }
      }}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown size={16} aria-hidden className="shrink-0 text-faint" />
    </button>
  )

  if (!full || !Loaded) return light
  return (
    <Handover focus={full === "rest"}>
      <Loaded.Full {...props} defaultOpen={full === "open"} />
    </Handover>
  )
}

/** Keeps focus on the field across the swap: the light button had it, and
 * the full trigger (same id) takes it in the same commit, before any key or
 * paint can come between (a layout effect, not a passive one). */
function Handover({ children, focus }: { children: React.ReactNode; focus: boolean }) {
  const box = React.useRef<HTMLSpanElement>(null)
  React.useLayoutEffect(() => {
    if (!focus) return
    const trigger = box.current?.querySelector<HTMLElement>("[data-slot=select]")
    if (trigger && document.activeElement !== trigger && box.current?.contains(document.activeElement) === false) {
      // focus only if the user was on this field (the light button is gone now)
      if (document.activeElement === document.body) trigger.focus()
    }
  }, [focus])
  return (
    <span ref={box} className="contents">
      {children}
    </span>
  )
}

export { Select }
export type { SelectProps }
export type { SelectOption } from "@/components/ui/select-full"
