import Link from "next/link";
import styles from "./site-legal.module.css";

/**
 * The privacy policy and contact links, under every page's own footer (one
 * place in the layout, so tool pages carry them too).
 */
export function SiteLegal() {
  return (
    <nav className={styles.legal} aria-label="사이트 정책">
      <Link href="/privacy">개인정보 처리방침</Link>
      <span aria-hidden="true">·</span>
      <Link href="/contact">문의</Link>
    </nav>
  );
}
