import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { summaryLine, type PublicSummary } from "@/lib/character/public-summary";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./bot-summary.module.css";

const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

/**
 * The page a search bot gets for a character (CHARACTER_INDEXING on): built
 * from the cache only, so a crawl never makes an official call. Without an
 * indexable summary it is the same generic page for every name (B5): the
 * requested name and a way to look the character up — nothing that tells a
 * character kept out apart from one never recorded.
 */
export function BotSummary({ name, summary }: { name: string; summary: PublicSummary | null }) {
  return (
    <div className={quote.page}>
      <SiteHeader />
      <main className={styles.main}>
        <p className={styles.kicker}>캐릭터 정보</p>
        <h1>{summary?.characterName ?? name}</h1>
        {summary ? (
          <>
            <p className={styles.line}>{summaryLine(summary)}</p>
            {summary.observedAt && (
              <p className={styles.note}>LOAKraken이 {kst.format(new Date(summary.observedAt))}에 확인한 값이에요.</p>
            )}
          </>
        ) : (
          <p className={styles.line}>캐릭터 이름으로 검색하면 장비·각인·전투력과 원정대를 볼 수 있어요.</p>
        )}
        <p className={styles.note}>
          <Link href="/">LOAKraken에서 캐릭터 검색하기</Link>
        </p>
      </main>
    </div>
  );
}
