"use client";

import dynamic from "next/dynamic";

// Homework lives in localStorage, so it renders only in the browser; the
// server sends a short placeholder instead of a page that would not match.
export const HomeworkLoader = dynamic(() => import("./homework"), {
  ssr: false,
  loading: () => (
    <p style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted-foreground)" }}>
      숙제 체크를 불러오고 있어요.
    </p>
  ),
});
