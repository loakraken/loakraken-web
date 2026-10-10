/**
 * Clicks that land before hydration (web #109 follow-up). Until React attaches
 * to the page, a button has no handler and a tap on it does nothing — on a slow
 * phone that window is a second or more after the page is painted. This inline
 * script remembers the buttons tapped in that window; once hydration is done
 * `replayEarlyClicks()` clicks them again, in order. Taps after React attached
 * are React's own (it replays those itself), so recording stops there. Only
 * plain buttons (type="button"): links and forms already work without script.
 * A button whose press costs something (official API calls) opts out with
 * `data-no-replay`: a late, unseen press should not spend that.
 */
export const earlyClickScript = `(function(){
var q=[];window.__lkEarlyClicks=q;
function attached(){var k=Object.keys(document);for(var i=0;i<k.length;i++)if(k[i].indexOf("__reactContainer")===0)return true;return false;}
function on(e){
if(window.__lkHydrated||attached()){document.removeEventListener("click",on,true);return;}
var b=e.target&&e.target.closest&&e.target.closest('button[type="button"]:not([data-no-replay])');
if(b&&!b.disabled&&b.getAttribute("aria-disabled")!=="true"&&q.length<5)q.push(b);
}
document.addEventListener("click",on,true);
})();`;

type EarlyClickWindow = Window & { __lkEarlyClicks?: HTMLElement[]; __lkHydrated?: boolean };

/** Call once after hydration (root effect). */
export function replayEarlyClicks() {
  const w = window as EarlyClickWindow;
  w.__lkHydrated = true;
  const queue = w.__lkEarlyClicks ?? [];
  w.__lkEarlyClicks = undefined;
  for (const button of queue) if (button.isConnected) button.click();
}
