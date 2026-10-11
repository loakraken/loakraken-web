"use client"

import { cn } from "cn"
import { CloudSunny, Monitor, Moon, Sun } from "@/components/ui/icons"
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { IconButton, type IconButtonProps } from "@/components/ui/icon-button"

// Four choices (PM, 10-11): light, dim, dark, or follow the system. Light is
// still the default when nothing is stored (user decision D3); "system" is
// only followed when chosen. The applied theme is data-theme on <html>:
// none = light, "dim" or "dark".
const THEME_STORAGE_KEY = "loakraken-theme"

type ThemeChoice = "light" | "dim" | "dark" | "system"
type AppliedTheme = "light" | "dim" | "dark"
/** Light or dark appearance (dim counts as dark), for colours set in script. */
type Theme = "light" | "dark"

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dim", label: "딤" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
]

const DARK_QUERY = "(prefers-color-scheme: dark)"

// Inline this in <head> before any paint so a stored choice never flashes
// light first: <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
// It also keeps "system" in step with the OS on pages without the header.
// Old stored values ("light"/"dark") read the same as before. The choice
// itself goes on <html> as data-theme-choice, so the header button shows the
// chosen mode's icon from the first paint (CSS below), before hydration.
const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}",d=document.documentElement,m=matchMedia("${DARK_QUERY}");function a(){var s=localStorage.getItem(k),t=s==="system"?(m.matches?"dark":"light"):s;if(t==="dark"||t==="dim")d.dataset.theme=t;else delete d.dataset.theme;d.dataset.themeChoice=s==="dim"||s==="dark"||s==="system"?s:"light"}a();m.addEventListener("change",function(){try{if(localStorage.getItem(k)==="system")a()}catch(e){}})}catch(e){}})()`

const listeners = new Set<() => void>()

function toChoice(value: string | null): ThemeChoice {
  return value === "dim" || value === "dark" || value === "system" ? value : "light"
}

function storedChoice(): ThemeChoice {
  try {
    return toChoice(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return "light"
  }
}

// The current choice, kept here so a blocked storage still answers this page.
let choice: ThemeChoice | null = null
function readChoice(): ThemeChoice {
  return (choice ??= storedChoice())
}

function readTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return applied === "dark" || applied === "dim" ? "dark" : "light"
}

function resolve(value: ThemeChoice): AppliedTheme {
  if (value !== "system") return value
  return matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

// Switching flips every colour token at once, but elements with a colour
// transition (buttons, links, chips) would then fade over 150–300ms, so for a
// moment two themes mix — and rapid presses stack those fades (user, 10-11:
// "여러 번 누르면 가끔 이상"). For the frame of the switch, transitions are
// off everywhere (data-theme-switching, globals.css); the attribute comes off
// two frames later, and a newer press restarts that wait.
let settle = 0
function setThemeAttribute(theme: AppliedTheme) {
  const root = document.documentElement
  if ((root.dataset.theme ?? "light") === theme) return
  root.setAttribute("data-theme-switching", "")
  if (theme === "light") delete root.dataset.theme
  else root.dataset.theme = theme
  cancelAnimationFrame(settle)
  settle = requestAnimationFrame(() => {
    settle = requestAnimationFrame(() => root.removeAttribute("data-theme-switching"))
  })
}

function applyChoice(value: ThemeChoice) {
  choice = value
  document.documentElement.dataset.themeChoice = value
  setThemeAttribute(resolve(value))
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keep other open tabs in step with a choice made here.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    choice = toChoice(event.newValue)
    document.documentElement.dataset.themeChoice = choice
    setThemeAttribute(resolve(choice))
    listener()
  }
  // "system": the OS switching light/dark (the inline script has already
  // changed the page; this re-reads it).
  const media = matchMedia(DARK_QUERY)
  const onMedia = () => {
    if (readChoice() === "system") setThemeAttribute(resolve("system"))
    listener()
  }
  window.addEventListener("storage", onStorage)
  media.addEventListener("change", onMedia)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
    media.removeEventListener("change", onMedia)
  }
}

/** Light or dark appearance; the server always renders light. */
function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => "light" as const)
}

/** The stored choice of the four; the server always renders light. */
function useThemeChoice() {
  return useSyncExternalStore(subscribe, readChoice, () => "light" as const)
}

// Each mode's Iconsax icon (Linear): sun, a cloud over the sun for dim, moon,
// and a screen for "system".
const ICON = { light: Sun, dim: CloudSunny, dark: Moon, system: Monitor } satisfies Record<ThemeChoice, unknown>

// The header icon follows data-theme-choice on <html> (set before paint), so
// all four are in the button and CSS shows one: no icon swap after hydration.
const SHOWN_WHEN: Record<ThemeChoice, string> = {
  light: "[:root[data-theme-choice]:not([data-theme-choice=light])_&]:hidden",
  dim: "hidden [:root[data-theme-choice=dim]_&]:block",
  dark: "hidden [:root[data-theme-choice=dark]_&]:block",
  system: "hidden [:root[data-theme-choice=system]_&]:block",
}

// Each option previews its page colour (a small dot after the name); system is half light, half dark.
const SWATCH: Record<ThemeChoice, string> = {
  light: "bg-white",
  dim: "bg-[#22252b]",
  dark: "bg-[#0f1114]",
  system: "bg-[linear-gradient(135deg,#fff_50%,#0f1114_50%)]",
}

type ThemeToggleProps = Omit<IconButtonProps, "aria-label" | "aria-pressed" | "onClick" | "children">

// One 44px header button (PM, 10-11: the header must not grow at 360·390);
// pressing it opens a small panel with the four choices as a radio group.
// Arrow keys move and apply at once, as radios do; a click applies and
// closes; Esc or a press outside closes and focus returns to the button.
function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const current = useThemeChoice()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const group = useRef<HTMLDivElement>(null)
  const panelId = useId()

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    // Focus the checked option when the panel opens.
    group.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    return () => document.removeEventListener("pointerdown", onPointer)
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      close(true)
      return
    }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    const index = CHOICES.findIndex((c) => c.value === readChoice())
    const next =
      step !== undefined
        ? (index + step + CHOICES.length) % CHOICES.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? CHOICES.length - 1
            : -1
    if (next < 0) return
    event.preventDefault()
    applyChoice(CHOICES[next].value)
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      ref={wrap}
      // The header places this box (className), the button fills it.
      className={cn("relative", className)}
      // Tabbing out of the panel closes it.
      onBlur={(event) => {
        if (open && !wrap.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <IconButton
        ref={trigger}
        aria-label="화면 테마"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        {...props}
      >
        {CHOICES.map(({ value }) => {
          const Icon = ICON[value]
          return <Icon key={value} aria-hidden className={SHOWN_WHEN[value]} />
        })}
      </IconButton>
      {open && (
        <div
          id={panelId}
          ref={group}
          role="radiogroup"
          aria-label="화면 테마"
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-[calc(100%+8px)] right-0 z-50 grid w-44 gap-0.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-(--shadow-pop)",
            "origin-top-right transition-[opacity,scale] duration-(--duration-fast) ease-(--ease-out) starting:scale-95 starting:opacity-0"
          )}
        >
          {CHOICES.map(({ value, label }) => {
            const checked = current === value
            const Icon = ICON[value]
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => {
                  applyChoice(value)
                  close(true)
                }}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-2.5 text-left text-[15px]",
                  "transition-colors duration-(--duration-fast) pointer-fine:hover:bg-muted",
                  "aria-checked:font-semibold"
                )}
              >
                <Icon size={20} aria-hidden className="shrink-0" />
                <span className="flex-1">{label}</span>
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(128_128_128/45%)]", SWATCH[value])}
                />
                {/* the check: a ring that fills, not colour alone */}
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 place-items-center rounded-full border-[1.5px]",
                    checked ? "border-foreground bg-foreground" : "border-input"
                  )}
                >
                  {checked && <span className="size-1.5 rounded-full bg-background" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { ThemeToggle, THEME_STORAGE_KEY, themeInitScript, useTheme, useThemeChoice }
export type { Theme, ThemeChoice }
