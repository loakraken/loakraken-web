"use client"

import { useThemeChoice } from "@/components/ui/theme-toggle"

/**
 * Puts the theme back on <html> after hydration on every page, header or not.
 * A page that answers 404 after reading its request (a hidden tool, a note
 * that is not there) redraws <html> without the attributes the pre-paint
 * script set, and the 404 has no header toggle to restore them, so it showed
 * white under dim and dark (QA v0.3.1 최종 P1, A5). Subscribing to the choice
 * does the same restore the header toggle does; it draws nothing.
 */
export function ThemeKeeper() {
  useThemeChoice()
  return null
}
