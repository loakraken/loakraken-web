"use client";
// 시뮬레이터 tab (PM-프론트 16:37 ①): the combat-power simulator on the
// character page, for the character already on screen. Loaded when the tab
// opens so the other tabs do not carry it (first-load budget); the tool page
// /tools/combat-power stays as it is.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readTryPath } from "@/lib/spec-up/model";
import type { Character } from "@/lib/character/model";
import { Panel } from "./panel";
import styles from "./detail.module.css";

const Simulator = dynamic(
  () => import("@/components/tools/combat-power").then((mod) => mod.CombatPowerSimulator),
  {
    ssr: false,
    loading: () => (
      <p className={styles.simulatorLoading} role="status">
        시뮬레이터를 준비하고 있어요…
      </p>
    ),
  },
);

export function SimulatorTab({ data }: { data: Character }) {
  const tryText = useSearchParams().get("try");
  return (
    <Panel
      title="전투력 시뮬레이터"
      wide
      meta={
        <Link href={`/tools/combat-power?${new URLSearchParams({ character: data.characterName })}`}>
          도구 화면으로
        </Link>
      }
    >
      <div className={styles.simulatorPanel}>
        <Simulator
          key={tryText ?? ""}
          name={data.characterName}
          initial={data}
          start={readTryPath(tryText)}
          head={<p className={styles.simulatorLead}>값을 바꾸면 전투력이 얼마나 바뀌는지 항목별로 바로 계산해요.</p>}
        />
      </div>
    </Panel>
  );
}
