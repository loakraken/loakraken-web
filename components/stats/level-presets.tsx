"use client";

import styles from "./stats.module.css";

/**
 * Item-level presets beside the number field (reference spec A4), shared by
 * the statistics and ranking filters. 1,640 is the backend's own default for
 * these screens (StatsConditions; sent as nothing, the answer echoes 1640), so
 * it is the pressed one until another level is chosen; 1,700 is the common
 * endgame cut. Any other level is typed in the field. Class builds default to
 * 1,680 instead, so they would have to send 1,640 explicitly.
 */
const LEVEL_PRESETS = [
  { label: "1,640", value: undefined, matches: (level?: number) => level == null || level === 1640 },
  { label: "1,700", value: 1700, matches: (level?: number) => level === 1700 },
] as const;

export function LevelPresets({ level, onPick }: { level?: number; onPick: (value: number | undefined) => void }) {
  return (
    <div className={styles.levelPresets} role="group" aria-label="아이템 레벨 바로 고르기">
      {LEVEL_PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="hit-44"
          aria-pressed={preset.matches(level)}
          onClick={() => onPick(preset.value)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
