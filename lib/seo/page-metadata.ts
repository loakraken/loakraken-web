import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

/** The site's share image (app/opengraph-image.png, 1200×630). */
export const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "LOAKraken — 로스트아크 캐릭터 정보·시세·성장 도구",
} as const;

/** The title as a share card shows it: the root template ("%s | LOAKraken") applied, or an absolute title as is. */
function shareTitle(title: Metadata["title"]): string | undefined {
  if (typeof title === "string") return `${title} | ${SITE_NAME}`;
  if (title && typeof title === "object" && "absolute" in title && typeof title.absolute === "string")
    return title.absolute;
  return undefined;
}

/**
 * A page's metadata with its share cards filled from it. A page's own
 * `openGraph` replaces the root one whole (Next merges top-level keys only),
 * so without this every page shared the home card, and a page that set its
 * own (dev notes) lost the image. Pass what the page already sets (title,
 * description, alternates.canonical); anything it sets in `openGraph` or
 * `twitter` still wins.
 */
export function pageMetadata(meta: Metadata): Metadata {
  const title = shareTitle(meta.title);
  const description = typeof meta.description === "string" ? meta.description : undefined;
  const canonical = meta.alternates?.canonical;
  const url = typeof canonical === "string" ? canonical : canonical instanceof URL ? canonical.toString() : undefined;
  const shared = {
    ...(title && { title }),
    ...(description && { description }),
  };
  return {
    ...meta,
    openGraph: {
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      ...shared,
      ...(url && { url }),
      images: [OG_IMAGE],
      ...meta.openGraph,
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      ...shared,
      images: [OG_IMAGE.url],
      ...meta.twitter,
    } as Metadata["twitter"],
  };
}
