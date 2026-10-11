import Link from "next/link";
import styles from "./site-legal.module.css";

/**
 * Under every page (one place in the layout): the trademark and unofficial
 * notice — once per page, so the pages themselves no longer repeat it — then
 * the privacy policy and contact links.
 */
export function SiteLegal() {
  return (
    <div className={styles.legal}>
      <p className={styles.notice}>
        Lost Ark는 Smilegate RPG의 상표입니다. LOAKraken은 Smilegate RPG와 무관한 비공식 팬 사이트로, 공식 Open API
        데이터를 씁니다.
      </p>
      <nav className={styles.links} aria-label="사이트 정책">
        <Link href="/privacy">개인정보 처리방침</Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact">문의</Link>
      </nav>
    </div>
  );
}
