"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Focus } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import styles from "./landing.module.css";

export function CharacterRouteState({ characterName }: { characterName: string }) {
  return (
    <main className={styles.routeState}>
      <Focus size={32} color="#0066cc" style={{ margin: "0 auto" }} aria-hidden="true" />
      <span className={styles.eyebrow}>캐릭터 미리보기</span>
      <h1>{characterName}님의 관측 화면</h1>
      <p>캐릭터 데이터 연결을 준비하고 있습니다.<br />현재는 디자인 미리보기 단계로, 입력한 캐릭터의 실제 정보는 조회하지 않습니다. 예시 콕핏에서 화면을 먼저 살펴보세요.</p>
      <div className={styles.routeLinks}>
        <Link href="/#intro"><ArrowLeft size={15} /> 다른 캐릭터 입력</Link>
        <Link href="/#preview">예시 콕핏 보기 <ArrowRight size={15} /></Link>
      </div>
    </main>
  );
}

export function CharacterLoading() {
  return (
    <main className={styles.routeState} aria-busy="true">
      <ThinkingOrb state="searching" size={64} theme="light" color="#0066cc" aria-label="캐릭터 화면을 준비하는 중" />
      <p role="status">캐릭터 화면을 준비하고 있어요.</p>
    </main>
  );
}
