// Home page JSON-LD (marketing spec 10-31): the site and its Korean name
// "로아크라켄" for search engines. WebSite + Organization only; no SearchAction
// (the sitelinks search box is retired). Rendered on the server on / only.
import { DISCORD_URL, SITE_NAME } from "./site";

export function siteJsonLd(base: string) {
  const url = `${base.replace(/\/+$/, "")}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: SITE_NAME,
        alternateName: ["로아크라켄", "로아 크라켄", "LOA Kraken"],
        url,
        inLanguage: "ko-KR",
        publisher: { "@id": `${url}#org` },
      },
      {
        "@type": "Organization",
        "@id": `${url}#org`,
        name: SITE_NAME,
        alternateName: "로아크라켄",
        url,
        logo: `${url}apple-icon.png`,
        email: "contact@loakraken.gg",
        sameAs: [DISCORD_URL],
      },
    ],
  };
}

/** JSON for an inline <script>: "<" escaped so the text can never close the tag. */
export const jsonLdText = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
