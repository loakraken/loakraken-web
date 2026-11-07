"use client";
import "./command-bar.css";
import { Liquid } from "liquid-gooey";

/**
 * The command bar's liquid surface on its own (PM 총괄 11-08, option b): a
 * decorative body the size of the bar, drawn under the plain field
 * (command-field.tsx) once the dialog is open and the page is idle. Same
 * library settings as Bencho's command bar (bridge 3, edge 22, opaque fill,
 * no shadow); nothing in it can take focus or a click.
 */
export function LiquidPill() {
  return (
    <div className="cmd-liquid" aria-hidden="true">
      <Liquid className="cmd-goo" blur={3} contrast={22} fill="var(--fill-slab, var(--board))" filterPadding={60}>
        <Liquid.Item className="cmd-slot">
          <div className="cmd-shape" />
        </Liquid.Item>
      </Liquid>
    </div>
  );
}
