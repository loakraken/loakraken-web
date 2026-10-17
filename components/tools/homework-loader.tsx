"use client";

import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site/site-header";
import quote from "./material-quote.module.css";
import styles from "./homework.module.css";

// Homework lives in localStorage, so it renders only in the browser. The
// server sends the same shell — header and a screen-tall main — so the footer
// is below the fold before and after the roster arrives (390 CLS, PM-프론트
// #454).
export const HomeworkLoader = dynamic(() => import("./homework"), {
  ssr: false,
  loading: () => (
    <div className={quote.page}>
      <SiteHeader />
      <main className={styles.main}>
        <p role="status" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted-foreground)" }}>
          숙제 체크를 불러오고 있어요.
        </p>
      </main>
    </div>
  ),
});
