import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/legal/legal.module.css";
import {
  AWS_TRANSFER,
  EFFECTIVE_DATE,
  INQUIRY_RETENTION,
  PENDING_TEXT,
  PRIVACY_EMAIL,
  PRIVACY_OFFICER,
  RATE_LIMIT_IP_RETENTION,
  REQUEST_DAYS,
} from "@/lib/legal";
import { EmailLink } from "@/components/ui/email-link";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "LOAKraken이 처리하는 개인정보와 보유 기간, 이용자의 권리와 요청 방법.",
  alternates: { canonical: "/privacy" },
};

const Pending = ({ value }: { value: string | null }) =>
  value ?? <em className={styles.pending}>{PENDING_TEXT}</em>;

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const mail = (address: string) => <EmailLink address={address} />;

/** The policy as drafted by PM 총괄 (vault "개인정보 처리방침 초안", 본문). */
export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1>개인정보 처리방침</h1>
        <p className={styles.lead}>
          LOAKraken(이하 &quot;서비스&quot;)은 「개인정보 보호법」에 따라 이용자의 개인정보를 보호합니다. 관련 고충을 신속하게
          처리하기 위해 아래와 같이 처리방침을 공개합니다. 서비스는 로스트아크 비공식 팬 프로젝트이며, 스마일게이트와 관계가
          없습니다.
        </p>

        <h2>1. 처리하는 개인정보와 목적</h2>
        <Table
          head={["구분", "항목", "목적"]}
          rows={[
            ["문의·요청 시", "이메일 주소, 문의 내용", "문의 답변"],
            [
              "서비스 이용 시 자동 처리",
              "접속 IP 주소. 원본은 저장하지 않습니다. IPv6는 /64 단위로 묶은 뒤 해시합니다(과도한 요청 제한용은 서버 비밀 키로, 인기 검색 중복 제거용은 하루마다 바뀌는 값으로).",
              "과도한 요청 제한(서비스 안정), 인기 검색 집계의 중복 제거",
            ],
            [
              "서비스 이용 시 자동 처리",
              "서버·컨테이너 오류 로그(요청 처리 기록). 평상시에는 접속 IP·캐릭터명을 남기지 않으며, 오류가 났을 때 요청 주소(캐릭터 이름 포함)가 오류 기록에 남을 수 있습니다.",
              "장애 확인과 보안",
            ],
            [
              "시세 알림을 켠 경우(선택)",
              "그 브라우저의 푸시 구독 정보(브라우저 회사 푸시 서비스 주소·암호화 공개 키), 알림 조건(품목·가격·이하/이상), 만든 시각·마지막 사용 시각. 이름·이메일·계정은 받지 않습니다. 접속 IP 주소는 이 기능을 위해 저장하지 않습니다(과도한 요청 제한용 IP 해시는 위 \"자동 처리\" 줄과 같음).",
              "조건에 맞는 시세가 되었을 때 그 브라우저에 알림 보내기",
            ],
          ]}
        />
        <ul>
          <li>회원가입이 없습니다. 이름·전화번호·주민등록번호 등은 받지 않습니다.</li>
          <li>조회수와 인기 검색은 &quot;검색된 캐릭터&quot;의 횟수만 셉니다. &quot;검색한 사람&quot;은 기록하지 않습니다.</li>
          <li>
            즐겨찾기, 최근 검색, 화면 테마, 숙제 체크 같은 설정은 <strong>이용자의 브라우저(로컬 저장소)에만</strong> 저장되고
            서비스로 전송되지 않습니다. 브라우저 설정에서 언제든 지울 수 있습니다.
          </li>
        </ul>

        <h2>2. 공개 게임 정보에 대한 안내</h2>
        <p>서비스는 로스트아크 공식 Open API(스마일게이트)가 공개하는 캐릭터 정보를 받아 표시하고 기록합니다.</p>
        <ul>
          <li>
            대상 정보: 캐릭터명, 서버, 직업, 장비·각인·보석·카드, 칭호, 길드명·길드 직위, 수집품, 원정대 연결 정보(같은 계정의
            캐릭터 목록)
          </li>
          <li>
            기록 내용: 캐릭터별 변화 이력과 통계·랭킹 집계에 사용합니다. 같은 길드명으로 확인된 캐릭터를 모아{" "}
            <strong>길드별 목록·평균·분포</strong>로도 보여 줍니다(서비스가 확인한 캐릭터만, 길드 전체 명단이 아님).
          </li>
          <li>
            통계 표본을 위해 검색된 캐릭터와 같은 원정대의 캐릭터, 그리고 운영자가 정한 시작 목록의 캐릭터도 공식 API로 확인해
            기록할 수 있습니다. 공식 API가 공개하는 게임 정보만 다룹니다.
          </li>
        </ul>

        <h2>3. 보유 기간과 파기</h2>
        <Table
          head={["항목", "보유 기간"]}
          rows={[
            ["문의 메일", INQUIRY_RETENTION],
            ["인기 검색 중복 판별 값(IP 해시)", "최대 26시간 뒤 자동 삭제"],
            [
              "접속 보호 기록(Cloudflare 보안 이벤트: 차단되거나 확인 절차를 거친 요청의 IP 주소·요청 주소)",
              "최대 31일 뒤 자동 삭제",
            ],
            ["유입 제한용 IP 해시", RATE_LIMIT_IP_RETENTION ? `${RATE_LIMIT_IP_RETENTION} 뒤 자동 삭제` : <Pending value={null} />],
            ["서버·컨테이너 로그(오류 시 요청 주소 포함 가능)", "용량 기준(10MB×5개) 순환. 오래된 것부터 자동 삭제"],
            ["공식 API 원문 데이터", "저장하지 않음(필요한 값만 정규화해 아래 캐릭터 기록으로 보관)"],
            [
              "캐릭터 기록(이력·통계)",
              `마지막으로 확인된 날부터 1년 동안 다시 확인되지 않으면 삭제. 삭제를 요청하면 ${REQUEST_DAYS}일 안에 삭제`,
            ],
            ["캐릭터 조회수(일별)", "1년"],
            ["시세 알림 구독 정보·조건", "알림을 끄거나 브라우저가 구독을 없애면 즉시 삭제. 90일 동안 쓰지 않으면 자동 삭제"],
            [
              "원정대 불러오기 '불러온 적 있음' 표시(처리정지 캐릭터 포함, 이름을 되돌릴 수 없게 바꾼 값만, 게임 정보 없음)",
              "24시간 뒤 자동 삭제",
            ],
          ]}
        />
        <ul>
          <li>파기 방법: 전자 파일은 복구할 수 없는 방식으로 삭제합니다.</li>
          <li>
            데이터베이스 백업은 암호화해 외부 저장소(Cloudflare R2)에 <strong>30일</strong> 보관한 뒤 자동 삭제합니다. 그래서
            삭제를 요청하면 서비스에서는 {REQUEST_DAYS}일 안에 지워지지만, <strong>백업에는 최대 30일 동안 남을 수 있습니다.</strong>{" "}
            백업을 복구하면 삭제 요청을 다시 적용합니다.
          </li>
        </ul>

        <h2>4. 제3자 제공</h2>
        <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>

        <h2>5. 처리 위탁과 국외 이전</h2>
        <Table
          head={["수탁자", "위탁 업무", "국외 이전"]}
          rows={[
            ["Porkbun LLC (미국)", "문의 메일 수신·보관(메일 호스팅)", <strong key="p">있음. 아래 표 참고</strong>],
            ["Amazon Web Services(AWS Lightsail, 서울 리전)", "서비스 서버·데이터베이스 운영", <Pending key="a" value={AWS_TRANSFER} />],
            [
              "Cloudflare, Inc. (미국)",
              <>
                접속 보호(프록시)·DNS: <strong>모든 접속의 IP 주소와 요청 정보</strong>를 처리 / 데이터베이스 백업 보관(R2, 암호화,
                30일)
              </>,
              <>
                <strong>있음.</strong> 프록시는 전 세계 Cloudflare 네트워크에서 처리. R2는 아시아·태평양 위치 힌트만 있고{" "}
                <strong>저장 국가 보장 없음</strong>
              </>,
            ],
            [
              "브라우저 회사 푸시 서비스(Google·Mozilla·Microsoft·Apple 등, 이용자가 쓰는 브라우저에 따라 정해짐)",
              "시세 알림 전달",
              <strong key="w">있음. 아래 상세 참고</strong>,
            ],
          ]}
        />
        <h3>국외 이전 상세 (Cloudflare, Inc.)</h3>
        <ul>
          <li>이전 국가: 미국 등 Cloudflare 네트워크가 있는 국가(백업 저장 국가는 보장되지 않음)</li>
          <li>이전 일시와 방법: 서비스에 접속할 때마다 네트워크로 전송 / 백업은 매일 암호화해 전송</li>
          <li>이전 항목: 접속 IP 주소, 요청 정보(주소·브라우저 정보) / 데이터베이스 백업(암호화)</li>
          <li>이용 목적: 접속 보호·전달, 백업 보관</li>
          <li>
            보유 기간: 프록시는 처리 즉시(Cloudflare 정책에 따름). 단, 차단되거나 확인 절차를 거친 요청은 보안 기록으로 최대
            31일. 백업은 30일
          </li>
          <li>거부 방법: 서비스 접속 자체가 Cloudflare를 거치므로, 거부하려면 서비스를 이용하지 않아야 합니다.</li>
        </ul>
        <h3>국외 이전 상세 (브라우저 푸시 서비스)</h3>
        <ul>
          <li>이전 국가: 이용자 브라우저의 푸시 서비스 운영 회사가 있는 국가(미국 등)</li>
          <li>이전 일시와 방법: 알림 조건이 맞을 때마다 네트워크로 전송</li>
          <li>
            이전 항목: 암호화된 알림 내용(품목·가격), 구독 주소. 내용은 암호화되어 푸시 서비스 회사가 읽을 수 없습니다
          </li>
          <li>이용 목적: 알림 전달</li>
          <li>보유 기간: 전달 즉시(각 회사 정책에 따름)</li>
          <li>거부 방법: 시세 알림을 켜지 않거나 끄면 됩니다. 알림 외 기능은 그대로 이용할 수 있습니다.</li>
        </ul>
        <h3>국외 이전 상세 (Porkbun LLC)</h3>
        <ul>
          <li>이전 국가: 미국</li>
          <li>이전 일시와 방법: 이용자가 문의 메일을 보낼 때 네트워크로 전송</li>
          <li>이전 항목: 이메일 주소, 문의 내용(첨부 포함)</li>
          <li>이용 목적: 메일 수신·보관</li>
          <li>보유 기간: 3항의 문의 메일 보유 기간과 같음</li>
          <li>
            거부 방법: 메일 대신 이용할 수 있는 다른 창구가 없으므로, 이전을 원하지 않으면 문의를 보내지 않으면 됩니다. 이 경우
            문의·요청 처리를 받을 수 없습니다.
          </li>
        </ul>

        <h2>6. 이용자의 권리와 행사 방법</h2>
        <ul>
          <li>이용자는 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</li>
          <li>요청 창구: {mail(PRIVACY_EMAIL)}</li>
          <li>
            캐릭터 정보의 처리정지를 요청하면 확인 뒤 다음과 같이 처리합니다.
            <ul>
              <li>
                그 캐릭터의 변화 이력, 조회수, 칭호·카드·장비 요약을 더 이상 기록하지 않고, 이미 쌓인 기록도 {REQUEST_DAYS}일
                안에 함께 삭제합니다.
              </li>
              <li>랭킹, 인기 검색, 통계, 길드별 목록, 검색어 자동완성, 검색 엔진 노출에서 제외합니다.</li>
              <li>
                다만 누군가 서비스에서 그 캐릭터 이름을 직접 검색하면, 공식 Open API가 공개하는 현재 정보는 공식 전투정보실과
                마찬가지로 표시됩니다. 이때 같은 요청이 몰리지 않도록 최대 5분 동안 임시로 보관한 뒤 자동으로 지우며, 기록으로
                남기지 않습니다.
              </li>
              <li>
                원정대 불러오기를 반복할 때 같은 캐릭터를 다시 불러오지 않도록, 처리정지된 캐릭터도 게임 정보 없이 &apos;불러온
                적 있음&apos; 표시(캐릭터 이름을 되돌릴 수 없게 바꾼 값)만 24시간 두었다가 자동으로 지웁니다.
              </li>
              <li>처리정지 여부는 화면에 따로 표시하지 않습니다.</li>
            </ul>
          </li>
        </ul>

        <h2>7. 안전성 확보 조치</h2>
        <ul>
          <li>접속 IP는 원본을 저장하지 않고 해시합니다.</li>
          <li>모든 통신은 HTTPS로 암호화합니다.</li>
          <li>데이터베이스와 캐시는 외부에서 접근할 수 없게 하고, 운영 비밀값(API 키)은 서버의 비밀 파일로만 관리합니다.</li>
        </ul>

        <h2>8. 쿠키 등 자동 수집 장치</h2>
        <ul>
          <li>현재 쿠키를 사용하지 않습니다. 화면 설정은 브라우저 로컬 저장소를 씁니다(1항).</li>
          <li>광고 등 쿠키가 필요한 기능을 도입하면 이 방침을 먼저 개정해 알립니다.</li>
        </ul>

        <h2>9. 개인정보 보호책임자</h2>
        <ul>
          <li>개인정보 보호 담당: {PRIVACY_OFFICER}</li>
          <li>연락처: {mail(PRIVACY_EMAIL)}</li>
        </ul>

        <h2>10. 권익침해 구제 방법</h2>
        <ul>
          <li>개인정보침해 신고센터: (국번 없이) 118, privacy.kisa.or.kr</li>
          <li>개인정보 분쟁조정위원회: 1833-6972, www.kopico.go.kr</li>
          <li>대검찰청: (국번 없이) 1301</li>
          <li>경찰청: (국번 없이) 182</li>
        </ul>

        <h2>11. 시행일과 변경</h2>
        <ul>
          <li>
            이 방침은 {EFFECTIVE_DATE ? `${EFFECTIVE_DATE}부터` : "서비스 공개일부터"} 적용합니다.
          </li>
          <li>내용을 바꾸면 시행 7일 전에 사이트 공지로 알립니다.</li>
        </ul>
      </main>
    </div>
  );
}
