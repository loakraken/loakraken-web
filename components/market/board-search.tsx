"use client";

// 시세판 이름 검색 (#1115, api #624). The server filters the open tab's whole
// scan by a part of the name or its initials (ㅇㅂㄷ) and reuses its cache, so
// a search spends no official calls. The field sends 300ms after typing rests,
// also while a Hangul syllable is still being composed (no wait for the end
// of composition); text the server would refuse is never sent.
import { useEffect, useId, useRef, useState } from "react";
import { CloseCircle, SearchNormal } from "@/components/ui/icons";
import { readSearch } from "@/lib/market/board";
import styles from "./market.module.css";

/** How long typing rests before the search is sent (#1115: at least 300ms). */
export const SEARCH_DELAY = 300;

export function BoardSearch({
  value,
  onSearch,
  notice,
}: {
  value: string | null;
  onSearch: (q: string | null) => void;
  /** A note about the shown results (e.g. only part of the tab was searched), in the same held line. */
  notice?: string | null;
}) {
  const id = useId();
  const [text, setText] = useState(value ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sent = useRef(value);
  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (next: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const search = readSearch(next);
      if (search.invalid || search.q === sent.current) return;
      sent.current = search.q;
      onSearch(search.q);
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
  const invalid = readSearch(text).invalid;

  return (
    <div className={styles.search} role="search">
      <div className={styles.searchField} data-invalid={invalid || undefined}>
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
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-note`}
          onChange={(event) => {
            setText(event.target.value);
            send(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && text) {
              event.preventDefault();
              clear();
            }
          }}
        />
        {/* Always there (hidden while empty): typing never moves the field's contents. */}
        <button
          type="button"
          className={styles.searchClear}
          aria-label="검색어 지우기"
          hidden={!text}
          onClick={clear}
        >
          <CloseCircle size={16} aria-hidden="true" />
        </button>
      </div>
      {/* One line held from the start: the note coming and going moves nothing below (A7). */}
      <p id={`${id}-note`} className={styles.searchNote} data-invalid={invalid || undefined} aria-live="polite">
        {invalid ? "기호는 ·()+-: 만 쓸 수 있어요." : (notice ?? "")}
      </p>
    </div>
  );
}
