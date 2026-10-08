"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { NAV_SECTIONS, sectionOf, type NavLink } from "./nav-data";
import styles from "./site-nav.module.css";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 160;

function Entry({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  if (!link.href)
    return (
      <span className={styles.entry} aria-disabled="true">
        <span className={styles.entryLabel}>
          {link.label}
          <em>준비 중</em>
        </span>
        <span className={styles.entryText}>{link.description}</span>
      </span>
    );
  return (
    <Link href={link.href} className={styles.entry} onClick={onNavigate}>
      <span className={styles.entryLabel}>{link.label}</span>
      <span className={styles.entryText}>{link.description}</span>
    </Link>
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
  const current = pathname === "/" ? "about" : sectionOf(pathname);
  const [open, setOpenState] = useState<string | null>(null);
  // Last opened panel stays rendered while the flyout fades out.
  const [shown, setShown] = useState<string | null>(null);
  const setOpen = useCallback((next: string | null) => {
    setOpenState(next);
    if (next) setShown(next);
  }, []);
  const [instant, setInstant] = useState(false);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(null);
  }, [setOpen]);

  useEffect(() => {
    if (!open && !sheet) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) triggers.current.get(open)?.focus();
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
    if (!hoverable()) return;
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
                setOpen(open === section.id ? null : section.id);
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
            <p className={styles.panelTitle}>{section.label}</p>
            <div className={styles.groups}>
              {section.groups.map((group) => (
                <div key={group.title} className={styles.group}>
                  <p className={styles.groupTitle}>{group.title}</p>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Entry link={link} onNavigate={close} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.scrim} data-open={open !== null || undefined} aria-hidden="true" onPointerEnter={leave} />

      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={sheet}
        aria-controls={`${id}-sheet`}
        aria-label={sheet ? "메뉴 닫기" : "메뉴 열기"}
        onClick={() => setSheet(!sheet)}
      >
        {sheet ? <X size={18} /> : <Menu size={18} />}
      </button>
      <div id={`${id}-sheet`} className={styles.sheet} data-open={sheet || undefined} hidden={!sheet}>
        {NAV_SECTIONS.map((section) => (
          <section key={section.id} className={styles.sheetSection}>
            <h2>{section.label}</h2>
            <ul>
              {section.groups.flatMap((group) => group.links).map((link) => (
                <li key={link.label}>
                  <Entry link={link} onNavigate={() => setSheet(false)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
