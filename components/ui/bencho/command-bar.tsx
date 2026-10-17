

"use client";
// MIT © 2026 Lorenzo Cabra — https://bencho.dev (block "Command bar")
// Bencho "Command bar", kept as published (full licence in ./NOTICE; the
// liquid-gooey library it draws with is MIT © 2026 Jakub, pinned at 0.2.2).
// Our changes: Lucide → Iconsax free icons, Korean words, the field's text
// handed to onSubmit (return false to keep it), autoFocus, an accessible
// name for the field, type="button", and the mic drawn only when there is
// something for it to do (onDictate) — Bencho's mic is a demo with no action.
// For the header search's result panel (10-12): onValueChange, onInputKeyDown
// (runs first; preventDefault stops the bar's own Enter) and inputProps (the
// combobox's role and aria-*) pass through to the field.
// Tokens are mapped on the block root in command-bar.css.
import "./command-bar.css";
import { useEffect, useRef, useState } from "react";
import { Liquid } from "liquid-gooey";
import { ArrowUp, Microphone } from "@/components/ui/icons";

/* the one helper this file wants from the shared kit */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── D · command bar ───────────────────────────────────── */
/* THE CHIP ROW IS GONE. Attach, Image and Project were three
   toggles that toggled nothing — the bar has no attachment to
   carry and never did, so what they demonstrated was a row of
   chips rather than a command bar. What is left is the field
   and the one action it can take. */
/* ── the split ────────────────────────────────────────────
   The bar and the send button are two bodies in one liquid
   group, and they are MORPH items rather than move ones: the
   library owns their x and animates the element and its
   silhouette in perfect sync, so while the button is leaving
   the two are still one body of liquid, necking thinner until
   the goo gives up.

   That choice carries a second one with it. Morph positions
   its items with a CSS transform on a real wrapper, in layout
   pixels, which scales correctly inside a scaled card on its
   own — so this component must NOT carry the 1/k correction
   every `move` group here needs. Applying it would over-shrink
   the silhouette until it sat smaller than the bar it is meant
   to be. Right for move, wrong for morph.

   ── THE BAR DOES NOT MOVE ───────────────────────────────
   The reference splits the offset between the two so the pair
   stays centred — the field slides one way while the button
   slides the other. That is right for a form that only ever
   holds those two things, and wrong here: everything inside
   the bar travels with it, so the mic fading out was also
   sliding sideways, and a thing that is leaving in two
   different ways at once reads as neither.

   So the whole offset goes on the button. The bar is fixed and
   the button walks out from under its right edge. The cost is
   that the composition is no longer centred at rest — it grows
   rightwards into the space the button will occupy, which is
   48px of slack on the right while nothing is typed. That is a
   fair trade for a field whose contents hold still. */
const CMD_BTN = 40;
const CMD_GAP = 8;
/* how far the button has to travel to be fused into the bar:
   its whole width plus the gap it would otherwise sit across,
   which lands its right edge exactly on the bar's */
const CMD_TUCK = CMD_BTN + CMD_GAP;
/* the reference's curve — a little past its target and back,
   so the neck snaps rather than easing apart */
const CMD_MORPH = { duration: 520, ease: "cubic-bezier(0.22, 1.3, 0.71, 1)" } as const;

/* 28 is half of the bar's 56px height — the pill it already
   is, so the slider only runs downwards from the default. */
const CMD_CORNER = 28;

export function CommandBar({
  /* How far apart the bar and the button still bridge, px, and
     it is deliberately LOW. A long neck reads as the button
     being reluctant to leave; a short one reads as it snapping
     off, which is what a control appearing the instant you
     type should feel like. */
  bridge = 3,
  /* how sharp the liquid edge is */
  edge = 22,
  /* the bar's corner, 0..28 */
  corner = CMD_CORNER,
  placeholder = "캐릭터 이름 검색",
  label = "캐릭터 이름",
  onSubmit,
  onDictate,
  autoFocus = false,
  onValueChange,
  onInputKeyDown,
  inputProps,
}: {
  bridge?: number;
  edge?: number;
  corner?: number;
  placeholder?: string;
  /** Names the field for screen readers. */
  label?: string;
  /** Gets the trimmed text; return false to keep it in the field. */
  onSubmit?: (text: string) => boolean | void;
  /** Shows the mic; without it the bar has no mic at all. */
  onDictate?: () => void;
  autoFocus?: boolean;
  /** Every change of the field's text (also the emptying after a send). */
  onValueChange?: (text: string) => void;
  /** Before the bar's own keys; preventDefault keeps Enter from sending. */
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Extra attributes for the field (role="combobox", aria-*). */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
} = {}) {
  const [q, setQ] = useState("");
  const [live, setLive] = useState(false);

  /* ── OPEN ON FOCUS, NOT ON THE FIRST CHARACTER ────────────
     It used to key off content alone: the button appeared with
     the first keystroke and vanished when you deleted it,
     which puts the largest movement in the component in the
     middle of typing — the one moment you are looking at the
     words rather than at the bar.

     Clicking into the field is the moment you have decided to
     send something, so that is when the bar offers the way to.
     Content still counts on its own, so a field filled
     programmatically or restored from a draft opens it too. */
  const has = live || !!q.trim();

  /* ── the split, heard ────────────────────────────────────
     The button leaving and returning is the largest thing this
     component does and it happened in silence. `expand` and
     `collapse` are the bench's two notes for something opening
     and closing, so it uses the same pair every other block
     does rather than inventing a sound of its own.

     A ref, not a plain effect on `has`: it must not fire on
     mount, and it must not fire again while you keep typing —
     only on the frame the state actually flips. */
  const was = useRef(false);
  useEffect(() => {
    if (was.current === has) return;
    was.current = has;
  }, [has]);

  /* ── send, and nothing after it ──────────────────────────
     This used to spend two seconds on "Working..." and then
     unfold a paragraph of invented answer. Neither belonged to
     the component: the shimmer was a loading state for a
     request that never happens, and the answer was a mock of
     somebody else's product wearing this one's clothes. What
     the block is about is the field and the split — so the
     send empties the field, and the button merges back into
     the bar it came from. The gesture has an outcome you can
     see, and it is the component's own. */
  const run = () => {
    /* it is not reachable with nothing to send — it is inside
       the bar and hidden — but Enter still arrives here */
    if (!has) return;
    const text = q.trim();
    if (!text) return;
    if (onSubmit?.(text) === false) return;
    setQ("");
    onValueChange?.("");
  };

  return (
    <div
      style={{ width: 320, "--cmd-r": `${clamp(corner, 0, CMD_CORNER)}px` } as React.CSSProperties}
    >
      {/* OPAQUE FILL. --pane is rgba glass, and the goo's alpha
          contrast erases anything under about 0.39 — a
          translucent bar would not look faint here, it would
          not be drawn at all. Mixed from the fill's own ink and
          ground so it still inverts with the Fill control. */}
      <Liquid
        className="cmd-goo"
        blur={bridge}
        contrast={edge}
        fill="var(--fill-slab, var(--board))"
        /* NO SHADOW AT ALL. It carried a 1px ring first, which
           the Stroke switch could not turn off, and then a soft
           drop shadow — and the bar does not need lifting off
           anything. It is a flat white body on a flat card, and
           the only edge it should ever draw is the one Stroke
           asks for. */
        filterPadding={60}
      >
        {/* x is never set: the bar stays exactly where it is */}
        <Liquid.Item className="cmd-slot" transition={CMD_MORPH}>
          {/* the bar gives up the width the button is taking — see .cmd */}
          <div className="cmd" data-has={has || undefined}>
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
              onFocus={() => setLive(true)}
              /* it closes again when you leave — unless there
                 is something in it, which `has` already covers */
              onBlur={() => setLive(false)}
              onKeyDown={(e) => {
                onInputKeyDown?.(e);
                if (!e.defaultPrevented && e.key === "Enter") run();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
            {/* ── the mic STAYS IN THE BAR ──────────────────
                It used to be the other face of the send button,
                which meant it rode out of the bar on the split:
                the icon you are watching disappear was also
                sliding right while it faded, and the two
                movements read as one confused thing. They are
                different objects with different jobs — the mic
                belongs to the field, the send button is what
                the field produces — so the mic sits still and
                simply goes. */}
            {onDictate && (
              <button
                type="button"
                className="cmd-mic"
                data-show={!has}
                tabIndex={has ? -1 : 0}
                aria-hidden={has}
                aria-label="음성 입력"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onDictate}
              >
                <Microphone size={18} aria-hidden />
              </button>
            )}
          </div>
        </Liquid.Item>

        {/* One slot, two faces. Both are always mounted and
            crossfade in place — swapping the element would
            snap, and the swap is the whole point.

            At rest it is tucked inside the bar's right end and
            reads as a control within it; the first character
            typed pushes it out and the goo necks and breaks. */}
        <Liquid.Item
          className="cmd-slot"
          x={has ? 0 : -CMD_TUCK}
          transition={CMD_MORPH}
        >
          {/* only ever Send. At rest it is tucked inside the
              bar with nothing drawn in it — a body for the goo
              to split from, and nothing else. */}
          <button
            type="button"
            className="cmd-go"
            /* shown on focus, filled once there is something
               to send — see .cmd-go */
            data-on={has}
            data-armed={!!q.trim() || undefined}
            tabIndex={has ? 0 : -1}
            aria-hidden={!has}
            onClick={run}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="검색"
          >
            <ArrowUp size={20} aria-hidden />
          </button>
        </Liquid.Item>
      </Liquid>

    </div>
  );
}

