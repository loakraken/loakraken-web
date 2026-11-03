import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/site/not-found.module.css";
import { LogoMark } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false },
};

/* The 404, simplified (user decision 10-12 00:46·00:47): in the middle two
   grey 4s with the clear glass circle between them as the 0, our mark at its
   centre; bottom left only our mark, a link home with no box round it. No
   figure, no "Error" or "+" tiles, no menu, no caret. The two English lines
   at the top left are gone (user 11-03); the heading stays for screen
   readers only. */
export default function NotFound() {
  return (
    <main id="main" className={styles.page}>
      <h1 className="sr-only">페이지를 찾을 수 없어요.</h1>

      {/* Hovering the picture parts the two 4s (pointer devices only). */}
      <div className={styles.stage} aria-hidden="true">
        <svg className={styles.picture} viewBox="0 0 668 459">
          <g className={`${styles.four} ${styles.left}`}>
            <text x="180" y="252" textAnchor="middle">4</text>
          </g>
          <g className={`${styles.four} ${styles.right}`}>
            <text x="488" y="252" textAnchor="middle">4</text>
          </g>
        </svg>
        <span className={styles.lens}>
          <LogoMark size={96} className={styles.lensMark} />
        </span>
      </div>

      <Link href="/" className={styles.home} aria-label="홈으로">
        <LogoMark size={40} />
      </Link>
    </main>
  );
}
