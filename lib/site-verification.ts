// Search engine ownership tags (Google, Naver) from the server env, so the
// codes stay out of the repository. Only on the production domain, and no
// tag at all for a value that is not set.
import type { Metadata } from "next";
import { isIndexable, siteUrl } from "./site";

type Env = Record<string, string | undefined>;

export function siteVerification(
  env: Env = process.env,
  url: string = siteUrl(),
): Metadata["verification"] | undefined {
  if (!isIndexable(url)) return undefined;
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const naver = env.NAVER_SITE_VERIFICATION?.trim();
  if (!google && !naver) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(naver ? { other: { "naver-site-verification": naver } } : {}),
  };
}
