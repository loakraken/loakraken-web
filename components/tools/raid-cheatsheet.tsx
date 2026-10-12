"use client";
// 레이드 컨닝페이퍼 (checklist N20): per gate, the main boss patterns with
// what happens and how to answer it. Static data (lib/tools/raid-cheatsheet.ts);
// sources stay in the data file and are never shown (사용자 결정 10-12).
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookSquare } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { Select } from "@/components/ui/select";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { CHEATSHEET_DATA, type HpBarRange } from "@/lib/tools/raid-cheatsheet";
import { DIFFICULTY_LABEL, RAID_DATA } from "@/lib/tools/raid-rewards";
import quote from "./material-quote.module.css";
import styles from "./raid-cheatsheet.module.css";

const raidName = (id: string) => RAID_DATA.raids.find((raid) => raid.id === id)?.name ?? id;

/** "235줄", "1000~700줄", "240줄부터"; null when no source gives the bars. */
export function barsText(bars: HpBarRange | null): string | null {
  if (!bars || bars.from === null) return null;
  if (bars.to === null) return `${bars.from}줄부터`;
  if (bars.from === bars.to) return `${bars.from}줄`;
  return `${bars.from}~${bars.to}줄`;
}

export function RaidCheatSheet() {
  const raids = CHEATSHEET_DATA.raids;
  const [raidId, setRaidId] = useState(raids[0].raidId);
  const raid = raids.find((r) => r.raidId === raidId) ?? raids[0];
  const [difficultyKey, setDifficultyKey] = useState(raid.difficulties[0].difficulty);
  const difficulty = raid.difficulties.find((d) => d.difficulty === difficultyKey) ?? raid.difficulties[0];
  const [gateNo, setGateNo] = useState(1);
  const gate = difficulty.gates.find((g) => g.gate === gateNo) ?? difficulty.gates[0];

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#cheatsheet-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="cheatsheet-main">
        <section className={quote.hero} aria-labelledby="cheatsheet-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <BookSquare size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 공략</p>
          <h1 id="cheatsheet-heading">레이드 컨닝페이퍼</h1>
          <p className={quote.heroCopy}>관문마다 주요 패턴과 대응을 한 장으로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={quote.card} aria-labelledby="cheatsheet-pick">
              <h2 id="cheatsheet-pick">레이드와 관문</h2>
              <div className={styles.fields}>
                <div className={quote.field}>
                  <span id="cheatsheet-raid">레이드</span>
                  <Select
                    aria-labelledby="cheatsheet-raid"
                    value={raid.raidId}
                    items={raids.map((r) => ({ value: r.raidId, label: raidName(r.raidId) }))}
                    onValueChange={(next) => {
                      const nextRaid = raids.find((r) => r.raidId === next) ?? raids[0];
                      setRaidId(nextRaid.raidId);
                      setDifficultyKey(nextRaid.difficulties[0].difficulty);
                      setGateNo(1);
                    }}
                  />
                </div>
                <div className={quote.field}>
                  <span id="cheatsheet-difficulty">난이도</span>
                  <Select
                    aria-labelledby="cheatsheet-difficulty"
                    value={difficulty.difficulty}
                    items={raid.difficulties.map((d) => ({ value: d.difficulty, label: DIFFICULTY_LABEL[d.difficulty] }))}
                    onValueChange={(next) => {
                      setDifficultyKey(next as typeof difficultyKey);
                      setGateNo(1);
                    }}
                  />
                </div>
              </div>
              {/* Two gates fit one row at every width, so the row is fixed
                  horizontal and never re-measured after the font (A6). */}
              <SegmentedControl
                className={styles.gates}
                aria-label="관문"
                orientation="horizontal"
                value={gate.gate}
                onValueChange={(value) => setGateNo(value as number)}
              >
                {difficulty.gates.map((g) => (
                  <SegmentedItem key={g.gate} value={g.gate}>
                    {g.gate}관문
                  </SegmentedItem>
                ))}
              </SegmentedControl>
              <p className={quote.caption}>
                패턴 이름은 많이 쓰는 별칭이에요. 줄 수는 보스 HP 줄 기준이에요.
              </p>
            </section>

            <section className={quote.card} aria-labelledby="cheatsheet-gate">
              <h2 id="cheatsheet-gate">
                {gate.gate}관문 · {gate.boss}
              </h2>
              <p className={styles.meta}>
                {raidName(raid.raidId)} {DIFFICULTY_LABEL[difficulty.difficulty]} · 패턴 {gate.patterns.length}개
              </p>
              {gate.patterns.length === 0 ? (
                <p className={styles.empty}>{gate.missingReason}</p>
              ) : (
                <ol className={styles.list}>
                  {gate.patterns.map((pattern) => {
                    const bars = barsText(pattern.hpBars);
                    return (
                      <li key={pattern.id} className={styles.item}>
                        <div className={styles.itemHead}>
                          <span className={styles.phase}>{pattern.phase}</span>
                          <h3>{pattern.name}</h3>
                          <span className={styles.bars} data-missing={bars ? undefined : ""}>
                            {bars ?? "줄 구간 정보 없음"}
                          </span>
                        </div>
                        <dl className={styles.body}>
                          <div>
                            <dt>동작</dt>
                            <dd>{pattern.description}</dd>
                          </div>
                          <div>
                            <dt>대응</dt>
                            <dd>{pattern.counterplay}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className={quote.caption}>기준 시점 {CHEATSHEET_DATA.checkedAt}</p>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 레이드 컨닝페이퍼</footer>
    </div>
  );
}
