// Back/forward marks the next hero to mount: it comes back as it was, with no
// entrance (hero.tsx, PM 11-09). popstate sets the mark; the hero's mount clears
// it, and so does every forward navigation: a click on a link, or a push from
// code (the search panel's menu rows) through clearHistoryMark(). Kept tiny and
// apart from hero.tsx, so the header search does not load the hero to use it.

let mark = false;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    mark = true;
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) mark = false;
    },
    true,
  );
}

/** The visitor came back (back/forward) and no hero has mounted since. */
export const cameFromHistory = () => mark;

/** A forward navigation, or a hero that used the mark. */
export function clearHistoryMark() {
  mark = false;
}
