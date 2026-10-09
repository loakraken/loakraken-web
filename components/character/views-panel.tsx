"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CharacterQueryError, fetchViews } from "@/lib/character/client";
import { monthLabels, viewDateLabel, viewWeeks } from "@/lib/character/views";
import { Panel } from "./panel";
import styles from "./views.module.css";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";

const ROWS = ["일", "월", "화", "수", "목", "금", "토"];
const count = (n: number) => `${n.toLocaleString("ko-KR")}회`;

/**
 * LOAKraken views (F-8): 16-week heatmap, one column per week. Pointer or
 * arrow keys move a readout across days; colour is a single-hue ramp and the
 * readout carries the exact count, so the value is never colour-only.
 */
export function ViewsPanel({ name }: { name: string }) {
  const fade = useCrossfade();
  const query = useQuery({
    queryKey: ["character-views", name],
    queryFn: ({ signal }) => fetchViews(name, signal),
    staleTime: 60_000,
  });
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  const weeks = useMemo(() => viewWeeks(data?.days ?? []), [data]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);
  const cells = useMemo(() => weeks.flat(), [weeks]);
  const last = cells.findLastIndex(Boolean);
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? last;
  const today = data?.days.at(-1)?.count ?? 0;

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    const index = (event.target as HTMLElement).dataset.index;
    if (index !== undefined) setActive(Number(index));
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    let next = (active ?? last) + step;
    while (next >= 0 && next < cells.length && !cells[next]) next += step > 0 ? 1 : -1;
    if (next >= 0 && next < cells.length && cells[next]) setActive(next);
  }

  const meta = data ? `최근 16주 · ${count(data.rangeTotal)}` : undefined;
  return (
    <Panel title="조회수" meta={meta}>
      {query.isPending ? (
        <p className={styles.muted}>조회수를 불러오고 있어요…</p>
      ) : query.isError || !data ? (
        <div className={styles.muted}>
          <p>
            {limit.limited
              ? countdownText(limit.seconds)
              : query.error instanceof CharacterQueryError &&
                  query.error.info.code === "CHARACTER_VIEWS_DISABLED"
                ? "조회수 기록이 꺼져 있어요."
                : "조회수를 불러오지 못했어요."}
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => query.refetch()}
            disabled={limit.seconds > 0}
          >
            {retryLabel(limit.seconds)}
          </button>
        </div>
      ) : (
        <>
          <div {...fade(styles.frame)}>
            <div className={styles.rowLabels} aria-hidden="true">
              {ROWS.map((row, i) => (
                <span key={row}>{i % 2 ? row : ""}</span>
              ))}
            </div>
            <div className={styles.plot}>
              <div
                className={styles.months}
                style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}
                aria-hidden="true"
              >
                {labels.map((label) => (
                  <span key={label.column} style={{ gridColumn: label.column + 1 }}>
                    {label.text}
                  </span>
                ))}
              </div>
              <div
                className={styles.grid}
                style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}
                role="img"
                aria-label={`최근 16주 LOAKraken 조회수 ${count(data.rangeTotal)}. 화살표 키로 날짜를 이동할 수 있어요.`}
                aria-describedby={`views-readout-${name}`}
                tabIndex={0}
                onPointerOver={onPointer}
                onPointerLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                onKeyDown={onKey}
              >
                {cells.map((cell, i) =>
                  cell ? (
                    <i
                      key={cell.date}
                      data-index={i}
                      data-level={cell.level}
                      data-active={i === active || undefined}
                      title={`${viewDateLabel(cell.date)} ${count(cell.count)}`}
                    />
                  ) : (
                    <i key={`pad-${i}`} data-pad />
                  ),
                )}
              </div>
            </div>
          </div>
          <div className={styles.foot}>
            <p id={`views-readout-${name}`} className={styles.readout} aria-live="polite">
              {cells[shown] && (
                <>
                  <b>{count(cells[shown]!.count)}</b> {viewDateLabel(cells[shown]!.date)}
                </>
              )}
            </p>
            <span className={styles.legend} aria-hidden="true">
              적음
              {[0, 1, 2, 3, 4].map((level) => (
                <i key={level} data-level={level} />
              ))}
              많음
            </span>
          </div>
          <dl className={styles.totals}>
            <div>
              <dt>오늘</dt>
              <dd>{count(today)}</dd>
            </div>
            <div>
              <dt>전체</dt>
              <dd>{count(data.total)}</dd>
            </div>
          </dl>
          <p className={styles.note}>LOAKraken 기준 · 반복 조회 포함</p>
        </>
      )}
    </Panel>
  );
}
