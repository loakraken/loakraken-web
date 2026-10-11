"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { characterNameError, normalizeCharacterName, safeGameImage } from "@/lib/character/model"
import { fetchPopular, fetchSuggest } from "@/lib/character/client"
import { readSnapshot, recentSnapshot, subscribeRecent } from "@/lib/character/recent"
import { menuMatches, splitPrefix, stepActive } from "@/lib/search/panel"
import type { NavFlags } from "@/components/site/nav-data"
import { ResultPanel, optionId, type ResultGroup, type ResultItem } from "@/components/ui/bencho/result-panel"
import { applyThemeChoice, THEME_CHOICES, useThemeChoice } from "@/components/ui/theme-toggle"
import { Copy, MessageQuestion, SearchNormal, Sun } from "@/components/ui/icons"

// The dialog half of the global search (command-search.tsx loads this file
// on the first Ctrl K). Bencho's command bar, and the liquid library it
// draws with, load with it. Under the pill opens the result panel (PM 총괄
// 10-12 01:07·01:11): with an empty field, recent and popular characters and
// a few site features; once typed, matching menu entries, "'이름' 캐릭터 정보
// 보기" and name suggestions. The field keeps focus as a combobox; ↑↓ move,
// Enter opens, Esc closes (the dialog's own).
const CommandBar = React.lazy(() =>
  import("@/components/ui/bencho/command-bar").then((m) => ({ default: m.CommandBar }))
)

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

type Row = ResultItem & { run: () => void }

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
  const panelId = React.useId()
  const errorId = React.useId()
  const [error, setError] = React.useState("")
  const [text, setText] = React.useState("")
  const [active, setActive] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const setOpen = onOpenChange
  const query = text.trim()
  const settled = useSettled(query)
  const flags = useNavFlags(open)
  const recent = readSnapshot(React.useSyncExternalStore(subscribeRecent, recentSnapshot, () => "|[]")).list
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

  const close = () => {
    setOpen(false)
    setText("")
    setActive(null)
    setCopied(false)
  }
  const goCharacter = (name: string) => {
    close()
    router.push(`/character/${encodeURIComponent(name)}`)
  }
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

  const groups: (Omit<ResultGroup, "items"> & { items: Row[] })[] = []
  if (!query) {
    if (recent.length)
      groups.push({
        id: "recent",
        title: "최근 본 캐릭터",
        items: recent.slice(0, 5).map((c) => ({
          id: `recent:${c.name}`,
          title: c.name,
          sub: who(c.className, c.itemLevel),
          side: c.server ?? undefined,
          avatar: { fallback: initial(c.name) },
          run: () => goCharacter(c.name),
        })),
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
            close()
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
    // Fetched rows last: arriving late they grow the card downwards and move
    // nothing already shown (A7, PM-프론트 #593 P1).
    const hot = popular.data?.data.items ?? []
    if (hot.length)
      groups.push({
        id: "popular",
        title: "실시간 인기 캐릭터",
        items: hot.slice(0, 5).map((c) => ({
          id: `popular:${c.characterName}`,
          title: c.characterName,
          sub: who(c.className, c.itemLevel),
          side: `${c.rank}위`,
          avatar: { fallback: initial(c.characterName) },
          run: () => goCharacter(c.characterName),
        })),
      })
  } else {
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
            close()
            router.push(m.href)
          },
        })),
      })
    const name = normalizeCharacterName(query)
    // Suggestions come last (after the menu and "정보 보기") for the same reason.
    const names = (settled === query ? suggest.data?.data.items ?? [] : []).filter((c) => c.characterName !== name)
    groups.push({
      id: "character",
      title: "캐릭터",
      items: [
        ...(characterNameError(name)
          ? []
          : [
              {
                id: "lookup",
                title: `‘${name}’ 캐릭터 정보 보기`,
                side: "Enter",
                avatar: { fallback: <SearchNormal size={16} aria-hidden /> },
                run: () => void submit(name),
              },
            ]),
        ...names.map((c) => {
          const { head, tail } = splitPrefix(c.characterName, query)
          return {
            id: `suggest:${c.characterName}`,
            title: (
              <>
                {/* The name is already semibold: the typed part reads by colour and weight (impeccable). */}
                {head && <b className="font-bold text-(--link)">{head}</b>}
                {tail}
              </>
            ),
            sub: who(c.className, c.itemLevel),
            side: c.serverName ?? undefined,
            avatar: { src: safeGameImage(c.characterImage), fallback: initial(c.characterName) },
            run: () => goCharacter(c.characterName),
          }
        }),
      ],
    })
  }
  const rows = groups.flatMap((g) => g.items)
  const ids = rows.map((r) => r.id)
  // Typing points at "정보 보기" so Enter does what it always did.
  const current = active && ids.includes(active) ? active : query && ids.includes("lookup") ? "lookup" : null

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      setActive(stepActive(ids, current, event.key === "ArrowDown" ? 1 : -1))
    } else if (event.key === "Enter" && current && current !== "lookup") {
      event.preventDefault()
      rows.find((r) => r.id === current)?.run()
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
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
              nothing moves when the lazy chunk lands. The panel hangs under
              it at the same width. */}
          <div className="relative grid h-14 w-80 max-w-full place-items-center">
            <React.Suspense fallback={<span className="text-(length:--text-caption) text-muted-foreground">불러오는 중…</span>}>
              <CommandBar
                autoFocus
                placeholder="캐릭터 · 메뉴 · 기능 검색…"
                onSubmit={submit}
                onValueChange={(value) => {
                  setText(value)
                  setActive(null)
                  setCopied(false)
                  if (error) setError("")
                }}
                onInputKeyDown={onKey}
                inputProps={{
                  role: "combobox",
                  name: "q",
                  autoComplete: "off",
                  spellCheck: false,
                  // The list, not the dialog: shown only when there are rows (frontend-a11y).
                  "aria-expanded": open && rows.length > 0,
                  "aria-invalid": error ? true : undefined,
                  "aria-describedby": error ? errorId : undefined,
                  "aria-controls": panelId,
                  "aria-autocomplete": "list",
                  "aria-activedescendant": current ? optionId(panelId, current) : undefined,
                }}
              />
            </React.Suspense>
            <ResultPanel
              open={open && (rows.length > 0 || !!query)}
              id={panelId}
              label="검색 결과"
              groups={groups}
              activeId={current}
              onActive={setActive}
              onPick={(item) => rows.find((r) => r.id === item.id)?.run()}
              header="↑↓ 이동, Enter 열기, Esc 닫기"
              footer={
                query && !rows.length
                  ? "맞는 메뉴가 없어요. 캐릭터 이름은 한글·영문·숫자로 입력해 주세요."
                  : undefined
              }
            />
          </div>
          <p id={errorId} role="alert" className="min-h-5 text-(length:--text-caption) text-destructive">
            {error}
          </p>
          {/* How many rows the typed text found, read once it settles. */}
          <p role="status" className="sr-only">
            {query && settled === query && !suggest.isFetching ? `결과 ${rows.length}개` : ""}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CommandSearchDialog
