"use client";
import "./bencho/command-bar.css";
import { useState } from "react";

/**
 * The global search's field, drawn as a plain pill (PM 총괄 11-08, option b):
 * it opens with the dialog without the liquid library, so the first open's
 * click runs no long task for it. The liquid surface (bencho/liquid-pill)
 * mounts under it later, at idle, and fades in over this pill's own fill;
 * the field itself never remounts, so focus, caret and text stay put.
 * Same box, classes and keys as Bencho's command bar (.cmd*, 56px pill).
 */
export function CommandField({
  placeholder = "캐릭터 이름 검색",
  label = "캐릭터 이름",
  liquid = false,
  onSubmit,
  autoFocus = false,
  onValueChange,
  onInputKeyDown,
  inputProps,
}: {
  placeholder?: string;
  /** Names the field for screen readers. */
  label?: string;
  /** The liquid surface is under the field: this pill's own fill steps aside. */
  liquid?: boolean;
  /** Gets the trimmed text; return false to keep it in the field. */
  onSubmit?: (text: string) => boolean | void;
  autoFocus?: boolean;
  /** Every change of the field's text (also the emptying after a send). */
  onValueChange?: (text: string) => void;
  /** Before the field's own keys; preventDefault keeps Enter from sending. */
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Extra attributes for the field (role="combobox", aria-*). */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const [q, setQ] = useState("");
  const run = () => {
    const text = q.trim();
    if (!text) return;
    if (onSubmit?.(text) === false) return;
    setQ("");
    onValueChange?.("");
  };
  return (
    <div className="cmd-goo cmd-field" data-liquid={liquid || undefined} style={{ width: "100%" }}>
      <div className="cmd-slot">
        <div className="cmd">
          <input
            {...inputProps}
            value={q}
            placeholder={placeholder}
            aria-label={label}
            autoFocus={autoFocus}
            enterKeyHint="search"
            onChange={(e) => {
              setQ(e.target.value);
              onValueChange?.(e.target.value);
            }}
            onKeyDown={(e) => {
              onInputKeyDown?.(e);
              if (!e.defaultPrevented && e.key === "Enter") run();
            }}
          />
        </div>
      </div>
    </div>
  );
}
