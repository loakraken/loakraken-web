"use client";

// (ours, M52) 지옥 · 나락 보상 in a small always-on-top window (Document Picture-in-Picture). Loaded on the button's
// press only: the tool's first JS does not carry it. The window shows what the page already computed — one state
// source: the page renders this view into the window through a portal, so a price refresh, a new stage or a typed
// value reaches it in the same render, with no second fetch. Nothing runs while it is closed.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./hell-reward-pip.module.css";

/** What the window shows: the page's own figures, already formatted. */
export type HellPipData = {
  title: string;
  bestLabel: string;
  bestValue: string;
  age: string;
  baseLabel: string;
  baseValue: string;
  boxes: { id: string; label: string; amount: string }[];
  /** Prices (or the stored values) not in yet: the figures are not final. */
  waiting: boolean;
  failed: boolean;
};

type DocumentPip = { requestWindow(options: { width: number; height: number }): Promise<Window> };

/** The page's <html> attributes (theme, motion, font classes) onto the window's, so its tokens and fonts match. */
function copyRootLook(win: Window) {
  const from = document.documentElement;
  const to = win.document.documentElement;
  for (const { name } of [...to.attributes]) if (!from.hasAttribute(name)) to.removeAttribute(name);
  for (const { name, value } of [...from.attributes]) to.setAttribute(name, value);
  win.document.body.className = document.body.className;
}

/** Opens the window (the caller's click is the user gesture) and gives it the page's styles and theme. */
export async function openPipWindow(): Promise<Window> {
  const pip = (window as unknown as { documentPictureInPicture: DocumentPip }).documentPictureInPicture;
  const win = await pip.requestWindow({ width: 320, height: 440 });
  for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style')) win.document.head.append(node.cloneNode(true));
  win.document.title = "지옥 · 나락 보상";
  copyRootLook(win);
  return win;
}

/** The result inside the window. `onClose` runs when the window goes (closed by the user, or by the page). */
export function HellPip({ win, data, onClose }: { win: Window; data: HellPipData; onClose: () => void }) {
  useEffect(() => {
    win.addEventListener("pagehide", onClose);
    // A theme change on the page while the window is open.
    const watch = new MutationObserver(() => copyRootLook(win));
    watch.observe(document.documentElement, { attributes: true });
    return () => {
      win.removeEventListener("pagehide", onClose);
      watch.disconnect();
    };
  }, [win, onClose]);
  return createPortal(
    <main className={styles.pip} aria-busy={data.waiting || undefined} data-waiting={data.waiting ? "" : undefined}>
      <h1 className={styles.title}>{data.title}</h1>
      {data.failed && <p className={styles.note}>시세를 불러오지 못했어요. 페이지에서 다시 불러와 주세요.</p>}
      <dl className={styles.sums}>
        <div>
          <dt>가장 좋은 상자</dt>
          <dd>{data.bestLabel}</dd>
        </div>
        <div>
          <dt>그 상자의 값</dt>
          <dd>
            {data.bestValue}
            {data.age && <span className={styles.age}> {data.age}</span>}
          </dd>
        </div>
        <div>
          <dt>{data.baseLabel}</dt>
          <dd>{data.baseValue}</dd>
        </div>
      </dl>
      <ol className={styles.boxes} aria-label="상자별 값(좋은 순)">
        {data.boxes.map((box) => (
          <li key={box.id}>
            <span>{box.label}</span>
            <span className={styles.amount}>{box.amount}</span>
          </li>
        ))}
      </ol>
    </main>,
    win.document.body,
  );
}
