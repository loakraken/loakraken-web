import Link from "next/link";
import { panelSave, raidChoices, weeklyGold, withRaid, type WeeklyGoldSibling } from "@/lib/character/weekly-gold";
import { GOLD_CHARACTERS, GOLD_RAIDS_PER_CHARACTER } from "@/lib/tools/homework";
import { readSavedHomework, saveHomework, savedState, useHomeworkWeek, useSavedHomework } from "@/lib/tools/homework-store";
import type { Character } from "@/lib/tools/homework";
import { formatGold } from "@/lib/tools/raid-rewards";
import { Panel } from "./panel";
import styles from "./weekly-gold-panel.module.css";

/**
 * One change from the panel, saved into the homework tool: read again with the
 * real time (so the week is right), then only that character written, by the
 * homework tool's own rules (panelSave; codex #1466 P1). Event handlers only.
 */
function saveChange(
  siblings: WeeklyGoldSibling[],
  server: string,
  name: string,
  change: (character: Character) => Character,
) {
  const now = Date.now();
  const next = panelSave(siblings, server, now, savedState(readSavedHomework(), now), name, change);
  if (next) saveHomework(next);
}

const level = (value: number) => value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/**
 * This week's raid gold of the current character's server (M7): the six
 * highest characters, three best-paying raids each by default. Gold and raids
 * can be turned on and off here (#14); they are the homework tool's own
 * saved choices, so both screens show the same thing.
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
  // undefined on the server and in the first client render: the automatic
  // setup, the same as a browser with nothing saved.
  const text = useSavedHomework();
  const server = siblings.find((s) => s.characterName === current)?.serverName;
  // Read with this week (client only; the server and the first render show the
  // automatic setup, as with nothing saved): an older week would reset 더보기 and
  // overstate the gold against the homework tool (codex P2). A change reads the
  // store again with the real time, so a save never carries an old week.
  const week = useHomeworkWeek();
  const gold = server ? weeklyGold(siblings, server, week ?? 0, week === null ? null : savedState(text, week)) : null;
  if (!gold || !server) return null;
  const save = (name: string, change: (character: Character) => Character) => saveChange(siblings, server, name, change);
  const extras = gold.rows.filter((row) => row.extra).length;
  const meta = `${gold.server} 상위 ${gold.rows.length - extras}캐릭터${extras ? ` · 그 밖에 골드 ${extras}` : ""}`;
  return (
    <Panel title="주간 획득 골드" meta={meta} wide>
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
        {gold.rows.map((row) => {
          const who = shown(row.name);
          const choices = raidChoices(row.character);
          const onCount = choices.filter((c) => c.on).length;
          return (
            <li key={row.name} data-off={row.on ? undefined : ""}>
              <span className={styles.who}>
                <strong>{who}</strong>
                <small>
                  {row.className} · {level(row.itemLevel)}
                </small>
              </span>
              <span className={styles.raids}>
                {/* The same names whether gold is on or off (dimmed when off): the
                    line keeps its wrap, so a switch moves nothing (A7). */}
                {row.raids.length ? row.raids.join(" · ") : "골드 레이드 없음"}
              </span>
              <b>{formatGold(row.gold)}</b>
              <div className={styles.controls}>
                {row.extra ? (
                  // Given gold in the homework tool, outside the default six: turning it
                  // off here would take the row away under the pointer, so it is set there.
                  <span className={styles.fixed}>골드 받기 · 숙제 체크에서 지정</span>
                ) : (
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={row.on}
                      disabled={!row.on && gold.goldFull}
                      aria-label={`${who} 골드 받기`}
                      onChange={(e) => {
                        const on = e.target.checked;
                        save(row.name, (c) => ({ ...c, gold: on }));
                      }}
                    />
                    <span aria-hidden="true">골드 받기</span>
                  </label>
                )}
                <details className={styles.pick}>
                  <summary>레이드 고르기 ({onCount})</summary>
                  <ul aria-label={`${who} 레이드`}>
                    {choices.map((choice) => (
                      <li key={choice.raidId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={choice.on}
                            onChange={(e) => {
                              const on = e.target.checked;
                              save(row.name, (c) => withRaid(c, choice, on));
                            }}
                          />
                          <span>
                            {choice.label}
                            <small>{choice.gold === null ? "골드 미확인" : formatGold(choice.gold)}</small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>
        캐릭터를 {GOLD_CHARACTERS}명까지 골드 받기로 두고, 캐릭터마다 고른 레이드 중 숙제 체크 순서로 앞의{" "}
        {GOLD_RAIDS_PER_CHARACTER}개가 골드를 받는다고 계산했어요(숙제 체크에서 더보기를 고르면 그 비용은 빼요).
        여기서 바꾸면 숙제 체크에도 그대로 저장돼요.
        {gold.unknownGates > 0 && ` 골드 미확인 관문 ${gold.unknownGates}개는 빠져 있어요.`}
        {gold.unsettled.length > 0 && ` 합계에서 뺀 항목(클리어 골드 데이터 없음): ${gold.unsettled.join(", ")}.`}{" "}
        <Link href="/tools/homework" prefetch={false}>
          관문 · 더보기는 숙제 체크에서
        </Link>
      </p>
    </Panel>
  );
}
