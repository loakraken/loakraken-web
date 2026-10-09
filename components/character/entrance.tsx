"use client";

import { createContext, useContext, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const EntranceContext = createContext(false);
const noop = () => () => {};

/**
 * Staggered list entrance (motion guide 7, item 3: equipment, gems, cards,
 * engravings), played once when a character opens on the client — reached by
 * search or a link. A direct load already painted the lists in the server
 * HTML, so they stay put; switching tabs shows the new tab without it (the tab
 * panel has its own short fade), and so does coming back to the first tab.
 */
export function Entrance({ tab, children }: { tab: string; children: ReactNode }) {
  // Server and hydration render: false; a client-side mount: true.
  const clientMount = useSyncExternalStore(noop, () => true, () => false);
  const [first, setFirst] = useState(clientMount ? tab : null);
  // Leaving the first tab ends the entrance for good (state from a prop change).
  if (first !== null && first !== tab) setFirst(null);
  return <EntranceContext value={first !== null}>{children}</EntranceContext>;
}

/**
 * Props for the i-th item of an entering list: `.k-reveal` (#186) with a 30ms
 * step, capped at 8 steps by the utility. Outside an entrance, just the class.
 */
export function useStagger() {
  const on = useContext(EntranceContext);
  return (i: number, className?: string) =>
    on
      ? { className: className ? `${className} k-reveal` : "k-reveal", style: { "--i": i } as CSSProperties }
      : { className };
}
