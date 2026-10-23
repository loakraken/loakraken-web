import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/legal/legal.module.css";
import { CONTACT_EMAIL, OFFICIAL_API_URL, PRIVACY_EMAIL } from "@/lib/legal";
import { EmailLink } from "@/components/ui/email-link";

export const metadata: Metadata = {
  title: "문의",
  description: "LOAKraken 문의 메일과 개인정보 요청 창구.",
  alternates: { canonical: "/contact" },
};

// Kept out of the edge's address rewriting (components/ui/email-link.tsx).
const mail = (address: string, subject?: string) => <EmailLink address={address} subject={subject} />;

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1>문의</h1>
        <p className={styles.lead}>
          LOAKraken은 로스트아크 비공식 팬 프로젝트이며, 스마일게이트와 관계가 없습니다. 문의와 요청은 메일로 받습니다.
        </p>

        <div className={styles.card}>
          <strong>문의</strong>
          <p className={styles.mail}>{mail(CONTACT_EMAIL)}</p>
          <p>오류 제보, 제안, 그 밖의 문의를 보내 주세요.</p>
        </div>

        <h2>개인정보</h2>
        <p>
          처리하는 정보와 보유 기간은 <Link href="/privacy">개인정보 처리방침</Link>에 있습니다. 열람·정정·삭제·처리정지 요청은{" "}
          {mail(PRIVACY_EMAIL)}로 보내 주세요.
        </p>

        <h2>데이터 출처</h2>
        <p>
          캐릭터·거래소 정보는 로스트아크 공식 Open API(스마일게이트,{" "}
          <a href={OFFICIAL_API_URL} target="_blank" rel="noreferrer">
            developer-lostark.game.onstove.com
          </a>
          )에서 받아 표시합니다. 게임 이미지와 아이콘은 공식 API가 제공하는 주소를 그대로 씁니다.
        </p>
      </main>
    </div>
  );
}
