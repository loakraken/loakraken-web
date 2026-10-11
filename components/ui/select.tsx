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

const load = () => import("@/components/ui/select-full")
// Typed as the generic component it is (React.lazy drops the type parameter).
const SelectFull = React.lazy(load) as unknown as <V extends string | number>(
  props: SelectProps<V>
) => React.ReactNode

function Select<V extends string | number>(props: SelectProps<V>) {
  const { id, value, items, size = "md", className, disabled } = props
  const [full, setFull] = React.useState<null | "rest" | "open">(null)
  const label = items.find((item) => item.value === value)?.label

  const light = (
    // A closed select-only combobox: its listbox does not exist until the full
    // select loads (on focus or hover), so there is nothing for aria-controls
    // to name yet; aria-expanded is false.
    <button
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
      onPointerEnter={() => void load()}
      // A press opens on click, once the whole press is over: swapping at
      // pointerdown (or on the focus it brings) would hand the rest of the
      // press to the full trigger, which reads the release as "close".
      onPointerDown={(event) => {
        if (event.button === 0) event.preventDefault()
      }}
      onFocus={() => {
        void load()
        setFull((was) => was ?? "rest")
      }}
      onClick={() => setFull("open")}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault()
          setFull("open")
        }
      }}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown size={16} aria-hidden className="shrink-0 text-faint" />
    </button>
  )

  if (!full) return light
  return (
    <React.Suspense fallback={light}>
      <Handover focus={full === "rest"}>
        <SelectFull {...props} defaultOpen={full === "open"} />
      </Handover>
    </React.Suspense>
  )
}

/** Keeps focus on the field across the swap: the light button had it, and
 * the full trigger (same id) takes it once mounted. */
function Handover({ children, focus }: { children: React.ReactNode; focus: boolean }) {
  const box = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
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
