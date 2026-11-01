import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/legal/legal.module.css";
import { ApiKeyPanel } from "@/components/settings/api-key-panel";
import { byokEnabled, userKeyStatus } from "@/lib/byok/server";
import { OFFICIAL_API_URL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "내 API 키",
  description: "내 로스트아크 공식 Open API 키를 등록해 캐릭터 조회에 내 키를 씁니다.",
  robots: { index: false },
};

// The user's own official API key (BYOK, api #804). Off unless BYOK_ENABLED:
// this page does not exist then.
export default async function ApiKeyPage() {
  if (!byokEnabled()) notFound();
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1>내 API 키</h1>
        <p className={styles.lead}>
          공식 Open API 키를 등록하면 캐릭터 검색과 원정대 조회를 내 키로 합니다. 사이트 공용 한도가 찼을 때도 내 키의
          한도 안에서 조회할 수 있어요.
        </p>
        <ApiKeyPanel initial={await userKeyStatus()} portal={OFFICIAL_API_URL} />
      </main>
    </div>
  );
}
