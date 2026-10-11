// (ours) A stand-in for the two pieces of motion/react the Checklist imports,
// `m` and `AnimatePresence`, without the library (PM-프론트 #483 P1: the
// homework first load was +52KB for them).
//
// On a screen the Checklist never moves a row with motion: the fall is the
// wall demo putting itself away (fall=false), the resting target is
// { y: 0, x: 0, rotate: 0 } with initial={false}, and the box and tick run on
// the block's own spring. What is lost is the 0.18s fade of a row that
// leaves; here it leaves at once.
import { createElement, forwardRef, type ForwardRefExoticComponent, type ReactNode, type RefAttributes } from "react";

const MOTION_ONLY = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "variants",
  "layout",
  "layoutId",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "onAnimationStart",
  "onAnimationComplete",
]);

type Props = Record<string, unknown> & { children?: ReactNode };
type Static = ForwardRefExoticComponent<Props & RefAttributes<Element>>;

const cache = new Map<string, Static>();

function element(tag: string): Static {
  let made = cache.get(tag);
  if (!made) {
    made = forwardRef<Element, Props>(function StaticElement(props, ref) {
      const rest: Props = {};
      for (const key in props) if (!MOTION_ONLY.has(key)) rest[key] = props[key];
      return createElement(tag, { ...rest, ref });
    }) as Static;
    cache.set(tag, made);
  }
  return made;
}

/* motion.button, motion.div … as plain elements */
export const m = new Proxy({} as Record<string, Static>, {
  get: (_, tag: string) => element(tag),
});

export function AnimatePresence({ children }: { children?: ReactNode; initial?: boolean }) {
  return <>{children}</>;
}
