"use client"

// The global search's results, shared by the header dialog and the character
// page's search box (#1113): the same rows, keys and messages in both places.
// With an empty field: a 최근 본 캐릭터 / 즐겨찾기 tab pair (#1119), popular
// characters and a few site features; once typed, "'이름' 캐릭터 정보 보기",
// name suggestions and matching menu entries. Loaded only with the dialog or
// the dropdown (never in a page's first JS).
import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { characterNameError, normalizeCharacterName, safeGameImage } from "@/lib/character/model"
import { fetchPopular, fetchSuggest } from "@/lib/character/client"
import { readSnapshot, recentSnapshot, subscribeRecent } from "@/lib/character/recent"
import {
  favoritesSnapshot,
  favoritesWritable,
  parseFavorites,
  subscribeFavorites,
  toggleStoredFavorite,
} from "@/lib/character/favorites"
import { menuMatches, splitPrefix, stepActive } from "@/lib/search/panel"
import type { NavFlags } from "@/components/site/nav-data"
import type { ResultGroup, ResultItem } from "@/components/ui/bencho/result-panel"
import { applyThemeChoice, THEME_CHOICES, useThemeChoice } from "@/components/ui/theme-toggle"
import { PillTab, PillTabs } from "@/components/ui/pill-tabs"
import { Bookmark, BookmarkBold, Copy, MessageQuestion, SearchNormal, Sun } from "@/components/ui/icons"

const number = (n: number | null | undefined) =>
  n == null ? null : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
const who = (className: string | null | undefined, itemLevel: number | null | undefined) =>
  [className, number(itemLevel)].filter(Boolean).join(" · ") || undefined
const initial = (name: string) => <span aria-hidden="true">{[...name][0]}</span>

/** The same flags as the header menu (/api/flags, cached for the session). */
function useNavFlags(enabled: boolean): NavFlags {
  const query = useQuery({
    queryKey: ["nav-flags"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/flags", { signal })
      if (!response.ok) throw new Error(String(response.status))
      return (await response.json()) as NavFlags
    },
    staleTime: Infinity,
    enabled,
  })
  return query.data ?? {}
}

/** What was typed, 150ms after the last key (suggestions ask the server). */
function useSettled(value: string, ms = 150) {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export type SearchTab = "recent" | "favorites"
const TAB_KEY = "loakraken:search-tab"
const readTab = (): SearchTab => {
  try {
    return localStorage.getItem(TAB_KEY) === "favorites" ? "favorites" : "recent"
  } catch {
    return "recent"
  }
}
const writeTab = (tab: SearchTab) => {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    /* Storage blocked: the tab is not remembered. */
  }
}

type Character = { name: string; server: string | null; className: string | null; itemLevel: number | null }
export type SearchRow = ResultItem & { run: () => void; character?: Character }

/** Name suggestions shown (the backend sends up to 8); their room is held. */
const SUGGEST_ROWS = 5
/** Rows held for the tab list, so switching tabs moves nothing under it. */
const TAB_ROWS = 5

export const SEARCH_HINT = "↑↓ 이동, Enter 열기, Shift+Enter 즐겨찾기, Esc 닫기"

export function useSearchResults({ open, text, onLeave }: { open: boolean; text: string; onLeave: () => void }) {
  const router = useRouter()
  const [active, setActive] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState("")
  const [status, setStatus] = React.useState("")
  // Client only: this hook runs in the dialog and the dropdown, both loaded
  // after a press or a focus, never in a server render.
  const [tab, setTabState] = React.useState<SearchTab>(readTab)
  const setTab = (next: SearchTab) => {
    setTabState(next)
    setActive(null)
    writeTab(next)
  }
  const query = text.trim()
  const settled = useSettled(query)
  const flags = useNavFlags(open)
  const recent = readSnapshot(React.useSyncExternalStore(subscribeRecent, recentSnapshot, () => "|[]")).list
  const favorites = parseFavorites(React.useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => "[]"))
  const starred = new Set(favorites)
  const [writable] = React.useState(favoritesWritable)
  const choice = useThemeChoice()
  const popular = useQuery({
    queryKey: ["popular", "24h"],
    queryFn: ({ signal }) => fetchPopular("24h", signal),
    enabled: open && !query,
    staleTime: 60_000,
    retry: false,
  })
  const suggest = useQuery({
    queryKey: ["suggest", settled],
    queryFn: ({ signal }) => fetchSuggest(settled, signal),
    enabled: open && !!settled && !characterNameError(normalizeCharacterName(settled)),
    staleTime: 60_000,
    retry: false,
  })

  const reset = () => {
    setActive(null)
    setCopied(false)
    setStatus("")
  }
  const goCharacter = (name: string) => {
    onLeave()
    reset()
    router.push(`/character/${encodeURIComponent(name)}`)
  }
  /** The typed name: opens it, or says what is wrong (false). */
  const submit = (raw: string) => {
    const name = normalizeCharacterName(raw)
    const issue = characterNameError(name)
    if (issue) {
      setError(issue)
      return false
    }
    setError("")
    goCharacter(name)
  }
  const toggle = (character: Character) => {
    const now = toggleStoredFavorite(character.name)
    setStatus(
      !writable
        ? "이 브라우저는 저장소를 쓸 수 없어 즐겨찾기를 저장하지 못해요."
        : // No particle after the name: 을/를 would depend on its last letter.
          now
          ? `‘${character.name}’ 즐겨찾기 추가`
          : `‘${character.name}’ 즐겨찾기 해제`
    )
  }

  /** A character row: the name, its favourite state read too (#1119 a), and a star for the mouse. */
  const characterRow = (id: string, c: Character, extra: Partial<SearchRow> = {}): SearchRow => {
    const isFav = starred.has(c.name)
    return {
      id,
      title: (
        <>
          {extra.title ?? c.name}
          {isFav && <span className="sr-only"> · 즐겨찾기됨</span>}
        </>
      ),
      sub: who(c.className, c.itemLevel),
      side: (
        <span className="inline-flex items-center gap-1">
          {extra.side}
          {/* Mouse and touch only (the row keeps the keyboard: Shift+Enter).
              A press here never picks or opens the row (#1119 b). */}
          <span
            aria-hidden="true"
            data-slot="row-star"
            data-on={isFav || undefined}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-transform duration-100 active:scale-90 motion-reduce:transition-none not-data-on:hover:text-foreground data-on:text-(--accent-warm)"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggle(c)
            }}
          >
            {isFav ? <BookmarkBold size={16} /> : <Bookmark size={16} />}
          </span>
        </span>
      ),
      avatar: extra.avatar ?? { fallback: initial(c.name) },
      run: () => goCharacter(c.name),
      character: c,
    }
  }

  const groups: (Omit<ResultGroup, "items"> & { items: SearchRow[] })[] = []
  if (!query) {
    // Favourites are names; what the recent list knows about them fills the row.
    const known = new Map(recent.map((c) => [c.name, c]))
    const list =
      tab === "recent"
        ? recent.slice(0, 10)
        : favorites.map((name) => known.get(name) ?? { name, server: null, className: null, itemLevel: null })
    groups.push({
      id: "tab",
      reserve: TAB_ROWS,
      note:
        tab === "recent"
          ? "아직 본 캐릭터가 없어요."
          : writable
            ? "캐릭터의 즐겨찾기 표시를 누르면 여기에 모아 둘 수 있어요."
            : "이 브라우저는 저장소를 쓸 수 없어 즐겨찾기를 저장하지 못해요.",
      items: list.map((c) => characterRow(`${tab}:${c.name}`, c, { side: c.server ?? undefined })),
    })
    // The user's order is recent → popular → features (PM-프론트 #593). The
    // popular rows are fetched, so the group holds five rows of room from the
    // first frame and the features under it never move when they land (A7).
    const hot = popular.data?.data.items ?? []
    groups.push({
      id: "popular",
      title: "실시간 인기 캐릭터",
      reserve: 5,
      note: popular.isPending ? undefined : "인기 검색을 모으는 중이에요.",
      items: hot.slice(0, 5).map((c) =>
        characterRow(
          `popular:${c.characterName}`,
          { name: c.characterName, server: c.serverName ?? null, className: c.className, itemLevel: c.itemLevel },
          { side: `${c.rank}위` }
        )
      ),
    })
    const next = THEME_CHOICES[(THEME_CHOICES.findIndex((t) => t.value === choice) + 1) % THEME_CHOICES.length]
    groups.push({
      id: "features",
      title: "기능",
      items: [
        {
          id: "feature:theme",
          title: "테마 바꾸기",
          sub: `지금 ${THEME_CHOICES.find((t) => t.value === choice)?.label} · 누르면 ${next.label}`,
          avatar: { fallback: <Sun size={16} aria-hidden /> },
          run: () => applyThemeChoice(next.value),
        },
        {
          id: "feature:contact",
          title: "문의하기",
          sub: "오류 제보·제안",
          avatar: { fallback: <MessageQuestion size={16} aria-hidden /> },
          run: () => {
            onLeave()
            reset()
            router.push("/contact")
          },
        },
        {
          id: "feature:copy",
          title: "지금 페이지 링크 복사",
          sub: copied ? "복사했어요" : undefined,
          avatar: { fallback: <Copy size={16} aria-hidden /> },
          run: () => {
            navigator.clipboard.writeText(window.location.href).then(
              () => setCopied(true),
              () => setError("링크를 복사하지 못했어요. 주소창에서 복사해 주세요.")
            )
          },
        },
      ],
    })
  } else {
    const name = normalizeCharacterName(query)
    // Character first, its suggestions in five held rows, the menu under it:
    // typing on (상 → 상세) or a late answer never moves a row (A7, #593).
    const names = (settled === query ? suggest.data?.data.items ?? [] : []).filter((c) => c.characterName !== name)
    // The row stays while anything is typed, also through Hangul composition
    // (상 → 상ㅅ → 상세: the middle step is not a valid name), so it never
    // leaves and comes back with its entrance (PM-프론트 #593 4차). Enter checks
    // the name and says what is wrong.
    groups.push({
      id: "character",
      title: "캐릭터",
      reserve: SUGGEST_ROWS + 1,
      items: [
        {
          id: "lookup",
          title: `‘${name}’ 캐릭터 정보 보기`,
          side: "Enter",
          avatar: { fallback: <SearchNormal size={16} aria-hidden /> },
          run: () => void submit(name),
        },
        ...names.slice(0, SUGGEST_ROWS).map((c) => {
          const { head, tail } = splitPrefix(c.characterName, query)
          return characterRow(
            `suggest:${c.characterName}`,
            { name: c.characterName, server: c.serverName ?? null, className: c.className, itemLevel: c.itemLevel },
            {
              title: (
                <>
                  {/* The name is already semibold: the typed part reads by colour and weight (impeccable). */}
                  {head && <b className="font-bold text-(--link)">{head}</b>}
                  {tail}
                </>
              ),
              side: c.serverName ?? undefined,
              avatar: { src: safeGameImage(c.characterImage), fallback: initial(c.characterName) },
            }
          )
        }),
      ],
    })
    const menus = menuMatches(query, flags)
    if (menus.length)
      groups.push({
        id: "menu",
        title: "메뉴",
        items: menus.map((m) => ({
          id: m.id,
          title: m.label,
          side: m.section,
          run: () => {
            onLeave()
            reset()
            router.push(m.href)
          },
        })),
      })
  }
  const rows = groups.flatMap((g) => g.items)
  const ids = rows.map((r) => r.id)
  // Typing points at "정보 보기" so Enter does what it always did.
  const current = active && ids.includes(active) ? active : query && ids.includes("lookup") ? "lookup" : null

  /** The field's keys: ↑↓ move, Enter opens the active row, Shift+Enter stars it. */
  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      setActive(stepActive(ids, current, event.key === "ArrowDown" ? 1 : -1))
    } else if (event.key === "Enter" && event.shiftKey) {
      const character = rows.find((r) => r.id === current)?.character
      if (character) {
        event.preventDefault()
        toggle(character)
      }
    } else if (event.key === "Enter" && current && current !== "lookup") {
      event.preventDefault()
      rows.find((r) => r.id === current)?.run()
    }
  }

  /** The count read once the typed text settles, or the last favourite change. */
  const announce =
    status ||
    (query && settled === query && !suggest.isFetching
      ? `결과 ${rows.length}개`
      : !query && popular.isSuccess && !popular.data.data.items.length
        ? "인기 검색을 모으는 중이에요."
        : "")

  return {
    groups,
    rows,
    current,
    setActive,
    onKey,
    submit,
    error,
    setError,
    announce,
    reset: () => {
      reset()
      setError("")
    },
    clearStatus: () => setStatus(""),
    tab,
    setTab,
    showTabs: !query,
  }
}

/**
 * 최근 본 캐릭터 / 즐겨찾기 (#1119): the site's own tabs (PillTabs: arrow keys,
 * one tab stop). The panel stays open and focus stays on the tab; Escape from
 * a tab closes the panel as from the field.
 */
export function SearchTabs({
  tab,
  onTab,
  onEscape,
  hidden = false,
}: {
  tab: SearchTab
  onTab: (tab: SearchTab) => void
  /** Escape from a tab closes the panel the same way as from the field (#1119 c). */
  onEscape?: () => void
  /** While a name is typed: out of sight and out of reach, but its room kept,
      so the first letter moves nothing in the panel (A7). */
  hidden?: boolean
}) {
  return (
    <div
      data-slot="search-tabs"
      className={hidden ? "invisible" : undefined}
      inert={hidden || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onEscape) {
          event.preventDefault()
          event.stopPropagation()
          onEscape()
        }
      }}
    >
      <PillTabs aria-label="검색 목록" value={tab} onValueChange={(value) => onTab(value as SearchTab)}>
        <PillTab value="recent">최근 본 캐릭터</PillTab>
        <PillTab value="favorites">즐겨찾기</PillTab>
      </PillTabs>
    </div>
  )
}