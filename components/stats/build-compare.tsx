"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchCharacter } from "@/lib/character/client";
import { compareBuild, myBuild, type CompareSection } from "@/lib/stats/build-compare";
import type { ClassBuilds } from "@/lib/stats/class-builds";
import styles from "./stats.module.css";
import own from "./class-builds.module.css";

const percent = (value: number | null) =>
  value == null ? "-" : `${value.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * 대세 빌드 비교 (M26 stage 1): for each item of the class statistics, its
 * first three with their shares, the rest, and in words where this
 * character's own setting stands (never by colour alone). The cards come from
 * the statistics (in the first HTML); only the verdict lines wait for the
 * character, in a room of their own, so nothing moves when it lands (A6).
 */
export function BuildCompare({
  name,
  className,
  builds,
}: {
  name: string;
  className: string;
  builds: ClassBuilds;
}) {
  const character = useQuery({
    queryKey: ["character", name],
    queryFn: ({ signal }) => fetchCharacter(name, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = character.data?.data;
  const otherClass = data && data.className !== className;
  const mine = data && !otherClass ? myBuild(data) : null;
  const empty = { classEngraving: null, combo: null, points: null, gems: null, cardSet: null, topStat: null, braceletStats: null };
  const sections = compareBuild(builds, mine ?? empty);
  const waiting = character.isPending
    ? "캐릭터 세팅을 불러오고 있어요…"
    : character.isError
      ? "캐릭터 정보를 불러오지 못해 비교하지 않았어요."
      : otherClass
        ? `${data.className} 캐릭터라 ${className} 대세와 비교하지 않았어요.`
        : null;
  const differs = mine ? sections.filter((section) => section.differs).length : null;

  return (
    <section className={own.compare} aria-labelledby="compare-heading">
      <h2 id="compare-heading">
        <Link href={`/character/${encodeURIComponent(name)}`}>{name}</Link>의 세팅과 대세
      </h2>
      <p className={own.compareLead} role="status">
        {waiting ??
          (differs === 0
            ? "모든 항목이 대세와 같아요."
            : `${differs}개 항목이 대세와 달라요. 다른 항목은 '대세와 달라요'로 적어 두었어요.`)}
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
      {/* Two one-line rows, there from the first paint: the character landing fills them in place. */}
      <p className={own.compareVerdict}>{pending ?? section.verdict}</p>
      <p className={own.compareMineLine} title={!pending && section.mine ? section.mine : undefined}>
        {(!pending && section.mine) || " "}
      </p>
    </li>
  );
}
