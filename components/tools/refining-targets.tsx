"use client";

// (ours, X3) Two target controls in the 재련 계산기's 목표 단계 card: a target item-level slider (the stages it adds are
// spread evenly over the six item-level parts in the plan) and '고른 부위 +1'. Our own model and the page's own 일반
// 재련 plan only (lib/refining/targets.ts). The slider shows its level while it moves and sets the targets once, when
// it is let go (the native change event): a drag never sends a plan request per step.
import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { formatLevel, PARTS, type PartId, type PartState } from "@/lib/refining/model";
import {
  bumpPicked,
  levelGain,
  raisable,
  sameParts,
  slideTargets,
  sliderMax,
  sliderValue,
  type SlideAnchor,
} from "@/lib/refining/targets";
import { useUrlState, type UrlCodec } from "@/lib/tools/url-state";
import styles from "./refining-targets.module.css";

type Parts = Record<PartId, PartState>;

const PART_IDS = PARTS.map((part) => part.id) as PartId[];
/** The picked parts in the address ('pick'), in the page's order; anything else in it is dropped. */
const pickCodec: UrlCodec<PartId[]> = {
  parse: (raw) => {
    const ids = raw.split(",").filter((id): id is PartId => (PART_IDS as string[]).includes(id));
    return PART_IDS.filter((id) => ids.includes(id));
  },
  format: (value) => value.join(","),
};
const NONE: PartId[] = [];
/** Keys that move a range input: letting go of one ends a key step (others, like Shift, do not). */
const RANGE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function RefiningTargets({
  parts,
  setParts,
  itemLevel,
  advanced,
}: {
  parts: Parts;
  setParts: Dispatch<SetStateAction<Parts>>;
  /** The loaded character's item level, or null (then the slider says how much it adds). */
  itemLevel: number | null;
  /** (X3 part 2, REFINING_ADVANCED) '고른 부위 상급 +10' on the same picks; absent while the switch is off. */
  advanced?: { can: (picked: readonly PartId[]) => boolean; raise: (picked: readonly PartId[]) => void };
}) {
  const sliderId = useId();
  const max = sliderMax(parts);
  const value = sliderValue(parts);
  // The position while the thumb moves, with the value it moved from; null when it rests on the page's targets.
  // A draft from another value is stale: the targets changed elsewhere ('고른 부위 +1', a row) and win (codex P2 on
  // #1922: a drag back to where it started fires no change event, and its draft hid the next change's level).
  const [draft, setDraft] = useState<{ stages: number; from: number } | null>(null);
  const shown = draft && draft.from === value ? draft.stages : value;
  const level =
    itemLevel != null ? formatLevel(itemLevel + levelGain(shown)) : `+${formatLevel(levelGain(shown))}`;

  // Set the targets on release only: the native change event (mouse or touch let go, a key step, a fill).
  const range = useRef<HTMLInputElement>(null);
  // Where this run of slider steps started (#1929): each step spreads from it, so a step back undoes a step forward.
  // The parts as last drawn, for the step (computed outside the state updater, which must stay pure: StrictMode runs
  // it twice, codex P3 on #1930). Any change to the parts that is not the run's own last step ends the run, at once,
  // so an outside change that lands back on the same parts (a chip +20 then +19) still starts afresh (codex P3).
  const anchor = useRef<SlideAnchor | null>(null);
  const latest = useRef(parts);
  // Before paint (a layout effect, #1937): a change event right after a render reads these parts, never the last ones.
  useLayoutEffect(() => {
    latest.current = parts;
    if (anchor.current && !sameParts(parts, anchor.current.made)) anchor.current = null;
  }, [parts]);
  useEffect(() => {
    const input = range.current;
    if (!input) return;
    const commit = () => {
      const step = slideTargets(anchor.current, latest.current, Number(input.value));
      anchor.current = step;
      setParts(step.made);
      setDraft(null);
    };
    // Let go without a change event (dragged back to the start), or left: drop the draft, set nothing. A task later,
    // so a release's own change event commits first. Not while the pointer still holds the thumb, and on a key only
    // when it is one that moves the slider (#1929: letting go of Shift mid-drag sent the thumb back).
    let timer = 0;
    let held = false;
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDraft(null), 0);
    };
    const press = () => {
      held = true;
    };
    const release = () => {
      held = false;
      settle();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (!held && RANGE_KEYS.has(event.key)) settle();
    };
    // A key step while the pointer holds the thumb would move it and commit mid-drag (codex P3 on #1930): the drag
    // owns the slider until it is let go.
    const keyDown = (event: KeyboardEvent) => {
      if (held && RANGE_KEYS.has(event.key)) event.preventDefault();
    };
    // A lost pointer capture ends the drag too (the browser took the pointer away), as a release does (#1937).
    const releases = ["pointerup", "pointercancel", "lostpointercapture", "blur"] as const;
    input.addEventListener("change", commit);
    input.addEventListener("pointerdown", press);
    input.addEventListener("keydown", keyDown);
    input.addEventListener("keyup", keyUp);
    for (const type of releases) input.addEventListener(type, release);
    return () => {
      window.clearTimeout(timer);
      input.removeEventListener("change", commit);
      input.removeEventListener("pointerdown", press);
      input.removeEventListener("keydown", keyDown);
      input.removeEventListener("keyup", keyUp);
      for (const type of releases) input.removeEventListener(type, release);
    };
  }, [setParts]);

  const [picked, setPicked] = useUrlState<PartId[]>("pick", NONE, pickCodec);
  const toggle = (id: PartId) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : PART_IDS.filter((p) => p === id || prev.includes(p))));
  const canRaise = raisable(parts, picked).length > 0;
  const canAdvance = advanced?.can(picked) ?? false;

  return (
    <div className={styles.targets}>
      <div className={styles.slider}>
        <label htmlFor={sliderId} className={styles.sliderHead}>
          <span>목표 아이템 레벨</span>
          <output htmlFor={sliderId} className={styles.level}>
            {level}
          </output>
        </label>
        <input
          ref={range}
          id={sliderId}
          type="range"
          min={0}
          max={Math.max(max, 1)}
          step={1}
          value={Math.min(shown, Math.max(max, 1))}
          disabled={max === 0}
          aria-valuetext={`아이템 레벨 ${level}, ${shown}단계 올림`}
          onChange={(event) => setDraft({ stages: Number(event.target.value), from: value })}
        />
        <p className={styles.caption}>
          계산에 넣은 여섯 부위(완갑 제외)의 목표를 낮은 부위부터 고르게 올려요. 올릴 때 이미 정한 목표는 낮추지 않아요. 내릴 때는 목표가 가장 높은 부위부터 낮춰요. 손을 떼면 계산해요.
        </p>
      </div>
      <div className={styles.pick} role="group" aria-label="고른 부위 한 번에 올리기">
        <div className={styles.picks}>
          {PARTS.map((part) => (
            <button
              key={part.id}
              type="button"
              className="hit-44"
              aria-pressed={picked.includes(part.id)}
              disabled={!parts[part.id].enabled}
              onClick={() => toggle(part.id)}
            >
              {part.label}
            </button>
          ))}
        </div>
        <div className={styles.raises}>
          <button
            type="button"
            className={`${styles.raise} hit-44`}
            aria-disabled={!canRaise || undefined}
            onClick={() => canRaise && setParts((prev) => bumpPicked(prev, picked))}
          >
            고른 부위 +1
          </button>
          {advanced && (
            <button
              type="button"
              className={`${styles.raise} hit-44`}
              aria-disabled={!canAdvance || undefined}
              onClick={() => canAdvance && advanced.raise(picked)}
            >
              고른 부위 상급 +10
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
