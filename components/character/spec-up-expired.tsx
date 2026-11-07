"use client";
// The backend keeps its copy of a character for a while only. On the open
// spec-up tab a request may then answer CHARACTER_NOT_CACHED although the page
// still shows the character (user 11-08). One such answer marks everything on
// the tab as old: the list and 추천 순서 dim and the guide's held line says so,
// with the 갱신 button above as the way back. Nothing is asked again by itself
// (official call budget, PM 총괄 11-08).
import { createContext, useContext, useEffect } from "react";
import { SpecUpQueryError } from "@/lib/spec-up/client";

export const SpecUpExpired = createContext<{ expired: boolean; markExpired: () => void }>({
  expired: false,
  markExpired: () => {},
});

/** Marks the tab old when this request's error is CHARACTER_NOT_CACHED. */
export function useMarkExpired(error: unknown) {
  const { markExpired } = useContext(SpecUpExpired);
  const gone = error instanceof SpecUpQueryError && error.info.code === "CHARACTER_NOT_CACHED";
  useEffect(() => {
    if (gone) markExpired();
  }, [gone, markExpired]);
}

// One line in the guide's 18px held line, at 320 too (A37).
export const EXPIRED_LINE = "오래된 정보예요 · 갱신을 누르면 다시 불러와요";
