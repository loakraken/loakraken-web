"use client";

// 구성 (stats B4): under the class table, the same sample split three ways —
// by role (api #779 `composition`, shown once the api sends it), by 직업군
// (the rows grouped with the official class groups) and, for the classes that
// can play support, how many play which role.
import type { CSSProperties } from "react";
import { SUPPORT_CLASSES, groupColor, groupShares } from "@/lib/stats/class-groups";
import { share, whole, type ClassRow, type Composition } from "@/lib/stats/model";
import { HelpInfo } from "./basis-note";
import { ClassIcon } from "./class-icon";
import styles from "./stats.module.css";

/** `color`: the row's role or 직업군 colour (globals.css, user 11-08); its name is beside it. */
type Part = { label: string; count: number; total: number; color: string; help?: React.ReactNode };

/** One labelled row: name, count, share and a bar of that share (grows on the tab's first showing). */
function ShareRow({ label, count, total, color, help, index }: Part & { index: number }) {
  const value = total ? (count / total) * 100 : 0;
  return (
    <li>
      <span className={styles.partLabel}>
        {label}
        {help}
      </span>
      <span className={styles.partValue}>
        {share(value)} <small>{whole(count)}명</small>
      </span>
      <span className={styles.partBar} aria-hidden="true">
        <i className="k-grow-x" style={{ width: `${value}%`, "--i": index, "--bar": color } as CSSProperties} />
      </span>
    </li>
  );
}

/** A support-capable class: its supports and dealers side by side in one bar (the rest: role not seen). */
function SplitRow({ row, index }: { row: ClassRow; index: number }) {
  const supports = row.count ? (row.supports / row.count) * 100 : 0;
  const dealers = row.count ? (row.dealers / row.count) * 100 : 0;
  return (
    <li>
      <span className={styles.partLabel}>
        <ClassIcon name={row.className} size={20} />
        {row.className}
      </span>
      {/* The same colours as the 역할 rows: these dealers are 서포터 직업 딜러. */}
      <span className={styles.partValue}>
        <span className={styles.swatch} style={{ "--swatch": "var(--role-support)" } as CSSProperties}>
          서포터 {share(supports)}
        </span>{" "}
        ·{" "}
        <span className={styles.swatch} style={{ "--swatch": "var(--role-support-dealer-fill)" } as CSSProperties}>
          딜러 {share(dealers)}
        </span>
      </span>
      <span className={styles.partBar} aria-hidden="true">
        <i
          className="k-grow-x"
          style={{ width: `${supports}%`, "--i": index, "--bar": "var(--role-support)" } as CSSProperties}
        />
        <b
          className="k-grow-x"
          style={{ left: `${supports}%`, width: `${dealers}%`, "--i": index, "--bar-2": "var(--role-support-dealer-fill)" } as CSSProperties}
        />
      </span>
    </li>
  );
}

export function CompositionBlock({ rows, composition }: { rows: readonly ClassRow[]; composition?: Composition }) {
  const groups = groupShares(rows);
  const supportRows = SUPPORT_CLASSES.map((name) => rows.find((row) => row.className === name)).filter(
    (row): row is ClassRow => !!row && row.count > 0,
  );
  if (!groups.length) return null;
  const roleTotal = composition
    ? composition.dealer + composition.supportClassDealer + composition.support + composition.unknownRole
    : 0;
  const roles: Part[] = composition
    ? [
        { label: "딜러 직업", count: composition.dealer, total: roleTotal, color: "var(--role-dealer)" },
        {
          label: "서포터 직업 딜러",
          count: composition.supportClassDealer,
          total: roleTotal,
          color: "var(--role-support-dealer-fill)",
          help: (
            <HelpInfo label="서포터 직업 딜러 설명" title="서포터 직업 딜러">
              <p>
                서포터를 할 수 있는 직업({SUPPORT_CLASSES.join("·")})인데 딜러로 확인된 캐릭터예요. 이 네 직업이 아닌 캐릭터는 모두
                딜러로 셌어요.
              </p>
            </HelpInfo>
          ),
        },
        { label: "서포터", count: composition.support, total: roleTotal, color: "var(--role-support)" },
        ...(composition.unknownRole > 0
          ? [{ label: "역할 미확인", count: composition.unknownRole, total: roleTotal, color: "var(--role-unknown)" }]
          : []),
      ]
    : [];
  const groupTotal = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <section className={styles.composition} aria-labelledby="stats-composition">
      <h2 id="stats-composition" className={styles.blockTitle}>
        표본 구성
      </h2>
      <div className={styles.compositionGrid}>
        {roles.length > 0 && (
          <div className={styles.part} role="group" aria-label="역할">
            <h3>역할</h3>
            <ul>
              {roles.map((part, i) => (
                <ShareRow key={part.label} {...part} index={i} />
              ))}
            </ul>
          </div>
        )}
        <div className={styles.part} role="group" aria-label="직업군">
          <h3>직업군</h3>
          <ul>
            {groups.map((g, i) => (
              <ShareRow key={g.group} label={g.group} count={g.count} total={groupTotal} color={groupColor(g.group)} index={i} />
            ))}
          </ul>
        </div>
        {supportRows.length > 0 && (
          <div className={styles.part} role="group" aria-label="서포터 직업별 역할">
            <h3>서포터 직업별 역할</h3>
            <ul>
              {supportRows.map((row, i) => (
                <SplitRow key={row.className} row={row} index={i} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
