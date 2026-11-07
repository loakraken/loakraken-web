// The last compared list is shared by the open tabs of this site and forgotten
// when the last of them closes (user 11-08). Each tab keeps its own copy in
// sessionStorage; the tabs talk over a BroadcastChannel (no cookie, nothing
// on a server). A new tab with no list asks; any open tab that has one
// answers. Every change is sent to the others, so all open tabs stay alike.
// Without BroadcastChannel (old browsers) a tab simply keeps its own list.
//
// Kept apart from the multi-search model so the site-wide listener stays tiny:
// the list travels as the raw comma-joined text the address uses.

export const LAST_KEY = "loakraken:multi-search";
const CHANNEL = "loakraken:multi-search";

type Message = { type: "ask" } | { type: "answer"; list: string } | { type: "list"; list: string };

let channel: BroadcastChannel | null | undefined;
function open(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;
  } catch {
    channel = null;
  }
  return channel;
}

export function readStored(): string {
  try {
    return sessionStorage.getItem(LAST_KEY) ?? "";
  } catch {
    return "";
  }
}

function store(list: string) {
  try {
    if (list) sessionStorage.setItem(LAST_KEY, list);
    else sessionStorage.removeItem(LAST_KEY);
  } catch {
    /* Storage blocked: the list simply is not remembered. */
  }
}

/** Keep this tab's list and tell the other open tabs ("" = cleared). */
export function storeAndShare(list: string) {
  store(list);
  open()?.postMessage({ type: "list", list } satisfies Message);
}

/**
 * Every page of the site: answer a new tab's ask with this tab's list, and
 * take the lists the other tabs change to. Returns the stop function.
 */
export function listenForOpenTabs() {
  const ch = open();
  if (!ch) return () => {};
  const onMessage = (event: MessageEvent<Message>) => {
    const message = event.data;
    if (message?.type === "list" && typeof message.list === "string") store(message.list);
    else if (message?.type === "ask") {
      const list = readStored();
      if (list) ch.postMessage({ type: "answer", list } satisfies Message);
    }
  };
  ch.addEventListener("message", onMessage);
  // A tab opened while another holds a list takes it now, so it keeps it
  // even if that tab closes before this one opens the multi-search page.
  if (!readStored()) void askOpenTabs();
  return () => ch.removeEventListener("message", onMessage);
}

/**
 * A tab with no list asks the open tabs. The first answer within `wait` ms
 * becomes this tab's list too; none (no other tab, or none has a list): "".
 */
export function askOpenTabs(wait = 150): Promise<string> {
  const ch = open();
  if (!ch) return Promise.resolve("");
  return new Promise((resolve) => {
    const done = (list: string) => {
      clearTimeout(timer);
      ch.removeEventListener("message", onMessage);
      resolve(list);
    };
    const onMessage = (event: MessageEvent<Message>) => {
      const message = event.data;
      if ((message?.type === "answer" || message?.type === "list") && typeof message.list === "string" && message.list) {
        store(message.list);
        done(message.list);
      }
    };
    const timer = setTimeout(() => done(""), wait);
    ch.addEventListener("message", onMessage);
    ch.postMessage({ type: "ask" } satisfies Message);
  });
}

/** Tests only: drop the channel so the next call opens a fresh one. */
export function closeChannelForTests() {
  channel?.close();
  channel = undefined;
}
