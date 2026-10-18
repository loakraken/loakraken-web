"use client";

// 시세판 이름 검색 (v0.3.2, api #624). The field filters the open tab on the
// server (its whole scan: a part of the name or its initials, ㅇㅂㄷ); when
// nothing matches, one press looks the name up in the tab's market group
// (the official item search, the material quote's path) — one call per name.
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloseCircle, SearchNormal } from "@/components/ui/icons";
import { GameIcon } from "@/components/character/imagery";
import { InlineOrb } from "@/components/landing/orb";
import { goldText, normalizeSearch } from "@/lib/market/board";
import { fetchMarketItems, fetchMarketOptions } from "@/lib/market/client";
import { marketFailureCopy, type MarketFailure } from "@/lib/market/model";
import { failureOf } from "@/lib/api/rate-limit";
import styles from "./market.module.css";

/** How long typing rests before the search is sent (PM: at least 300ms). */
export const SEARCH_DELAY = 300;

/**
 * The name field: sends the search 300ms after typing stops, never in the
 * middle of a Hangul syllable being composed. Its height never changes.
 */
export function BoardSearch({ value, onSearch }: { value: string | null; onSearch: (q: string | null) => void }) {
  const id = useId();
  const [text, setText] = useState(value ?? "");
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sent = useRef(value);
  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (next: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = normalizeSearch(next);
      if (q === sent.current) return;
      sent.current = q;
      onSearch(q);
    }, SEARCH_DELAY);
  };
  const clear = () => {
    clearTimeout(timer.current);
    setText("");
    if (sent.current !== null) {
      sent.current = null;
      onSearch(null);
    }
  };
  // Typed but not something the search takes (a symbol): said under the field.
  const refused = text.trim() !== "" && normalizeSearch(text) === null;

  return (
    <div className={styles.search} role="search">
      <label htmlFor={id} className={styles.srOnly}>
        품목 이름
      </label>
      <SearchNormal size={16} aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={text}
        placeholder="품목 이름이나 초성(ㅇㅂㄷ)으로 찾기"
        maxLength={20}
        autoComplete="off"
        enterKeyHint="search"
        aria-invalid={refused || undefined}
        aria-describedby={refused ? `${id}-hint` : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (!composing.current) send(event.target.value);
        }}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={(event) => {
          composing.current = false;
          send(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text) {
            event.preventDefault();
            clear();
          }
        }}
      />
      {text && (
        <button type="button" className={styles.searchClear} aria-label="검색어 지우기" onClick={clear}>
          <CloseCircle size={16} aria-hidden="true" />
        </button>
      )}
      {/* Said to a screen reader; on screen the field's edge turns red (no extra line, nothing moves). */}
      <p id={`${id}-hint`} className={styles.srOnly} aria-live="polite">
        {refused ? "한글·영문·숫자로 찾아 주세요." : ""}
      </p>
    </div>
  );
}

export type OutsideItem = { itemId: number; name: string; icon: string | null; grade: string | null };

/**
 * Nothing in the tab matched: one press asks the official item search in the
 * tab's market group (its top-level category) — once per name, then cached.
 */
export function WiderSearch({
  q,
  categoryCode,
  onPick,
}: {
  q: string;
  /** The open tab's official category (a sub category, e.g. 50010). */
  categoryCode: number | undefined;
  onPick: (item: OutsideItem) => void;
}) {
  const group = categoryCode ? Math.floor(categoryCode / 10000) * 10000 : undefined;
  const options = useQuery({
    queryKey: ["market", "options"],
    queryFn: ({ signal }) => fetchMarketOptions(signal),
    staleTime: 600_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const groupName = options.data?.data.categories.find((c) => c.code === group)?.codeName;
  const [asked, setAsked] = useState<string | null>(null);
  const items = useQuery({
    queryKey: ["market", "items-search", group, q],
    queryFn: ({ signal }) => fetchMarketItems({ categoryCode: group!, itemName: q, pageNo: 1 }, signal),
    enabled: asked === q && group != null,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const list = items.data?.data.items ?? [];
  const failure = failureOf(items.error) as MarketFailure | null;

  return (
    <div className={styles.wider}>
      <p className={styles.widerEmpty}>&lsquo;{q}&rsquo;에 맞는 품목이 이 분류에 없어요.</p>
      {asked !== q ? (
        <button
          type="button"
          className={styles.widerButton}
          disabled={group == null || !groupName}
          onClick={() => setAsked(q)}
        >
          {groupName ? `${groupName} 전체에서 찾기` : "분류를 불러오고 있어요"}
        </button>
      ) : items.isPending ? (
        <p className={styles.note} role="status">
          <InlineOrb /> {groupName} 전체에서 찾고 있어요.
        </p>
      ) : failure ? (
        <p className={styles.note} role="alert">
          {marketFailureCopy(failure).title}. {marketFailureCopy(failure).text}
        </p>
      ) : list.length === 0 ? (
        <p className={styles.note} role="status">
          {groupName} 전체에서도 찾지 못했어요.
        </p>
      ) : (
        <ul className={styles.widerList} aria-label={`${groupName} 전체에서 찾은 품목`}>
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick({ itemId: item.id, name: item.name, icon: item.icon, grade: item.grade })}
              >
                <GameIcon src={item.icon} grade={item.grade} size={28} />
                <strong data-grade={item.grade ?? undefined}>{item.name}</strong>
                <b>{item.currentMinPrice == null ? "아직 모은 시세가 없어요" : goldText(item.currentMinPrice)}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>다른 분류의 품목은 그 탭에서 찾아 주세요.</p>
    </div>
  );
}
