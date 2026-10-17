"use client";

// Setting fields shared by 아비도스 제작 손익 and 생명의 기운 효율 (styles from
// abidos-craft.module.css). Hint lines are held from the first paint so an
// error line or a changed hint never pushes the page (A7), and a changed hint
// is redrawn instead of sliding.
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { parsePercent } from "@/lib/tools/abidos-craft";
import styles from "./abidos-craft.module.css";

export function PercentField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hintId = useId();
  const invalid = value !== "" && parsePercent(value) == null;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.percent}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
        />
        <span aria-hidden="true">%</span>
      </div>
      <p id={hintId} className={styles.small} data-error={invalid || undefined}>
        {invalid ? "0~100 사이 숫자(소수 한 자리까지)로 넣어 주세요." : hint}
      </p>
    </div>
  );
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={styles.switchRow}>
      <span>
        <label htmlFor={id}>{label}</label>
        <small id={hintId}>
          <span key={hint}>{hint}</span>
        </small>
      </span>
      <Switch id={id} className="hit-44" aria-describedby={hintId} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
