"use client";

// The /about hero (title, bot), also at the top of the home page (user,
// 11:05), where it carries the BorderBeam character search. /about has no
// search of its own (user, 11-08): the header's shared search (Ctrl K) is the
// one there. The bot follows the pointer anywhere in the
// window, header included (user, 11-02), and falls asleep 5 s after the last
// move (see BotMascot); pressing it pauses the page's automatic motion and
// never its following (user, 11-01).

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BorderBeam } from "border-beam";
import { ArrowDown, ArrowRight, Command, SearchNormal } from "@/components/ui/icons";
import { useTheme } from "@/components/ui/theme-toggle";
import { InlineOrb } from "./orb";
import { BotMascot } from "@/components/bot/bot-mascot";
import { BotPicker } from "@/components/bot/bot-picker";
import { useChosenBot, useChosenWear } from "@/components/bot/use-chosen-bot";
import { useLandingMotion, useReducedMotion, useVisible } from "./motion-context";
import { characterNameError, normalizeCharacterName } from "@/lib/character/model";
import styles from "./landing.module.css";

const noSubscribe = () => () => {};
// Platform is unknown during SSR; render the hint only after hydration to avoid a mismatch.
const platformKey = () => (/mac|iphone|ipad/i.test(navigator.platform) ? "mac" : "other");

export function Hero({
  embedded = false,
}: {
  /** On the home page: the page has its own h1, and the hero carries the
   *  character search (only the error slot under it, user 19:4x). */
  embedded?: boolean;
}) {
  const shortcutKey = useSyncExternalStore(noSubscribe, platformKey, () => null);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const hero = useRef<HTMLElement>(null);
  const heroVisible = useVisible(hero);
  const { looping, paused, togglePaused } = useLandingMotion();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  // Each focus of the search box (click, tap or Tab) asks the bot for one hop.
  const [focusHops, setFocusHops] = useState(0);
  // Each name the search box can't take (the format error) gets one puzzled tilt.
  const [tilts, setTilts] = useState(0);
  // The error puts focus back in the box: that focus is not the visitor's, so no hop.
  const refocus = useRef(false);
  const Title = embedded ? "h2" : "h1";
  // A block the /about intro builds (never on the home page's embedded hero).
  const build = (kind: "text" | "box" | "keep") => (embedded ? {} : { "data-build-block": "", "data-build-kind": kind });
  const theme = useTheme();
  const [bot] = useChosenBot();
  const [wear] = useChosenWear();
  // The bot pauses the page's repeating motion (WCAG 2.2.2; user, 20:58: no
  // separate stop button). One fixed name with aria-pressed. With reduced
  // motion nothing moves, so it is only a picture.
  const Stage = reduced ? "div" : "button";

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      // Only with the search here (home): elsewhere the header's Ctrl K opens its own.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && input.current) {
        event.preventDefault();
        input.current?.scrollIntoView({ behavior: "instant", block: "center" });
        input.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [input]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeCharacterName(query);
    const issue = characterNameError(name);
    if (issue) {
      setError(issue);
      setTilts((n) => n + 1);
      if (document.activeElement !== input.current) refocus.current = true;
      input.current?.focus();
      return;
    }
    setError(""); setSearching(true);
    router.push(`/character/${encodeURIComponent(name)}`);
  }

  return (
    <section ref={hero} className={embedded ? `${styles.hero} ${styles.heroEmbedded}` : styles.hero} id={embedded ? undefined : "intro"} aria-labelledby="hero-heading" data-in-view={heroVisible} data-build-section={embedded ? undefined : "intro"}>
      <div className={styles.heroContent}>
        <div className={`${styles.statusPill} ${styles.heroEnter}`} {...build("text")}>LOAKraken</div>
        <Title className={`${styles.heroTitle} ${styles.heroEnter}`} id="hero-heading" {...build("keep")}>당신의 캐릭터.<br /><span>가능성을 더 선명하게.</span></Title>
        <p className={`${styles.heroDescription} ${styles.heroEnter}`} {...build("keep")}>지금의 세팅부터 다음 성장까지.<br />흩어진 정보를 모아, 더 명확한 선택으로.</p>
        {/* /about only: one line naming the site with its Korean name (marketing spec 10-31). */}
        {!embedded && (
          <p className={`${styles.heroAbout} ${styles.heroEnter}`} {...build("keep")}>
            LOAKraken(로아크라켄)은 로스트아크 공식 Open API의 공개 정보로 캐릭터·시세·통계·성장 도구를 보여 주는 무료 팬 사이트입니다.
          </p>
        )}
        {/* No frame around the bot (user, 11-01): it stands on a soft shadow. */}
        <div className={styles.orbInteraction} {...build("box")}>
          <Stage
            className={styles.orbStage}
            {...(reduced
              ? { "aria-hidden": true }
              : { type: "button" as const, "aria-label": "애니메이션 멈춤", "aria-pressed": paused, onClick: togglePaused })}
          >
            <BotMascot type={bot} state={searching ? "working" : "default"} size={150} follow
              paused={!looping} still={reduced} theme={theme} decorative hopOn={focusHops}
              wear={wear} lookAt={input} looking={focused} tiltOn={tilts} />
          </Stage>
          <div className={styles.botPicker}><BotPicker theme={theme} /></div>
        </div>
        <p className={styles.orbCaption} {...build("text")}><span className={styles.statusDot} />{searching ? "캐릭터 화면으로 이동하고 있어요" : focused ? "어떤 캐릭터를 살펴볼까요?" : "당신의 다음 선택을 기다리고 있어요"}</p>
        {embedded && <div className={styles.searchArea}>
          <BorderBeam className={styles.searchBeam} theme={theme} colorVariant="mono" staticColors size="line" duration={5} strength={focused ? 0.55 : 0.22} active={looping && heroVisible} borderRadius={36}>
            <form className={styles.searchForm} onSubmit={search} noValidate aria-busy={searching}>
              <label htmlFor="character-search" className={styles.srOnly}>캐릭터 이름</label>
              <SearchNormal className={styles.searchIcon} size={19} aria-hidden="true" />
              <input ref={input} id="character-search" name="character" value={query} onChange={(event) => { setQuery(event.target.value); if (error) setError(""); }}
                onFocus={() => {
                  setFocused(true);
                  if (refocus.current) refocus.current = false;
                  else setFocusHops((n) => n + 1);
                }} onBlur={() => setFocused(false)} placeholder="캐릭터 이름을 입력하세요" maxLength={65} autoComplete="off" spellCheck={false} disabled={searching} aria-invalid={!!error} aria-describedby={error ? "search-error" : undefined} />
              {shortcutKey && <kbd className={styles.shortcut} aria-hidden="true">{shortcutKey === "mac" ? <Command size={12} /> : "Ctrl"} K</kbd>}
              <button className={styles.searchSubmit} type="submit" disabled={searching} aria-label={searching ? "캐릭터 화면으로 이동 중" : undefined}>{searching ? <InlineOrb /> : <>캐릭터 검색 <ArrowRight size={16} /></>}</button>
            </form>
          </BorderBeam>
          <div className={styles.searchMessage} aria-live="polite">{error ? <p id="search-error" className={styles.error}>{error}</p> : null}</div>
        </div>}
      </div>
      {!embedded && <a className={styles.exploreLink} href="#preview">캐릭터 화면 미리보기 <ArrowDown size={16} /></a>}
    </section>
  );
}
