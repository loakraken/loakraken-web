"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "@/components/ui/icons";
import { analysisLinks } from "@/lib/character/analysis";
import { cn } from "cn";
import styles from "./detail.module.css";

/** CRIT_SPEED_TOOL (server flag): off leaves the calculator out of the menu. */
export const CritSpeedEnabled = createContext(true);

/**
 * 분석 (character screen checklist §14.1 ③): the tools that take this
 * character, beside the tabs. A tab of this page replaces the history entry
 * like the tab links; a tool opens with the character filled in.
 */
export function AnalysisMenu({
  name,
  server,
  specUp,
  simulator,
}: {
  name: string;
  server: string | null | undefined;
  specUp: boolean;
  simulator: boolean;
}) {
  const links = analysisLinks(name, server, { specUp, simulator, critSpeed: useContext(CritSpeedEnabled) });
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.analysisTrigger}>
        분석
        <ChevronDown size={14} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className="isolate z-50 outline-none">
          <Menu.Popup
            className={cn(
              "w-[min(280px,calc(100vw-24px))] p-1 outline-none",
              "rounded-(--radius-md) bg-(--surface-panel) text-foreground shadow-(--shadow-card) ring-1 ring-(--border)",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-(--ease-out)",
              "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100",
              "motion-reduce:transition-none",
            )}
          >
            {links.map((link) => (
              <Menu.LinkItem
                key={link.id}
                render={<Link href={link.href} prefetch={false} replace={link.tab} />}
                className={cn(
                  "grid gap-0.5 rounded-(--radius-sm) px-3 py-2 outline-none select-none",
                  "data-highlighted:bg-muted",
                )}
              >
                <span className="text-(length:--text-body) font-semibold">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
