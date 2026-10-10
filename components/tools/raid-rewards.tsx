"use client";

import { useState } from "react";
import { ArrowLeft, Coin } from "@/components/ui/icons";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import {
  CATEGORY_LABEL,
  DIFFICULTY_LABEL,
  RAID_DATA,
  STATUS_LABEL,
  formatGold,
  modeTotals,
  type Category,
  type Difficulty,
  type Mode,
  type Raid,
} from "@/lib/tools/raid-rewards";
import quote from "./material-quote.module.css";
import styles from "./raid-rewards.module.css";

const FILTERS: (Category | "ALL")[] = ["ALL", "KAZEROS", "SHADOW", "EPIC", "ABYSS", "LEGION", "EXTREME"];
const NO_DATA = "데이터 없음";

const gold = (value: number | null) => (value === null ? NO_DATA : formatGold(value));

function SourceLink({ id }: { id: string | null }) {
  const source = id ? RAID_DATA.sources[id] : null;
  if (!source) return <span className={styles.sourceNone}>공식 출처를 아직 찾지 못했어요</span>;
  const label = `${source.title}${source.date ? ` (확인 ${source.date})` : ""}`;
  if (!source.url) return <span className={styles.source}>{label}</span>;
  return (
    <a className={styles.source} href={source.url} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function ModeTable({ raid, mode }: { raid: Raid; mode: Mode }) {
  const totals = modeTotals(mode);
  const hasMore = mode.gates.some((g) => g.moreCost !== null) || mode.status === "UNVERIFIED";
  return (
    <div className={styles.modeBody}>
      <p className={styles.modeMeta}>
        <span>아이템 레벨 {mode.minItemLevel} 이상</span>
        <span className={styles.status} data-status={mode.status}>
          {STATUS_LABEL[mode.status]}
        </span>
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.sr}>
            {raid.shortName} {DIFFICULTY_LABEL[mode.difficulty]} 관문별 보상
          </caption>
          <thead>
            <tr>
              <th scope="col">관문</th>
              <th scope="col" className={styles.num}>
                클리어 골드
              </th>
              <th scope="col" className={styles.num}>
                그중 귀속
              </th>
              {hasMore && (
                <th scope="col" className={styles.num}>
                  더보기 비용
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {mode.gates.map((g) => (
              <tr key={g.gate}>
                <th scope="row">
                  {raid.category === "EXTREME" ? "보스 처치" : `${g.gate}관문`}
                </th>
                <td className={styles.num} data-empty={g.gold === null || undefined}>
                  {gold(g.gold)}
                </td>
                <td className={styles.num} data-empty={g.boundGold === null || undefined}>
                  {g.boundGold === 0 ? "—" : gold(g.boundGold)}
                </td>
                {hasMore && (
                  <td className={styles.num} data-empty={g.moreCost === null || undefined}>
                    {gold(g.moreCost)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {totals && mode.gates.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row">합계</th>
                <td className={styles.num}>{formatGold(totals.gold)}</td>
                <td className={styles.num}>
                  {totals.boundGold ? formatGold(totals.boundGold) : "—"}
                </td>
                {hasMore && (
                  <td className={styles.num}>
                    {totals.moreCost === null ? NO_DATA : formatGold(totals.moreCost)}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {totals && totals.boundGold > 0 && (
        <p className={styles.note}>
          {totals.tradableGold === 0
            ? "전액 귀속 골드예요. 받은 캐릭터만 쓸 수 있어요."
            : `거래 가능한 골드 ${formatGold(totals.tradableGold)} · 귀속 골드는 받은 캐릭터만 쓸 수 있어요.`}
        </p>
      )}
      <p className={styles.note}>
        출처 <SourceLink id={mode.source} />
      </p>
    </div>
  );
}

function RaidCard({ raid }: { raid: Raid }) {
  const [difficulty, setDifficulty] = useState(raid.modes[0].difficulty);
  const mode = raid.modes.find((m) => m.difficulty === difficulty) ?? raid.modes[0];
  const groupName = `raid-${raid.id}`;
  return (
    <section className={styles.card} aria-labelledby={`${groupName}-title`}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.category}>{CATEGORY_LABEL[raid.category]}</p>
          <h2 id={`${groupName}-title`} className={styles.title}>
            {raid.name}
          </h2>
          <p className={styles.facts}>
            {raid.players}인 · {raid.modes[0].gates.length}
            {raid.category === "EXTREME" ? "회 처치" : "관문"}
            {raid.rosterWeekly && " · 원정대 주 1회"}
            {raid.goldWithoutDesignation && " · 골드 지정과 무관하게 지급"}
            {raid.limitedTime && " · 기간제"}
          </p>
        </div>
      </div>
      {raid.modes.length > 1 && (
        <SegmentedControl
          className={styles.segment}
          aria-label={`${raid.shortName} 난이도`}
          value={mode.difficulty}
          onValueChange={(value) => setDifficulty(value as Difficulty)}
        >
          {raid.modes.map((m) => (
            <SegmentedItem key={m.difficulty} value={m.difficulty}>
              {DIFFICULTY_LABEL[m.difficulty]}
            </SegmentedItem>
          ))}
        </SegmentedControl>
      )}
      <ModeTable raid={raid} mode={mode} />
    </section>
  );
}

export function RaidRewardsTable() {
  const [filter, setFilter] = useState<Category | "ALL">("ALL");
  const raids = RAID_DATA.raids.filter((r) => filter === "ALL" || r.category === filter);
  const rules = RAID_DATA.rules;
  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#raid-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="raid-main">
        <section className={quote.hero} aria-labelledby="raid-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Coin size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 · 보상</p>
          <h1 id="raid-heading">레이드 보상표</h1>
          <p className={quote.heroCopy}>관문별 골드와 더보기 비용, 공식 공지 기준.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <section className={styles.rules} aria-labelledby="rules-heading">
              <h2 id="rules-heading" className={styles.rulesTitle}>
                골드 받는 규칙
              </h2>
              <ul>
                <li>원정대에서 한 주에 {rules.goldCharactersPerRoster}캐릭터까지 골드를 받아요.</li>
                <li>
                  엔드 콘텐츠 골드는 캐릭터마다 한 주에 {rules.endContentGoldClearsPerCharacter}번까지예요.
                </li>
                <li>매주 {rules.weeklyReset}에 초기화돼요.</li>
              </ul>
              <p className={styles.note}>
                출처 <SourceLink id={rules.source} /> · 확인 {RAID_DATA.checkedAt}
              </p>
            </section>

            <div className={styles.filters} role="group" aria-label="레이드 분류">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === "ALL" ? "전체" : CATEGORY_LABEL[f]}
                </button>
              ))}
            </div>

            <div className={styles.grid}>
              {raids.map((raid) => (
                <RaidCard key={raid.id} raid={raid} />
              ))}
            </div>

            <p className={styles.footnote}>
              공식 공지·가이드에 나온 값만 적었어요. 공식 웹에 없는 값은
              &lsquo;{NO_DATA}&rsquo;로 두고, 확인되는 대로 채워요. 더보기 비용은 관문을 클리어한 뒤
              추가 보상을 받을 때 내는 골드예요.
            </p>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공식 공지 기준 자료
      </footer>
    </div>
  );
}
