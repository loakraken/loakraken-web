"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { compareBuild, outsideSample, type CompareSection } from "@/lib/stats/build-compare";
import { classBuildCellsKey, type BuildDays, type ClassBuildCellsEnvelope, type ClassBuilds } from "@/lib/stats/class-builds";
import { fetchClassBuildCells, StatsQueryError } from "@/lib/stats/client";
import styles from "./stats.module.css";
import own from "./class-builds.module.css";

const percent = (value: number | null) =>
  value == null ? "-" : `${value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * 대세 빌드 비교 (M26): for each item of the class statistics, its first
 * three with their shares, the rest, and in words where this character's own
 * setting stands (never by colour alone). "Mine" is the cells the backend
 * counts the character in (api #498), read without an official call. The
 * cards come from the statistics (in the first HTML); only the verdict lines
 * wait for the cells, in a room of their own, so nothing moves when they land (A6).
 */
export function BuildCompare({
  name,
  className,
  activeDays,
  missing = false,
  builds,
}: {
  name: string;
  className: string;
  activeDays: BuildDays;
  /** The page's server already found no record (404): said from the first HTML, not asked again. */
  missing?: boolean;
  builds: ClassBuilds;
}) {
  const client = useQueryClient();
  const queryKey = classBuildCellsKey({ className, characterName: name, activeDays });
  const isNotCached = (error: unknown) => error instanceof StatsQueryError && error.info.code === "CHARACTER_NOT_CACHED";
  // Not recorded under another day filter is not recorded under this one either
  // (the record does not depend on the days): no new request, no "loading" line
  // in between, which made the lines below jump (A7).
  const knownMissing =
    missing ||
    client
      .getQueryCache()
      .findAll({ queryKey: queryKey.slice(0, 3) })
      .some((query) => isNotCached(query.state.error));
  const cells = useQuery<ClassBuildCellsEnvelope, Error, ClassBuildCellsEnvelope, typeof queryKey>({
    queryKey,
    queryFn: ({ signal }) => fetchClassBuildCells({ className, characterName: name, activeDays }, signal),
    enabled: !knownMissing,
    // Another day filter shows the cells already here until its own land (the
    // cells are the same; only the sample check moves), so the lines do not
    // blink to "loading" and back.
    placeholderData: () =>
      client.getQueriesData<ClassBuildCellsEnvelope>({ queryKey: queryKey.slice(0, 3) }).find(([, envelope]) => envelope)?.[1],
    // Drawn anew for each statistics answer: an answer already here (or an
    // error) is kept rather than asked again, which would pass through
    // "loading" (A7). A page opened anew brings its own from the server.
    refetchOnMount: false,
    retryOnMount: false,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = cells.data?.data;
  const otherClass = data?.reasons.includes("OTHER_CLASS");
  const mine = data && !otherClass ? data.cells : null;
  const sections = compareBuild(builds, mine, data?.conditions.braceletItemLevelMin);
  const notCached = knownMissing || isNotCached(cells.error);
  const characterPath = `/character/${encodeURIComponent(name)}`;
  const waiting = notCached
    ? "최근 검색 기록이 없어 비교하지 못했어요."
    : cells.isPending
      ? "캐릭터 세팅을 불러오고 있어요…"
      : cells.isError
        ? "캐릭터 정보를 불러오지 못해 비교하지 않았어요. 잠시 뒤 새로 고쳐 주세요."
        : otherClass
          ? `${data?.className} 캐릭터라 ${className} 대세와 비교하지 않았어요.`
          : null;
  const differs = mine ? sections.filter((section) => section.differs).length : null;
  // Until this filter's cells land, the last filter's sample check stays said, as
  // the statistics keep the last answer on screen (dropping it moved the cards, A7).
  const outside = data && !otherClass ? outsideSample(data) : null;

  return (
    <section className={own.compare} aria-labelledby="compare-heading">
      <h2 id="compare-heading">
        <Link href={characterPath}>{name}</Link>의 세팅과 대세
      </h2>
      <p className={own.compareLead} role="status">
        {waiting ??
          `${
            differs === 0
              ? "모든 항목이 대세와 같아요."
              : `${differs}개 항목이 대세와 달라요. 다른 항목은 ‘대세와 달라요’로 적어 두었어요.`
          }${outside ? ` ${outside}` : ""}`}
        {/* The next step, where it is: opening the character page records it. */}
        {notCached && (
          <>
            {" "}
            <Link href={characterPath}>캐릭터 화면</Link>을 한 번 열면 비교할 수 있어요.
          </>
        )}
      </p>
      <ol className={own.compareGrid}>
        {sections.map((section) => (
          <CompareCard key={section.id} section={section} pending={waiting} />
        ))}
      </ol>
    </section>
  );
}

function CompareCard({ section, pending }: { section: CompareSection; pending: string | null }) {
  return (
    <li className={own.compareCard} data-differs={(!pending && section.differs) || undefined}>
      <h3>{section.title}</h3>
      {section.top.length ? (
        <ol className={own.compareRows}>
          {section.top.map((row, i) => (
            <li key={row.label} data-mine={(!pending && row.mine) || undefined}>
              <span className={own.compareRank}>{i + 1}위</span>
              <span className={own.compareLabel}>{row.label}</span>
              <b>{percent(row.share)}</b>
              {/* In words too: the tag says it, the tint only repeats it. */}
              <small className={own.compareMine}>{!pending && row.mine ? "내 세팅" : ""}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>보여 드릴 칸이 아직 없어요.</p>
      )}
      <p className={own.compareOthers}>
        {section.others
          ? section.others.share != null
            ? `다른 조합 ${section.others.cells}개${section.others.hiddenSmall ? "와 인원이 적은 칸" : ""} · ${percent(section.others.share)}`
            : `그 밖 ${section.others.cells}개`
          : " "}
      </p>
      {/* Two rows (one line each, two on a phone), there from the first paint: the character landing fills them in place. */}
      <p className={own.compareVerdict} title={!pending ? section.verdict : undefined}>
        {pending ?? section.verdict}
      </p>
      <p className={own.compareMineLine} title={!pending && section.mine ? section.mine : undefined}>
        {(!pending && section.mine) || " "}
      </p>
    </li>
  );
}
