import assert from "node:assert/strict";
import test from "node:test";
import { jsonLdText, siteJsonLd } from "../lib/site-jsonld";

test("home JSON-LD: WebSite + Organization with the Korean name, no SearchAction", () => {
  const data = siteJsonLd("https://loakraken.gg/");
  const [site, org] = data["@graph"];
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.url, "https://loakraken.gg/");
  assert.deepEqual(site.alternateName, ["로아크라켄", "로아 크라켄", "LOA Kraken"]);
  assert.equal(org["@type"], "Organization");
  assert.equal(org.alternateName, "로아크라켄");
  assert.equal(org.logo, "https://loakraken.gg/apple-icon.png");
  assert.equal(JSON.stringify(data).includes("SearchAction"), false);
  // A base without the slash gives the same addresses.
  assert.equal(siteJsonLd("https://loakraken.gg")["@graph"][0].url, "https://loakraken.gg/");
});

test("JSON-LD text cannot close its script tag", () => {
  assert.equal(jsonLdText({ a: "</script>" }).includes("</"), false);
});
