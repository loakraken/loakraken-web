"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { TIER_LABEL, TIER_LEGEND } from "@/lib/character/rank";
import { fetchEfficiencyRanking } from "@/lib/stats/client";
import { conditionsKey, fixed, percent, sampleText, whole } from "@/lib/stats/model";
import {
  EFFICIENCY_KINDS,
  MAX_PAGE,
  PAGE_SIZE,
  efficiencySearch,
  type EfficiencyKind,
  type EfficiencyQuery,
} from "@/lib/stats/rankings";
import quote from "@/components/tools/material-quote.module.css";
import styles from "./stats.module.css";
import { BasisNote } from "./basis-note";
import { RankingTypeTabs, type RankingType } from "./ranking-type-tabs";

const SERVERS = ["루페온", "실리안", "아만", "아브렐슈드", "카단", "카마인", "카제로스", "니나브"];
const CLASSES = [
  "버서커", "디스트로이어", "워로드", "홀리나이트", "슬레이어", "발키리", "배틀마스터", "인파이터", "기공사",
  "창술사", "스트라이커", "브레이커", "데빌헌터", "블래스터", "호크아이", "스카우터", "건슬링어", "바드",
  "서머너", "아르카나", "소서리스", "블레이드", "데모닉", "리퍼", "소울이터", "도화가", "기상술사", "환수사",
];

/** "+14.42%" — the efficiency the backend computed, two decimals. */
const efficiencyText = (value: number) =>
  `+${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * 팔찌 효율 · 젬 효율 랭킹 (api #444, checklist L38·L39): dealers whose
 * equipment LOAKraken observed, by how much the bracelet (or the ark grid gem
 * options) lifts combat power. Same filters and pages as the character
 * ranking, without its metric switch; who is counted is said in the backend's
 * own sentence (populationNote).
 */
export function EfficiencyRankingsView({
  kind,
  initial,
  types,
}: {
  kind: EfficiencyKind;
  initial: EfficiencyQuery;
  types: readonly RankingType[];
}) {
  const router = useRouter();
  const meta = EFFICIENCY_KINDS[kind];
  const [query, setQuery] = useState<EfficiencyQuery>(initial);
  const [levelText, setLevelText] = useState(initial.itemLevelMin != null ? String(initial.itemLevelMin) : "");
  const latest = useRef(initial);
  const levelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ids = { server: useId(), cls: useId(), days: useId(), level: useId() };
  const list = useQuery({
    queryKey: ["efficiency-ranking", kind, conditionsKey(efficiencySearch(kind, query))],
    queryFn: ({ signal }) => fetchEfficiencyRanking(kind, query, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const limit = useRateLimit(list.error);
  const data = list.data?.data;
  const pages = data ? Math.max(1, Math.min(MAX_PAGE, Math.ceil(data.meta.population / PAGE_SIZE))) : 1;

  function apply(next: EfficiencyQuery) {
    latest.current = next;
    setQuery(next);
    router.replace(`?${efficiencySearch(kind, next)}`, { scroll: false });
  }
  const filter = (patch: Partial<EfficiencyQuery>) => apply({ ...latest.current, ...patch, page: 1 });
  function typeLevel(text: string) {
    setLevelText(text);
    clearTimeout(levelTimer.current);
    levelTimer.current = setTimeout(() => {
      const n = text.trim() ? Number(text) : undefined;
      if (n !== undefined && !(Number.isFinite(n) && n >= 0 && n <= 2000)) return;
      if (n !== latest.current.itemLevelMin) filter({ itemLevelMin: n });
    }, 300);
  }
  useEffect(() => () => clearTimeout(levelTimer.current), []);

  const pageWindow = Array.from({ length: Math.min(pages, 7) }, (_, i) => {
    const start = Math.min(Math.max(1, query.page - 3), Math.max(1, pages - 6));
    return start + i;
  });

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#rankings-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="rankings-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="rankings-heading">
          <p className={styles.kicker}>캐릭터</p>
          <h1 id="rankings-heading">{meta.value} 랭킹</h1>
          <p>
            {kind === "bracelets"
              ? "팔찌가 전투력을 몇 % 올려 주는지 높은 순으로 보여줘요."
              : "아크 그리드 젬 옵션이 전투력을 몇 % 올려 주는지 높은 순으로 보여줘요(코어 제외)."}
          </p>
        </section>
        {types.length > 1 && <RankingTypeTabs value={kind} types={types} />}

        <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="랭킹 조건">
          <label htmlFor={ids.server}>
            서버
            <Select
              id={ids.server}
              value={query.server ?? ""}
              onValueChange={(v) => filter({ server: v || undefined })}
              items={[{ value: "", label: "전체" }, ...SERVERS.map((s) => ({ value: s, label: s }))]}
            />
          </label>
          <label htmlFor={ids.cls}>
            직업
            <Select
              id={ids.cls}
              value={query.className ?? ""}
              onValueChange={(v) => filter({ className: v || undefined })}
              items={[{ value: "", label: "전체" }, ...CLASSES.map((c) => ({ value: c, label: c }))]}
            />
          </label>
          <label htmlFor={ids.days}>
            최근 확인
            <Select
              id={ids.days}
              value={query.activeDays ?? 30}
              onValueChange={(v) => filter({ activeDays: v as 7 | 30 | 90 })}
              items={[
                { value: 7, label: "7일" },
                { value: 30, label: "30일" },
                { value: 90, label: "90일" },
              ]}
            />
          </label>
          <label htmlFor={ids.level}>
            아이템 레벨 이상
            <input
              id={ids.level}
              name="itemLevelMin"
              autoComplete="off"
              inputMode="decimal"
              value={levelText}
              placeholder="1640"
              onChange={(e) => typeLevel(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </label>
        </form>

        {data && (
          <p className={styles.notice} {...pendingProps(list)}>
            {/* Fixed words first, as on the character ranking (A7, #594). */}
            공식 랭킹이 아니에요 · {sampleText(data.meta)}
          </p>
        )}

        {list.isError && !data ? (
          <div className={styles.problem}>
            <p>{limit.limited ? countdownText(limit.seconds) : "랭킹을 불러오지 못했어요."}</p>
            <button type="button" onClick={() => list.refetch()} disabled={limit.seconds > 0}>
              {retryLabel(limit.seconds)}
            </button>
          </div>
        ) : !data ? (
          <p className={`${styles.muted} ${styles.listHold}`} role="status">
            랭킹을 불러오고 있어요…
          </p>
        ) : data.rows.length === 0 ? (
          <p className={styles.muted}>조건에 맞는 캐릭터가 없어요.</p>
        ) : (
          <DataTable label={`${meta.value} 랭킹 ${query.page}쪽`} className={styles.table} {...pendingProps(list)}>
            <caption className={styles.srOnly}>
              {meta.value} 랭킹 {query.page}쪽
            </caption>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">캐릭터</th>
                {/* The ranked value right after the name: on a phone it is
                    in view without scrolling the table sideways. */}
                <th scope="col">{meta.value}</th>
                <th scope="col" className={styles.left}>서버</th>
                <th scope="col" className={styles.left}>직업</th>
                <th scope="col">아이템 레벨</th>
                <th scope="col">전투력</th>
                <th scope="col">상위</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.serverName}-${row.characterName}`}>
                  <td>{whole(row.rank)}</td>
                  <th scope="row">
                    <Link href={`/character/${encodeURIComponent(row.characterName)}`} className={styles.charLink}>
                      {row.characterName}
                    </Link>
                  </th>
                  <td data-strong="" className={styles.efficiency}>
                    {efficiencyText(row.valuePercent)}
                  </td>
                  <td className={styles.left}>{row.serverName}</td>
                  <td className={styles.left}>{row.className}</td>
                  <td>{fixed(row.itemLevel)}</td>
                  <td>{fixed(row.combatPower)}</td>
                  <td>
                    {percent(row.topPercent)}
                    {row.tier && TIER_LABEL[row.tier] && <> <b className={styles.tier}>{TIER_LABEL[row.tier]}</b></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {data && pages > 1 && (
          <nav className={styles.pager} aria-label="쪽 이동">
            <button type="button" disabled={query.page <= 1} onClick={() => apply({ ...query, page: query.page - 1 })}>
              이전
            </button>
            {pageWindow.map((p) => (
              <button
                key={p}
                type="button"
                aria-current={p === query.page ? "page" : undefined}
                onClick={() => apply({ ...query, page: p })}
              >
                {p}
              </button>
            ))}
            <button type="button" disabled={query.page >= pages} onClick={() => apply({ ...query, page: query.page + 1 })}>
              다음
            </button>
          </nav>
        )}
        {data && <p className={styles.note}>{data.populationNote}</p>}
        <p className={styles.note}>
          효율은 그 항목을 뺀 전투력과 비교한 값이에요. 티어(이 순위에서 상위 몇 %인지): {TIER_LEGEND}
        </p>
        {data && <BasisNote basis={data.meta} />}
      </main>
    </div>
  );
}
