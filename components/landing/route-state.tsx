"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { OrbStill } from "./orb-still";
import { useTheme } from "@/components/ui/theme-toggle";
import { LandingMotion, useLandingMotion } from "./motion";
import { orbColor } from "./orb";
import styles from "./landing.module.css";

// useSyncExternalStore with nothing to subscribe to: only its server / client snapshots matter.
const noop = () => () => {};

function LoadingContent() {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  // The server's HTML carries the still frame: on a direct load this screen is the fallback of a page
  // still on its way, which React never hydrates, so the canvas cannot draw and the still stays for
  // the whole wait. A screen the browser renders itself (in-app navigation) has no still: its canvas draws.
  const live = useSyncExternalStore(noop, () => true, () => false);
  return <main className={styles.routeState} aria-busy="true">
    <span className={styles.orbBox}>
      {!live && <OrbStill className={styles.orbStill} />}
      <ThinkingOrb state="searching" size={64} theme={theme} color={orbColor(theme)} paused={!enabled} aria-label="캐릭터 조회 중" />
    </span>
    <p role="status">캐릭터 정보를 조회하고 있어요.</p>
    <noscript><p>캐릭터 조회 화면을 표시하려면 JavaScript를 켜 주세요. 검색으로 돌아가 예시 화면을 볼 수도 있습니다.</p></noscript>
    {/* The link is sized from its label at the start tag (data-fp-label): centred, a link drawn before
        its text widened from 42 to 142px when the text came (combat-aside-order:10 @320). */}
    <div className={styles.routeLinks}><Link href="/" data-fp-label="검색으로 돌아가기"><span>검색으로 돌아가기</span></Link></div>
  </main>;
}

export function CharacterLoading() { return <LandingMotion><LoadingContent /></LandingMotion>; }
