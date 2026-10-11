import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/site/not-found.module.css";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false },
};

/* The 404 as the original Anti Average page draws it (user decision; measured
   10-11, 60 디자인 시스템/방향 전환/404 원본 실측): two lines top left, a
   668×459 picture in the middle — two grey 4s with a black head between them
   under a frosted glass lens and a body below — a logo tile and an "Error"
   tile bottom left, a "+" tile bottom right. Their cat is their own symbol,
   so the head and body are our kraken, in the cat's place and box. No
   pointer-following caret (the original has none). The words are the
   original's design copy (no site or brand name in them). */
export default function NotFound() {
  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.lead}>
        <span>We’re not sure what happened there—sorry!</span>
        <span>Check for typos, try again?</span>
      </h1>

      {/* Hovering the picture parts the two 4s (pointer devices only). */}
      <div className={styles.stage} aria-hidden="true">
        <svg className={styles.picture} viewBox="0 0 668 459">
          <g className={`${styles.four} ${styles.left}`}>
            <text x="180" y="252" textAnchor="middle">4</text>
          </g>
          <g className={`${styles.four} ${styles.right}`}>
            <text x="488" y="252" textAnchor="middle">4</text>
          </g>
          {/* The kraken, where the cat sits: its box is left 18.5%, width
              50%, on the floor; the head is the dark round under the lens. */}
          <g className={styles.kraken}>
            {/* a pear-shaped mantle widening from the neck to the floor
                (the original's silhouette), head on top under the lens, two
                tentacles curling up on the left where the cat's tail is */}
            <path d="M292 160C286 200 276 240 262 270C240 315 214 345 212 400C210 440 214 470 216 478H452C454 470 458 440 456 400C452 345 426 315 404 270C392 240 382 200 376 160Z" />
            <circle cx="334" cy="128" r="56" />
            <path className={styles.arm} d="M236 474C170 468 128 430 128 380C128 345 145 318 168 308" />
            <path className={styles.arm} d="M248 438C206 428 182 404 184 372C186 352 198 338 216 334" />
            <ellipse className={styles.eye} cx="315" cy="124" rx="6" ry="12" />
            <ellipse className={styles.eye} cx="353" cy="124" rx="6" ry="12" />
          </g>
        </svg>
        <span className={styles.lens} />
      </div>

      <div className={styles.corner}>
        <Link href="/" className={`${styles.tile} ${styles.mark}`} aria-label="LOAKraken 홈">
          <LogoMark size={40} />
        </Link>
        <span className={`${styles.tile} ${styles.error}`}>Error</span>
      </div>

      <details className={styles.menu}>
        <summary className={`${styles.tile} ${styles.plus}`} aria-label="메뉴">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </summary>
        <nav className={styles.sheet} aria-label="이동">
          <Link href="/">홈</Link>
          <Link href="/#home-search">캐릭터 검색</Link>
          <Link href="/rankings">랭킹</Link>
        </nav>
      </details>
    </main>
  );
}
