// #418: addresses go out inside an email_off marker the production edge
// leaves alone; only plain addresses, escaped, ever become HTML.
import assert from "node:assert/strict";
import test from "node:test";
import { emailLinkHtml } from "../components/ui/email-link";
import { parseInline } from "../lib/dev-notes/model";

test("a plain address becomes a mailto link inside email_off, with an escaped subject", () => {
  assert.equal(
    emailLinkHtml("contact@loakraken.gg"),
    '<!--email_off--><a href="mailto:contact@loakraken.gg">contact@loakraken.gg</a><!--/email_off-->',
  );
  assert.equal(
    emailLinkHtml("privacy@loakraken.gg", "열람 요청 & \"확인\""),
    `<!--email_off--><a href="mailto:privacy@loakraken.gg?subject=${encodeURIComponent('열람 요청 & "확인"')}">privacy@loakraken.gg</a><!--/email_off-->`,
  );
});

test("anything but a plain address never becomes HTML", () => {
  for (const value of [
    'a@b.cc"><script>alert(1)</script>',
    "<img src=x onerror=alert(1)>@a.cc",
    "javascript:alert(1)@a.cc",
    "no-at-sign.cc",
    "a@b",
    "a b@c.cc",
    "",
  ])
    assert.equal(emailLinkHtml(value), null, value);
});

test("a note's text: an address standing alone is an email part, the rest stays text", () => {
  assert.deepEqual(parseInline("의견은 contact@loakraken.gg 로 보내 주세요."), [
    { t: "text", v: "의견은 " },
    { t: "email", v: "contact@loakraken.gg" },
    { t: "text", v: " 로 보내 주세요." },
  ]);
  // At the end of a sentence the full stop is not part of it.
  assert.deepEqual(parseInline("메일: a.b@c.co.kr."), [
    { t: "text", v: "메일: " },
    { t: "email", v: "a.b@c.co.kr" },
    { t: "text", v: "." },
  ]);
  // Inside code it stays code.
  assert.deepEqual(parseInline("`x@y.cc`"), [{ t: "code", v: "x@y.cc" }]);
});
