import Link from "next/link";
import { DISCORD_URL } from "@/lib/site";
import { DiscordLogo } from "./discord-link";
import styles from "./site-legal.module.css";

/**
 * Under every page (one place in the layout): the trademark and unofficial
 * notice — once per page, so the pages themselves no longer repeat it — the
 * Discord line, then the privacy policy, contact and credits links.
 */
export function SiteLegal() {
  return (
    <div className={styles.legal}>
      <p className={styles.notice}>
        Lost Ark는 Smilegate RPG의 상표입니다. LOAKraken(로아크라켄)은 Smilegate RPG와 무관한 비공식 팬 사이트로, 공식 Open API
        데이터를 씁니다.
      </p>
      <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={`${styles.community} hit-44`}>
        <DiscordLogo />
        오류 문의·업데이트 알림 디스코드<span className={styles.hidden}> (새 창)</span>
      </a>
      <nav className={styles.links} aria-label="사이트 정책">
        <Link href="/privacy" className="hit-44">개인정보 처리방침</Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="hit-44">문의</Link>
        <span aria-hidden="true">·</span>
        <Link href="/credits" className="hit-44">오픈 소스 라이선스</Link>
      </nav>
    </div>
  );
}
