"use client";

import Link from "next/link";
import { ThinkingOrb } from "thinking-orbs";
import { useTheme } from "@/components/ui/theme-toggle";
import { LandingMotion, useLandingMotion } from "./motion";
import { orbColor } from "./orb";
import styles from "./landing.module.css";

function LoadingContent() {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  return <main className={styles.routeState} aria-busy="true">
    <ThinkingOrb state="searching" size={64} theme={theme} color={orbColor(theme)} paused={!enabled} aria-label="캐릭터 조회 중" />
    <p role="status">캐릭터 정보를 조회하고 있어요.</p>
    <noscript><p>캐릭터 조회 화면을 표시하려면 JavaScript를 켜 주세요. 검색으로 돌아가 예시 화면을 볼 수도 있습니다.</p></noscript>
    <div className={styles.routeLinks}><Link href="/">검색으로 돌아가기</Link></div>
  </main>;
}

export function CharacterLoading() { return <LandingMotion><LoadingContent /></LandingMotion>; }
