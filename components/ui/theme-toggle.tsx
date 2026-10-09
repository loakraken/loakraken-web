"use client"

import { cn } from "cn"
import { Moon, Sun } from "lucide-react"
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

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.dataset.theme = "dark"
  else delete root.dataset.theme
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
    const root = document.documentElement
    if (event.newValue === "dark") root.dataset.theme = "dark"
    else delete root.dataset.theme
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
      onClick={() => applyTheme(dark ? "light" : "dark")}
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
