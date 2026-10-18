// An e-mail address as a mailto link that the edge leaves alone. The
// production edge rewrites addresses in the HTML (Cloudflare Email Address
// Obfuscation also rewrites an <a href="mailto:…">), so the page the browser
// hydrated no longer matched the server's and React threw #418 (개발자 노트).
// Its documented way out is an email_off comment around the address; React
// cannot write comments, so this one small piece is set as HTML, which React
// also leaves as it is when it hydrates. Only addresses that pass the strict
// pattern below go in, escaped: code constants and addresses picked out of a
// note's own text, never anything a visitor typed.

/** Letters, digits and . _ % + - before the @; a dotted domain after it. */
export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The HTML for one address (exported for its test); null when it is not a plain address. */
export function emailLinkHtml(address: string, subject?: string): string | null {
  if (!EMAIL.test(address)) return null;
  const href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return `<!--email_off--><a href="${escape(href)}">${escape(address)}</a><!--/email_off-->`;
}

export function EmailLink({ address, subject }: { address: string; subject?: string }) {
  const html = emailLinkHtml(address, subject);
  if (!html) return address;
  return <span data-slot="email-link" dangerouslySetInnerHTML={{ __html: html }} />;
}
