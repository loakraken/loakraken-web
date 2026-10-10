import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundCaret } from "@/components/site/not-found-caret";
import styles from "@/components/site/not-found.module.css";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false },
};

/* Anti Average's 404 layout (user decision): two short lines top left, a big
   grey 404 with a black silhouette in front and a frosted lens over its head,
   a square logo tile and a big "Error" tile bottom left, a "+" menu tile
   bottom right. Their cat is their own symbol, so ours is a kraken seen from
   behind (tentacles for a tail) with our mark; words, font and colours ours. */
export default function NotFound() {
  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.lead}>
        여기서 무슨 일이 있었는지 모르겠어요. 미안해요!
        <br />
        주소를 다시 확인해 볼까요?
      </h1>

      <div className={styles.stage} aria-hidden="true">
        <span className={styles.digits}>404</span>
        <svg className={styles.kraken} viewBox="0 0 420 330" fill="currentColor">
          <path d="M210 14C270 14 300 60 296 114C293 152 278 172 274 198C306 224 322 264 322 330H98C98 264 114 224 146 198C142 172 127 152 124 114C120 60 150 14 210 14Z" />
          <path d="M122 300C80 300 44 286 32 252C22 222 44 194 72 204C92 211 90 238 70 238C59 238 57 227 62 220C48 223 46 246 62 260C80 277 114 277 136 268Z" />
          <path d="M112 330C72 330 28 318 14 290C6 272 21 261 34 270C53 284 84 300 120 300Z" />
          <path d="M298 300C340 300 376 286 388 252C398 222 376 194 348 204C328 211 330 238 350 238C361 238 363 227 358 220C372 223 374 246 358 260C340 277 306 277 284 268Z" />
          <path d="M308 330C348 330 392 318 406 290C414 272 399 261 386 270C367 284 336 300 300 300Z" />
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

      <NotFoundCaret />
    </main>
  );
}
