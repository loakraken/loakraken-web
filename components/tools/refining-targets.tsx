"use client";

// (ours, X3) Two target controls in the 재련 계산기's 목표 단계 card: a target item-level slider (the stages it adds are
// spread evenly over the six item-level parts in the plan) and '고른 부위 +1'. Our own model and the page's own 일반
// 재련 plan only (lib/refining/targets.ts). The slider shows its level while it moves and sets the targets once, when
// it is let go (the native change event): a drag never sends a plan request per step.
import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { formatLevel, PARTS, type PartId, type PartState } from "@/lib/refining/model";
import { bumpPicked, levelGain, raisable, sliderMax, sliderValue, spreadStages } from "@/lib/refining/targets";
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

export function RefiningTargets({
  parts,
  setParts,
  itemLevel,
}: {
  parts: Parts;
  setParts: Dispatch<SetStateAction<Parts>>;
  /** The loaded character's item level, or null (then the slider says how much it adds). */
  itemLevel: number | null;
}) {
  const sliderId = useId();
  const max = sliderMax(parts);
  const value = sliderValue(parts);
  // The position while the thumb moves; null when it rests on the page's targets.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const level =
    itemLevel != null ? formatLevel(itemLevel + levelGain(shown)) : `+${formatLevel(levelGain(shown))}`;

  // Set the targets on release only: the native change event (mouse or touch let go, a key step, a fill).
  const range = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = range.current;
    if (!input) return;
    const commit = () => {
      const stages = Number(input.value);
      setParts((prev) => spreadStages(prev, stages));
      setDraft(null);
    };
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [setParts]);

  const [picked, setPicked] = useUrlState<PartId[]>("pick", NONE, pickCodec);
  const toggle = (id: PartId) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : PART_IDS.filter((p) => p === id || prev.includes(p))));
  const canRaise = raisable(parts, picked).length > 0;

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
          onChange={(event) => setDraft(Number(event.target.value))}
        />
        <p className={styles.caption}>
          계산에 넣은 여섯 부위(완갑 제외)의 목표를 낮은 부위부터 고르게 올려요. 손을 떼면 계산해요.
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
        <button
          type="button"
          className={`${styles.raise} hit-44`}
          aria-disabled={!canRaise || undefined}
          onClick={() => canRaise && setParts((prev) => bumpPicked(prev, picked))}
        >
          고른 부위 +1
        </button>
      </div>
    </div>
  );
}
