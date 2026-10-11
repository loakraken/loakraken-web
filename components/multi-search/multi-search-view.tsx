"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useQueries, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { CompareCards, type CompareCard } from "@/components/ui/compare-cards";
import { DataTable, SortHeader, useTableSort } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { CloseCircle } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SkeletonValue } from "@/components/ui/skeleton";
import { RATE_LIMITED, failureOf, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { fetchCharacter } from "@/lib/character/client";
import { GEM_SLOTS } from "@/lib/character/detail";
import { failureCopy } from "@/lib/character/model";
import {
  MULTI_SEARCH_LIMIT,
  bestNames,
  namesSearch,
  parseNames,
  summarize,
  valueOf,
  type Cell,
  type Engraving,
  type Summary,
} from "@/lib/multi-search/model";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./multi-search.module.css";

const number = (value: number, digits = 2) => value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
const characterHref = (name: string) => `/character/${encodeURIComponent(name)}`;

type Entry = {
  name: string;
  summary: Summary | null;
  error: unknown;
  /** Not asked yet: waiting for the one before it, or stopped by a rate limit. */
  waiting: "turn" | "limit" | null;
  retry: () => void;
};

/**
 * One character request at a time, in list order (at most six): the next one
 * opens when the one before it has an answer. A rate limit stops the queue
 * until that character is retried. Same cache key as the character page.
 */
function gatesFor(names: string[], client: QueryClient) {
  const gates: { enabled: boolean; limited: boolean }[] = [];
  names.forEach((_, i) => {
    if (i === 0) return gates.push({ enabled: true, limited: false });
    const before = gates[i - 1];
    const prev = client.getQueryState(["character", names[i - 1]]);
    const settled = prev?.fetchStatus === "idle" && (prev.status === "success" || prev.status === "error");
    const limitedHere = prev?.status === "error" && failureOf(prev.error)?.code === RATE_LIMITED;
    gates.push({ enabled: before.enabled && settled && !limitedHere, limited: before.limited || limitedHere });
  });
  return gates;
}

function useCharacters(names: string[]) {
  const gates = gatesFor(names, useQueryClient());
  const results = useQueries({
    queries: names.map((name, i) => ({
      queryKey: ["character", name],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchCharacter(name, signal),
      enabled: gates[i].enabled,
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  return names.map<Entry>((name, i) => {
    const result = results[i];
    return {
      name,
      summary: result.data ? summarize(result.data.data) : null,
      error: result.data ? null : result.error,
      waiting: result.data || result.error || gates[i].enabled ? null : gates[i].limited ? "limit" : "turn",
      retry: () => void result.refetch(),
    };
  });
}

function Best({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <span className={styles.best}>
      <span className={styles.mark}>최고</span>
      {children}
    </span>
  );
}

function Reason({ text }: { text: string }) {
  return <span className={styles.reason}>{text}</span>;
}

function show<T>(cell: Cell<T>, render: (value: T) => ReactNode) {
  return "value" in cell ? render(cell.value) : <Reason text={cell.reason} />;
}

function Engravings({ list, className }: { list: Engraving[]; className?: string }) {
  const full = list.map((e) => `${e.name}${e.level != null ? ` ${e.level}` : ""}`).join(", ");
  return (
    <span className={className} title={full}>
      {list.map((e, i) => (
        <span key={i} className={styles.chip}>
          {e.name}
          {e.level != null && <b>{e.level}</b>}
        </span>
      ))}
    </span>
  );
}

function ArkPoints({ points, className }: { points: { tree: string; value: number }[]; className?: string }) {
  return (
    <span className={className}>
      {points.map((p) => (
        <span key={p.tree} className={styles.chip}>
          {p.tree}
          <b>{p.value}</b>
        </span>
      ))}
    </span>
  );
}
const refineText = ({ min, max }: { min: number; max: number }) => (min === max ? `+${min}` : `+${min}~+${max}`);
// A full set (11) goes without saying; fewer shows the count.
const gemText = ({ average, count }: { average: number; count: number }) =>
  `Lv.${number(average, 1)}${count < GEM_SLOTS ? ` (${count}개)` : ""}`;
const subText = (s: Summary) => [s.server, s.className, s.role].filter(Boolean).join(" · ");

/** Why a character has no values, in one line, with a retry when it can help. */
function Failure({ entry, compact = false }: { entry: Entry; compact?: boolean }) {
  const limit = useRateLimit(entry.error);
  if (entry.waiting === "limit") return <Reason text="요청이 많아 앞 캐릭터 다시 시도 뒤에 불러와요" />;
  const failure = failureOf(entry.error);
  const code = failure?.code ?? "";
  const text = limit.limited ? "요청이 많아 잠시 멈췄어요" : failureCopy({ code, status: 0 }).title;
  const retryable = code !== "CHARACTER_NOT_FOUND" && code !== "INVALID_REQUEST";
  return (
    <span className={styles.failed} role="status">
      <Reason text={text} />
      {retryable && (
        <button type="button" className={styles.textButton} onClick={entry.retry} disabled={limit.seconds > 0}>
          {compact && limit.seconds <= 0 ? "다시 시도" : retryLabel(limit.seconds)}
        </button>
      )}
    </span>
  );
}

type SortKey = "itemLevel" | "combatPower" | "quality" | "gems";

function CompareTable({ entries, best, onRemove }: { entries: Entry[]; best: Record<SortKey, string[]>; onRemove: (name: string) => void }) {
  const { sorted, sort, toggle } = useTableSort<Entry, SortKey>(entries, {
    itemLevel: (e) => e.summary?.itemLevel,
    combatPower: (e) => (e.summary ? valueOf(e.summary.combatPower) : null),
    quality: (e) => (e.summary ? valueOf(e.summary.quality) : null),
    gems: (e) => (e.summary ? valueOf(e.summary.gems)?.average : null),
  });
  const isBest = (key: SortKey, name: string) => best[key].includes(name);
  return (
    <DataTable label="캐릭터 비교 표" stickyFirst className={styles.table}>
      {/* Fixed widths: a column does not widen when a later character arrives. */}
      <colgroup>
        {[136, 108, 124, 272, 150, 84, 84, 96, 56].map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col">캐릭터</th>
          <SortHeader sortKey="itemLevel" sort={sort} onSort={toggle} numeric>
            아이템 레벨
          </SortHeader>
          <SortHeader sortKey="combatPower" sort={sort} onSort={toggle} numeric>
            전투력
          </SortHeader>
          <th scope="col">각인</th>
          <th scope="col">아크 패시브</th>
          <th scope="col">재련</th>
          <SortHeader sortKey="quality" sort={sort} onSort={toggle} numeric>
            품질
          </SortHeader>
          <SortHeader sortKey="gems" sort={sort} onSort={toggle} numeric>
            보석
          </SortHeader>
          {/* relative: the hidden label stays inside the scrolling table */}
          <th scope="col" className="relative">
            <span className="sr-only">빼기</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((entry) => {
          const s = entry.summary;
          const busy = !s && !entry.error && entry.waiting !== "limit";
          return (
            <tr key={entry.name} aria-busy={busy || undefined}>
              <th scope="row">
                <span className={styles.name}>
                  <Link href={characterHref(entry.name)}>{entry.name}</Link>
                  <span className={styles.sub}>{s ? subText(s) : busy ? <SkeletonValue chars={9} /> : " "}</span>
                </span>
              </th>
              {s ? (
                <>
                  <td data-numeric>
                    <Best on={isBest("itemLevel", s.name)}>{number(s.itemLevel)}</Best>
                  </td>
                  <td data-numeric>
                    {show(s.combatPower, (v) => (
                      <Best on={isBest("combatPower", s.name)}>{number(v)}</Best>
                    ))}
                  </td>
                  <td>{show(s.engravings, (list) => <Engravings list={list} className={styles.chips} />)}</td>
                  <td>{show(s.arkPassive, (points) => <ArkPoints points={points} className={styles.chips} />)}</td>
                  <td>{show(s.refine, refineText)}</td>
                  <td data-numeric>
                    {show(s.quality, (v) => (
                      <Best on={isBest("quality", s.name)}>{number(v, 1)}</Best>
                    ))}
                  </td>
                  <td data-numeric>
                    {show(s.gems, (v) => (
                      <Best on={isBest("gems", s.name)}>{gemText(v)}</Best>
                    ))}
                  </td>
                </>
              ) : busy ? (
                <>
                  <td data-numeric><SkeletonValue chars={8} /></td>
                  <td data-numeric><SkeletonValue chars={9} /></td>
                  <td><SkeletonValue chars={22} /></td>
                  <td><SkeletonValue chars={18} /></td>
                  <td><SkeletonValue chars={6} /></td>
                  <td data-numeric><SkeletonValue chars={4} /></td>
                  <td data-numeric><SkeletonValue chars={9} /></td>
                </>
              ) : (
                <td colSpan={7}>
                  <Failure entry={entry} />
                </td>
              )}
              <td>
                <IconButton size="sm" aria-label={`${entry.name} 빼기`} onClick={() => onRemove(entry.name)}>
                  <CloseCircle aria-hidden />
                </IconButton>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

const CARD_ROWS = [
  { id: "itemLevel", label: "아이템 레벨" },
  { id: "combatPower", label: "전투력" },
  { id: "engravings", label: "각인" },
  { id: "arkPassive", label: "아크 패시브" },
  { id: "refine", label: "재련" },
  { id: "quality", label: "품질" },
  { id: "gems", label: "보석" },
];

function cardOf(entry: Entry, best: Record<SortKey, string[]>, onRemove: (name: string) => void): CompareCard {
  const s = entry.summary;
  const busy = !s && !entry.error && entry.waiting !== "limit";
  const remove = (
    <IconButton size="sm" aria-label={`${entry.name} 빼기`} onClick={() => onRemove(entry.name)}>
      <CloseCircle aria-hidden />
    </IconButton>
  );
  if (!s)
    return {
      id: entry.name,
      title: entry.name,
      sub: busy ? <SkeletonValue chars={9} /> : " ",
      values: Object.fromEntries(
        CARD_ROWS.map((r) => {
          const value = busy ? <SkeletonValue chars={6} /> : "—";
          // keep the tall rows tall, so the cards line up while loading
          const lines = r.id === "engravings" ? styles.cardLines3 : r.id === "arkPassive" ? styles.cardLines2 : null;
          return [r.id, <span key={r.id} className={lines ?? styles.cardValue}>{value}</span>];
        })
      ),
      footer: (
        <div className={styles.cardFooter}>
          {busy ? <span className={styles.cardReason}>불러오는 중…</span> : <Failure entry={entry} compact />}
          {remove}
        </div>
      ),
    };
  const bestRows = (Object.keys(best) as SortKey[]).filter((key) => best[key].includes(s.name));
  return {
    id: entry.name,
    title: entry.name,
    sub: subText(s),
    best: bestRows,
    values: {
      itemLevel: <span className={styles.cardValue}>{number(s.itemLevel)}</span>,
      combatPower: <span className={styles.cardValue}>{show(s.combatPower, (v) => number(v))}</span>,
      engravings: (
        <span className={styles.cardLines3}>{show(s.engravings, (list) => <Engravings list={list} />)}</span>
      ),
      arkPassive: <span className={styles.cardLines2}>{show(s.arkPassive, (points) => <ArkPoints points={points} />)}</span>,
      refine: <span className={styles.cardValue}>{show(s.refine, refineText)}</span>,
      quality: <span className={styles.cardValue}>{show(s.quality, (v) => number(v, 1))}</span>,
      gems: <span className={styles.cardValue}>{show(s.gems, gemText)}</span>,
    },
    footer: (
      <div className={styles.cardFooter}>
        <Link href={characterHref(s.name)}>캐릭터 보기</Link>
        {remove}
      </div>
    ),
  };
}

export function MultiSearchView({ initialNames }: { initialNames: string[] }) {
  const ids = { field: useId(), hint: useId(), error: useId() };
  const [names, setNames] = useState(initialNames);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  // The list lives in the address so a comparison can be shared or reloaded.
  useEffect(() => {
    const next = `${window.location.pathname}${namesSearch(names)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [names]);

  const entries = useCharacters(names);
  const summaries = entries.flatMap((e) => (e.summary ? [e.summary] : []));
  const best: Record<SortKey, string[]> = {
    itemLevel: bestNames(summaries, (s) => s.itemLevel),
    combatPower: bestNames(summaries, (s) => valueOf(s.combatPower)),
    quality: bestNames(summaries, (s) => valueOf(s.quality)),
    gems: bestNames(summaries, (s) => valueOf(s.gems)?.average ?? null),
  };
  // After a remove or clear the button is gone; keep focus in the field.
  const focusField = () => document.getElementById(ids.field)?.focus();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const typed = parseNames(text);
    if (!typed.names.length && !typed.invalid.length && !typed.dropped.length) {
      setError(
        names.length >= MULTI_SEARCH_LIMIT
          ? `이미 ${MULTI_SEARCH_LIMIT}명이에요. 한 명을 빼고 넣어 주세요.`
          : "캐릭터 이름을 입력해 주세요."
      );
      return;
    }
    const merged = parseNames([...names, ...typed.names, ...typed.dropped].join(","));
    const problems = [
      typed.invalid.length ? `이름이 아닌 값은 뺐어요: ${typed.invalid.join(", ")}` : "",
      merged.dropped.length ? `최대 ${MULTI_SEARCH_LIMIT}명까지라 뺐어요: ${merged.dropped.join(", ")}` : "",
    ].filter(Boolean);
    setNames(merged.names);
    setError(problems.join(" · "));
    if (!problems.length) setText("");
  };

  const remove = (name: string) => {
    setNames((list) => list.filter((n) => n !== name));
    setError("");
    focusField();
  };

  const done = entries.filter((e) => e.summary || e.error).length;
  const status = !names.length
    ? ""
    : done < names.length
      ? `${names.length}명 중 ${done}명을 불러왔어요`
      : `${names.length}명을 비교하고 있어요`;

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#multi-search-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="multi-search-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="multi-search-heading">
          <p className={styles.kicker}>캐릭터</p>
          <h1 id="multi-search-heading">멀티서치</h1>
          <p>여러 캐릭터를 나란히 놓고 아이템 레벨·전투력·각인·장비를 비교해요.</p>
        </section>

        <form className={styles.form} onSubmit={submit} aria-label="비교할 캐릭터">
          <label htmlFor={ids.field}>캐릭터 이름</label>
          <div className={styles.field}>
            <Input
              id={ids.field}
              size="lg"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError("");
              }}
              placeholder="예: 이름1, 이름2…"
              name="names"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-invalid={error ? true : undefined}
              aria-describedby={`${ids.hint} ${ids.error}`}
            />
            {/* Always pressable: a full list says why in the message line. */}
            <Button type="submit">
              비교하기
            </Button>
          </div>
          <p id={ids.hint} className={styles.hint}>
            최대 {MULTI_SEARCH_LIMIT}명까지 비교할 수 있어요. 지금 {names.length}명
          </p>
          <p id={ids.error} className={styles.error} role="alert">
            {error}
          </p>
        </form>

        {names.length ? (
          <>
            <div className={styles.bar}>
              <p className={styles.status} aria-live="polite">
                {status}
              </p>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  setNames([]);
                  setError("");
                  focusField();
                }}
              >
                모두 지우기
              </button>
            </div>
            <div className={styles.panel}>
              <CompareTable entries={entries} best={best} onRemove={remove} />
            </div>
            <div className={styles.cards}>
              <CompareCards label="캐릭터 비교 카드" rows={CARD_ROWS} cards={entries.map((e) => cardOf(e, best, remove))} />
            </div>
          </>
        ) : (
          <div className={styles.panel}>
            <EmptyState
              title="비교할 캐릭터를 넣어 주세요"
              reason={`이름을 쉼표나 띄어쓰기로 나눠 한 번에 넣을 수 있어요. 최대 ${MULTI_SEARCH_LIMIT}명까지 비교해요.`}
            />
          </div>
        )}
      </main>
    </div>
  );
}
