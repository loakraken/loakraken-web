import Link from "next/link";
import { weeklyGold, type WeeklyGoldSibling } from "@/lib/character/weekly-gold";
import { formatGold } from "@/lib/tools/raid-rewards";
import { Panel } from "./panel";
import styles from "./weekly-gold-panel.module.css";

const level = (value: number) => value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * This week's raid gold of the current character's server (M7): the six
 * highest characters, three best-paying raids each — the homework tool's
 * automatic setup, so the numbers are the same there.
 */
export function WeeklyGoldPanel({
  siblings,
  current,
  shown,
}: {
  siblings: WeeklyGoldSibling[];
  current: string;
  /** The name as the list shows it (nicknames hidden or not). */
  shown: (name: string) => string;
}) {
  const server = siblings.find((s) => s.characterName === current)?.serverName;
  const gold = server ? weeklyGold(siblings, server) : null;
  if (!gold) return null;
  return (
    <Panel title="주간 획득 골드" meta={`${gold.server} 상위 ${gold.rows.length}캐릭터`} wide>
      <dl className={styles.totals}>
        <div>
          <dt>총 골드</dt>
          <dd>{formatGold(gold.total)}</dd>
        </div>
        <div>
          <dt>거래 가능</dt>
          <dd>{formatGold(gold.tradable)}</dd>
        </div>
        <div>
          <dt>귀속</dt>
          <dd>{formatGold(gold.bound)}</dd>
        </div>
      </dl>
      <ol className={styles.rows} aria-label="캐릭터별 주간 골드">
        {gold.rows.map((row) => (
          <li key={row.name}>
            <span className={styles.who}>
              <strong>{shown(row.name)}</strong>
              <small>
                {row.className} · {level(row.itemLevel)}
              </small>
            </span>
            <span className={styles.raids}>{row.raids.length ? row.raids.join(" · ") : "골드 레이드 없음"}</span>
            <b>{formatGold(row.gold)}</b>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        아이템 레벨이 높은 순으로 {gold.rows.length}캐릭터가 골드를 받고, 캐릭터마다 골드가 가장 많은 레이드
        3개를 깬다고 보고 셌어요(더보기 제외).
        {gold.unknownGates > 0 && ` 골드 미확인 관문 ${gold.unknownGates}개는 빠져 있어요.`}
        {gold.unsettled.length > 0 && ` 합계에서 뺀 항목(클리어 골드 데이터 없음): ${gold.unsettled.join(", ")}.`}{" "}
        <Link href="/tools/homework" prefetch={false}>
          숙제 도구에서 바꿔 보기
        </Link>
      </p>
    </Panel>
  );
}
