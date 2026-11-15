// Font states for specs that mean "the site font did not arrive" (display: optional keeps the system face for
// that visit). Since #1753 the stack has metric-matched fallbacks ("Kraken Fallback Win" / "Kraken Fallback
// Linux", app/globals.css) that draw at the site font's widths on Windows and Linux, so a blocked font alone no
// longer gives a face of other widths. Specs about the system face as such (as macOS, Android or any device
// without those faces paints) pin the stack without them here; fallback-font-fit.spec checks the matched faces.

/** The UI stack before #1753: the site font first, then the system faces at their own sizes. */
export const UNTUNED_FONT_UI =
  ':root { --font-ui: var(--font-kraken, "Kraken Sans"), -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", "Malgun Gothic", sans-serif !important; }';

/**
 * Every page of `target` (a page or a browser context) uses the untuned stack from its first paint: an adopted
 * stylesheet, so nothing is added to the HTML React hydrates.
 */
export const useUntunedSystemFace = (target) =>
  target.addInitScript((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, UNTUNED_FONT_UI);

/**
 * How the page draws now: `site` when the site font draws the UI text, `untuned` when the stack has no matched
 * fallback (useUntunedSystemFace) and the site font does not draw, `matched` otherwise. Measured, not read from
 * load states: a face can be loaded yet unused under display: optional. No wait on document.fonts.ready: specs
 * that hold the font file back would never see it settle.
 */
export const drawnFace = (page) =>
  page.evaluate(() => {
    const width = (family) => {
      const span = document.createElement("span");
      span.textContent = "가나다 1,780.83G";
      Object.assign(span.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontSize: "15px", fontWeight: "700" });
      if (family) span.style.fontFamily = family;
      document.body.append(span);
      const w = span.getBoundingClientRect().width;
      span.remove();
      return w;
    };
    if (Math.abs(width("") - width("kraken")) < 0.01) return "site";
    return getComputedStyle(document.body).fontFamily.includes("Kraken Fallback") ? "matched" : "untuned";
  });
