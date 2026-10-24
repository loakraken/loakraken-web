import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/legal/legal.module.css";
import { ADAPTED, ASSETS, LIBRARIES, type Credit } from "@/lib/credits";
import { OFFICIAL_API_URL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "오픈 소스·출처",
  description: "LOAKraken이 쓰는 오픈 소스 라이브러리·글꼴·아이콘과 가져와 고친 화면 부품, 각 라이선스와 원본 링크.",
  alternates: { canonical: "/credits" },
};

/** An outside link: a new tab, said so to screen readers. */
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (새 창)</span>
    </a>
  );
}

function CreditTable({ caption, rows }: { caption: string; rows: readonly Credit[] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">이름</th>
            <th scope="col">쓰는 곳</th>
            <th scope="col">라이선스</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name}>
              <th scope="row">
                <Out href={c.href}>{c.name}</Out>
                {c.source && (
                  <>
                    <br />
                    <Out href={c.source.href}>{c.source.label}</Out>
                  </>
                )}
              </th>
              <td>{c.use}</td>
              <td>
                {c.licence}
                {c.holder && (
                  <>
                    <br />
                    {c.holder}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1>오픈 소스·출처</h1>
        <p className={styles.lead}>
          LOAKraken은 아래 오픈 소스와 공개된 작업물로 만들었습니다. 라이선스 고지문 전문은 사이트 소스 코드에 함께 들어
          있습니다.
        </p>

        <h2>게임 데이터</h2>
        <p>
          캐릭터·시세·일정 정보와 게임 이미지는 <Out href={OFFICIAL_API_URL}>로스트아크 공식 Open API</Out>에서 가져옵니다. Lost
          Ark는 Smilegate RPG의 상표입니다.
        </p>

        <h2>가져와 고친 화면 부품</h2>
        <CreditTable caption="가져와 고친 화면 부품" rows={ADAPTED} />

        <h2>아이콘·글꼴</h2>
        <CreditTable caption="아이콘·글꼴" rows={ASSETS} />

        <h2>라이브러리</h2>
        <CreditTable caption="라이브러리" rows={LIBRARIES} />
      </main>
    </div>
  );
}
