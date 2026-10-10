// /news page state in the URL: ?tab=patch for the patch history, ?kind= for
// the notice or patch kind. Unknown values fall back to the whole list.
import { NOTICE_LABEL, isPatchCategory, type Notice, type PatchCategory } from "./model";

export type NewsTab = "notice" | "patch";
export type NoticeKind = NonNullable<Notice["category"]>;

export const NOTICE_KINDS = Object.keys(NOTICE_LABEL) as NoticeKind[];
const isNoticeKind = (value: string | null): value is NoticeKind =>
  !!value && Object.hasOwn(NOTICE_LABEL, value);

export function readNewsQuery(params: { get(name: string): string | null }): {
  tab: NewsTab;
  noticeKind: NoticeKind | null;
  patchKind: PatchCategory | null;
} {
  const tab: NewsTab = params.get("tab") === "patch" ? "patch" : "notice";
  const kind = params.get("kind");
  return {
    tab,
    noticeKind: tab === "notice" && isNoticeKind(kind) ? kind : null,
    patchKind: tab === "patch" && isPatchCategory(kind) ? kind : null,
  };
}

export function newsPath(tab: NewsTab, kind: string | null) {
  const params = new URLSearchParams();
  if (tab === "patch") params.set("tab", "patch");
  if (kind) params.set("kind", kind);
  const search = params.toString();
  return `/news${search ? `?${search}` : ""}`;
}
