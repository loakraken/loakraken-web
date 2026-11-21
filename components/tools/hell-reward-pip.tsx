"use client";

// (ours, M52) 지옥 · 나락 보상 in a small always-on-top window (Document Picture-in-Picture). Loaded on the button's
// press only: the tool's first JS does not carry it. The window shows what the page already computed — one state
// source: the page renders this view into the window through a portal, so a price refresh, a new stage or a typed
// value reaches it in the same render, with no second fetch. Nothing runs while it is closed.
import { useEffect } from "react";
import { createPortal } from "react-dom";

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

// The window's own rules, written into it when it opens: a CSS module loaded with this code is not reliably in the
// page's <head> yet when the window copies it. The site's tokens and fonts come from the page's copied stylesheets.
const STYLE = `
.lk-pip{box-sizing:border-box;min-height:100vh;margin:0;padding:14px 14px 16px;background:var(--background);color:var(--foreground);font-family:var(--font-ui);font-size:13px;line-height:1.43}
.lk-pip[data-waiting] dd,.lk-pip[data-waiting] ol{opacity:.45}
.lk-pip h1{margin:0;font-size:15px;font-weight:700;line-height:21px}
.lk-pip-note{margin:6px 0 0;color:var(--destructive);font-size:12px}
.lk-pip dl{display:grid;gap:6px;margin:10px 0 0}
.lk-pip dl>div{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:var(--muted)}
.lk-pip dt{color:var(--muted-foreground);font-size:12px}
.lk-pip dd{margin:0;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.lk-pip-age{color:var(--muted-foreground);font-size:11px;font-weight:500}
.lk-pip ol{display:grid;gap:2px;margin:12px 0 0;padding:0;list-style:none}
.lk-pip li{display:flex;justify-content:space-between;gap:8px;padding:6px 2px;border-bottom:1px solid var(--border)}
.lk-pip li:first-child{font-weight:700}
.lk-pip-amount{flex:none;font-variant-numeric:tabular-nums}
`;

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
  const own = win.document.createElement("style");
  own.textContent = STYLE;
  win.document.head.append(own);
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
    <main className="lk-pip" aria-busy={data.waiting || undefined} data-waiting={data.waiting ? "" : undefined}>
      <h1>{data.title}</h1>
      {data.failed && <p className="lk-pip-note">시세를 불러오지 못했어요. 페이지에서 다시 불러와 주세요.</p>}
      <dl>
        <div>
          <dt>가장 좋은 상자</dt>
          <dd>{data.bestLabel}</dd>
        </div>
        <div>
          <dt>그 상자의 값</dt>
          <dd>
            {data.bestValue}
            {data.age && <span className="lk-pip-age"> {data.age}</span>}
          </dd>
        </div>
        <div>
          <dt>{data.baseLabel}</dt>
          <dd>{data.baseValue}</dd>
        </div>
      </dl>
      <ol aria-label="상자별 값(좋은 순)">
        {data.boxes.map((box) => (
          <li key={box.id}>
            <span>{box.label}</span>
            <span className="lk-pip-amount">{box.amount}</span>
          </li>
        ))}
      </ol>
    </main>,
    win.document.body,
  );
}
