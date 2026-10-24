"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Draws its children anew on every page (path), not kept from the last one.
 * The layout's footer stayed the same node across a navigation, so going back
 * (not an input) from a long page to a short one counted its move as a layout
 * shift (멀티서치 → 캐릭터 → 뒤로 at 360, 0.17~0.26). A new node is not a shift.
 */
export function PerRoute({ children }: { children: ReactNode }) {
  return <Fragment key={usePathname()}>{children}</Fragment>;
}
