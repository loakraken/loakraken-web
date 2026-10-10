import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { NotFoundEyes } from "@/components/site/not-found-eyes";
import styles from "@/components/site/not-found.module.css";
import { buttonVariants } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

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
        <h1 className={styles.title}>찾는 페이지가 깊은 바다로 가라앉았어요.</h1>
        <NotFoundEyes>
          <LogoMark size={320} />
        </NotFoundEyes>
        <div className={styles.actions}>
          <Link href="/" className={buttonVariants()}>
            홈으로
          </Link>
          <Link href="/rankings" className={buttonVariants({ variant: "outline" })}>
            랭킹 보기
          </Link>
        </div>
      </main>
    </>
  );
}
