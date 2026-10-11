"use client"

import { cn } from "cn"
import { Moon, Sun } from "@/components/ui/icons"
import { useSyncExternalStore } from "react"
import { IconButton, type IconButtonProps } from "@/components/ui/icon-button"

// Light is the default and the system setting is not followed (user decision
// D3); dark is a stored choice applied as data-theme="dark" on <html>.
const THEME_STORAGE_KEY = "loakraken-theme"

type Theme = "light" | "dark"

// Inline this in <head> before any paint so a stored dark choice never
// flashes light first: <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
const themeInitScript = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}})()`

const listeners = new Set<() => void>()

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

// Switching flips every colour token at once, but elements with a colour
// transition (buttons, links, chips) would then fade over 150–300ms, so for a
// moment light and dark mix — and rapid presses stack those fades (user,
// 10-11: "여러 번 누르면 가끔 이상"). For the frame of the switch, transitions
// are off everywhere (data-theme-switching, globals.css); the attribute comes
// off two frames later, and a newer press restarts that wait.
let settle = 0
function setThemeAttribute(theme: Theme) {
  const root = document.documentElement
  root.setAttribute("data-theme-switching", "")
  if (theme === "dark") root.dataset.theme = "dark"
  else delete root.dataset.theme
  cancelAnimationFrame(settle)
  settle = requestAnimationFrame(() => {
    settle = requestAnimationFrame(() => root.removeAttribute("data-theme-switching"))
  })
}

function applyTheme(theme: Theme) {
  setThemeAttribute(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
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
    setThemeAttribute(event.newValue === "dark" ? "dark" : "light")
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function useTheme() {
  // The server always renders light; the stored choice is read after hydration.
  return useSyncExternalStore(subscribe, readTheme, () => "light" as const)
}

type ThemeToggleProps = Omit<IconButtonProps, "aria-label" | "aria-pressed" | "onClick" | "children">

// A toggle button with a fixed name; aria-pressed tells whether dark is on.
function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const theme = useTheme()
  const dark = theme === "dark"
  return (
    <IconButton
      aria-label="다크 모드"
      aria-pressed={dark}
      // Read the page, not this render: the last press always wins, even if
      // presses land faster than React re-renders.
      onClick={() => applyTheme(readTheme() === "dark" ? "light" : "dark")}
      // Pressed means "dark is on", not a warm highlight like a favourite.
      className={cn("aria-pressed:text-foreground", className)}
      {...props}
    >
      {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </IconButton>
  )
}

export { ThemeToggle, THEME_STORAGE_KEY, themeInitScript, useTheme }
export type { Theme }
