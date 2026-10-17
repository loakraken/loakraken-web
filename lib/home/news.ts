// /news page state in the URL: ?tab=patch for the patch history, ?tab=dev for
// LOAKraken 개발자 노트, ?kind= for the notice or patch kind. Unknown values
// fall back to the whole list.
import { NOTICE_LABEL, isPatchCategory, type Notice, type PatchCategory } from "./model";

export type NewsTab = "notice" | "patch" | "dev";
export type NoticeKind = NonNullable<Notice["category"]>;

export const NOTICE_KINDS = Object.keys(NOTICE_LABEL) as NoticeKind[];
const isNoticeKind = (value: string | null): value is NoticeKind =>
  !!value && Object.hasOwn(NOTICE_LABEL, value);

export function readNewsQuery(params: { get(name: string): string | null }): {
  tab: NewsTab;
  noticeKind: NoticeKind | null;
  patchKind: PatchCategory | null;
} {
  const asked = params.get("tab");
  const tab: NewsTab = asked === "patch" || asked === "dev" ? asked : "notice";
  const kind = params.get("kind");
  return {
    tab,
    noticeKind: tab === "notice" && isNoticeKind(kind) ? kind : null,
    patchKind: tab === "patch" && isPatchCategory(kind) ? kind : null,
  };
}

export function newsPath(tab: NewsTab, kind: string | null) {
  const params = new URLSearchParams();
  if (tab !== "notice") params.set("tab", tab);
  if (kind) params.set("kind", kind);
  const search = params.toString();
  return `/news${search ? `?${search}` : ""}`;
}
