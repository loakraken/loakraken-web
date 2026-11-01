"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CloseCircle, Menu } from "@/components/ui/icons";
import { NAV_SECTIONS, sectionOf, type NavFlags, type NavLink } from "./nav-data";
import { useNavFlags, visible } from "./nav-flags";
import styles from "./site-nav.module.css";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 160;

function Entry({ link, onNavigate }: { link: NavLink & { href: string }; onNavigate: () => void }) {
  return (
    <Link href={link.href} className={styles.entry} onClick={onNavigate}>
      <span className={styles.entryLabel}>{link.label}</span>
      <span className={styles.entryText}>{link.description}</span>
    </Link>
  );
}

// The flyout is closed while the flags load (nav-flags.ts), so nothing shifts.
const live = (links: NavLink[], flags: NavFlags) =>
  links.filter((link): link is NavLink & { href: string } => !!link.href && visible(link, flags));
const planned = (links: NavLink[]) => links.filter((link) => !link.href).map((link) => link.label);

const columns = (count: number) =>
  count >= 3 ? { "data-columns": true, style: { "--columns": count } as CSSProperties } : {};

/** Planned features folded into one quiet line instead of a list of dead entries. */
function Soon({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <p className={styles.soon}>
      <span>곧 추가</span>
      {labels.join(" · ")}
    </p>
  );
}

/**
 * Site-wide top menu. Desktop: tabs that open a full-width flyout on hover
 * (after a short intent delay; switching between tabs is then instant) or on
 * click/Enter/ArrowDown. Mobile: one full-screen sheet with every section.
 */
export function SiteNav() {
  const id = useId();
  const pathname = usePathname();
  const current = pathname === "/about" ? "about" : sectionOf(pathname);
  const flags = useNavFlags();
  const [open, setOpenState] = useState<string | null>(null);
  // Last opened panel stays rendered while the flyout fades out.
  const [shown, setShown] = useState<string | null>(null);
  // A click (or ↓) pins the flyout (user 11-01): leaving it with the pointer
  // no longer closes it; another click on the open tab, Esc, an outside
  // click or a link closes it. Hover alone still previews.
  const [pinned, setPinned] = useState(false);
  const setOpen = useCallback((next: string | null) => {
    setOpenState(next);
    if (next) setShown(next);
    else setPinned(false);
  }, []);
  const [instant, setInstant] = useState(false);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const menuButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(null);
  }, [setOpen]);

  useEffect(() => {
    if (!open && !sheet) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) triggers.current.get(open)?.focus();
      if (sheet) menuButton.current?.focus();
      setOpen(null);
      setSheet(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, sheet, setOpen]);

  useEffect(() => {
    document.documentElement.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [sheet]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const hoverable = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function enter(sectionId: string) {
    if (!hoverable()) return;
    clearTimeout(timer.current);
    if (open) {
      setInstant(true);
      setOpen(sectionId);
      return;
    }
    timer.current = setTimeout(() => {
      setInstant(false);
      setOpen(sectionId);
    }, OPEN_DELAY);
  }

  function leave() {
    if (!hoverable() || pinned) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
  }

  function focusFirst(sectionId: string) {
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-panel="${sectionId}"] a`)
        ?.focus(),
    );
  }

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>, sectionId: string) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setInstant(true);
      setOpen(sectionId);
      setPinned(true);
      focusFirst(sectionId);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const ids = NAV_SECTIONS.map((s) => s.id);
      const next = ids[(ids.indexOf(sectionId) + (event.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
      triggers.current.get(next)?.focus();
      if (open) setOpen(next);
    }
  }

  return (
    <div ref={root} className={styles.root} onPointerLeave={leave} onPointerEnter={() => clearTimeout(timer.current)}>
      <ul className={styles.tabs}>
        {NAV_SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              ref={(node) => {
                if (node) triggers.current.set(section.id, node);
              }}
              type="button"
              className={styles.tab}
              aria-expanded={open === section.id}
              aria-controls={`${id}-${section.id}`}
              data-current={current === section.id || undefined}
              onPointerEnter={() => enter(section.id)}
              onClick={() => {
                clearTimeout(timer.current);
                setInstant(true);
                // A click on a tab only hovered open pins it; on the pinned tab it closes.
                if (pinned && open === section.id) setOpen(null);
                else {
                  setOpen(section.id);
                  setPinned(true);
                }
              }}
              onKeyDown={(event) => onTriggerKey(event, section.id)}
            >
              {section.label}
              <ChevronDown size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.flyout} data-open={open !== null || undefined} data-instant={instant || undefined}>
        {NAV_SECTIONS.map((section) => (
          <div
            key={section.id}
            id={`${id}-${section.id}`}
            className={styles.panel}
            data-panel={section.id}
            hidden={shown !== section.id}
          >
            <div className={styles.panelHead}>
              <p className={styles.panelTitle}>{section.label}</p>
              {section.all && (
                <Link href={section.all.href} className={styles.panelAll} onClick={close}>
                  {section.all.label}
                </Link>
              )}
            </div>
            <div
              className={styles.groups}
              // Three or more groups: one equal column each across the panel,
              // none spanning two (user 10-25: use the empty right side).
              {...columns(section.groups.filter((group) => live(group.links, flags).length).length)}
            >
              {section.groups
                .filter((group) => live(group.links, flags).length)
                .map((group) => (
                  <div key={group.title} className={styles.group}>
                    {/* A hub's title opens the hub page (its first tab). */}
                    {group.href ? (
                      <Link href={group.href} className={`${styles.groupTitle} ${styles.groupLink}`} onClick={close}>
                        {group.title}
                      </Link>
                    ) : (
                      <p className={styles.groupTitle}>{group.title}</p>
                    )}
                    <ul>
                      {live(group.links, flags).map((link) => (
                        <li key={link.label}>
                          <Entry link={link} onNavigate={close} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              <Soon labels={planned(section.groups.flatMap((group) => group.links))} />
            </div>
          </div>
        ))}
      </div>
      {/* The dimmed page is outside the menu: a press there closes a pinned flyout too. */}
      <div
        className={styles.scrim}
        data-open={open !== null || undefined}
        aria-hidden="true"
        onPointerEnter={leave}
        onPointerDown={close}
      />

      <button
        ref={menuButton}
        type="button"
        className={`${styles.menuButton} hit-44`}
        aria-expanded={sheet}
        aria-controls={`${id}-sheet`}
        aria-label={sheet ? "메뉴 닫기" : "메뉴 열기"}
        onClick={() => setSheet(!sheet)}
      >
        {sheet ? <CloseCircle size={18} /> : <Menu size={18} />}
      </button>
      <div id={`${id}-sheet`} className={styles.sheet} data-open={sheet || undefined} hidden={!sheet}>
        {NAV_SECTIONS.map((section) => (
          <section key={section.id} className={styles.sheetSection}>
            <h2>{section.label}</h2>
            {section.all && (
              <ul>
                <li>
                  <Entry link={section.all} onNavigate={() => setSheet(false)} />
                </li>
              </ul>
            )}
            {section.sheetGroups ? (
              section.groups
                .filter((group) => live(group.links, flags).length)
                .map((group) => (
                  <div key={group.title}>
                    {group.href ? (
                      <Link
                        href={group.href}
                        className={`${styles.sheetGroup} ${styles.groupLink}`}
                        onClick={() => setSheet(false)}
                      >
                        {group.title}
                      </Link>
                    ) : (
                      <p className={styles.sheetGroup}>{group.title}</p>
                    )}
                    <ul>
                      {live(group.links, flags).map((link) => (
                        <li key={link.label}>
                          <Entry link={link} onNavigate={() => setSheet(false)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            ) : (
              <ul>
                {live(section.groups.flatMap((group) => group.links), flags).map((link) => (
                  <li key={link.label}>
                    <Entry link={link} onNavigate={() => setSheet(false)} />
                  </li>
                ))}
              </ul>
            )}
            <Soon labels={planned(section.groups.flatMap((group) => group.links))} />
          </section>
        ))}
      </div>
    </div>
  );
}
