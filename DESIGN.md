# LOAKraken frontend design

Current direction (2026-10-04): Apple-inspired light product website. This supersedes the earlier dark Raycast/Stitch visual direction. The original Stitch composition remains historical reference.

## Visual system

- White `#ffffff` canvas, full-width `#f5f5f7` feature bands, ink `#1d1d1f`, secondary text `#6e6e73`.
- Use `#0066cc` for links and `#0071e3` for compact primary pill buttons. Keep large interface surfaces neutral.
- System typography first, Noto Sans KR fallback; large 600-weight display type, comfortable body copy. Mono is reserved for code.
- Flat 28px feature panels. Group related cockpit metrics through spacing and subtle dividers rather than nested cards.
- The optical shading inside the animated orb is intentional product imagery. Avoid page-wide gradients, neon mesh backgrounds and decorative card shadows.
- Preserve LOAKraken branding. Do not add Apple logos or imply an official Apple affiliation.

## Game imagery

- Character summary is an ILOA-style full-bleed banner under the header: identity, chips (server/class), guild and inline metrics on the left; the official render on the right, sized larger than the band (165% desktop, 400px mobile) and dissolved sideways with a horizontal mask. A soft radial glow uses the render's dominant lit colour.
- The banner tone follows `prefers-color-scheme` in CSS (no first-paint flash). Light: light gradient band with a locally generated backdrop-free render (`cutoutPortrait`: border-connected flood fill + un-blending of soft glow pixels, from a separate anonymous-CORS request). Dark: dark band with the original render, whose baked-in backdrop matches. If the cutout cannot be produced, the banner falls back to the dark tone with the original.
- Show official icons for equipment, gems, cards, Ark Grid cores/gems and Ark Passive/engraving effects on rarity-tinted tiles (normal → esther hues tuned for a light page). Cards use the illustration with awakening pips.
- Load only from `cdn-lostark.game.onstove.com` / `lostark.game.onstove.com` over HTTPS (`safeGameImage`). No proxy, mirror or Next image optimizer; `referrerPolicy="no-referrer"`, fixed dimensions, lazy loading below the banner. The cutout exists only as an in-memory object URL.
- Failed images fall back to text initials or are omitted when there is neither an image nor a grade. While the portrait loads or is processed, a `thinking-orbs` "searching" orb (light/dark variant) sits in the figure area.

## Motion

Keep Libraries.dev `thinking-orbs`, `border-beam` and Motion. Use orbs for waiting/working states (search, calculation, image loading). Use explicit light themes. Preserve breathing/connecting/searching states, orbit, section reveals, tab transitions, pointer springs and feedback.

Pointer springs use stiffness 100 / damping 20. Continuous motion must pause when hidden/offscreen, on user pause, and with reduced-motion preferences. Keyboard navigation should remain immediate. Avoid scroll hijacking or artificial loading delays.

## Product behavior

- Keep search, input validation, encoded character URLs, accessible tabs, evidence disclosure/copy and return links functional during redesigns.
- Clearly label all sample character data. Real API results, rankings, costs and simulation values require verified backend contracts.
- Desktop may show parallel metrics; small screens should stack readable groups. Check 320, 390 and 768px, keyboard use and short desktop viewports.

## Research-led implementation

Before implementing a product area, inspect relevant public flows from LOPEC, ZLOA, LOAWA, ILOA, KLOA, IcePeng, LostBuilds, RLoA, LoaTodo, Lost Ark Inven, LOALAB, Loatto and Loavesting. Record the observed behavior, evidence URL/date, uncertainty and LOAKraken decision. Public menus are not evidence that calculations or logged-in workflows have been verified.

Canonical ongoing notes live in the user's LOAKraken Obsidian vault under `20 프론트엔드`: `프론트엔드 디자인과 모션`, `프론트엔드 통합 서비스 UX 분석`, `프론트엔드 현재 작업` and `프론트엔드 작업 보드`.

## Product roadmap

Keep the nine product areas in `components/landing/roadmap.ts`: comprehensive character observation and history; verified Kraken Score, rankings and statistics; growth priorities and cost efficiency; build simulation; market and calculators; screen recognition assistants for gems, ability stones and raid guidance; roster, tasks and raid management; calendar and wandering merchants; guides and news.

These are planned capabilities, not completed features. Character observation and evidence-based diagnosis come first. History requires a storage policy; scores and predictions require validated models and data. Community integration does not yet imply operating a standalone forum. See `docs/frontend-preview.md` and the Obsidian note `프론트엔드 제품 로드맵` for coverage and limitations.

Additional research and screen-based raid assistance scope: `docs/service-research.md`.
