import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/site/not-found.module.css";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className={styles.page}>
        <p className={styles.code}>404</p>
        <div className={styles.body}>
          <h1 className={styles.title}>페이지가 없거나 옮겨졌어요.</h1>
          <Link href="/" className={styles.home}>
            홈으로
          </Link>
        </div>
      </main>
    </>
  );
}
