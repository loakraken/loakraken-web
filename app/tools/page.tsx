import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Setting } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { TOOLS, visibleTools } from "@/lib/tools/catalog";
import { isCombatPowerEnabled, isCritSpeedEnabled } from "@/lib/tools/flags";
import quote from "@/components/tools/material-quote.module.css";
import styles from "@/components/tools/tool-list.module.css";

export const metadata: Metadata = {
  title: "성장 도구",
  description:
    "재련 기대 비용·재료 견적·경매 입찰가·더보기 손익·레이드 보상표·숙제 체크 등 로스트아크 성장 도구 모음입니다.",
};

const GROUPS = [...new Set(TOOLS.map((tool) => tool.group))];

export default async function ToolsPage() {
  // Runtime flags (crit-speed is hidden on production until it is re-checked).
  await connection();
  const tools = visibleTools({
    critSpeed: isCritSpeedEnabled(),
    combatPower: isCombatPowerEnabled(),
  });
  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#tools-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="tools-main">
        <section className={quote.hero} aria-labelledby="tools-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Setting size={18} />
          </span>
          <p className={quote.heroKicker}>성장 도구</p>
          <h1 id="tools-heading">도구 모음</h1>
          <p className={quote.heroCopy}>재련·경매·레이드 보상까지, 계산은 공식 자료와 시세로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>
        <div className={quote.band}>
          <div className={styles.workspace}>
            {GROUPS.map((group) => (
              <section key={group} aria-labelledby={`tools-${group}`}>
                <h2 id={`tools-${group}`} className={styles.groupTitle}>
                  {group}
                </h2>
                <ul className={styles.grid}>
                  {tools
                    .filter((tool) => tool.group === group)
                    .map((tool) => (
                      <li key={tool.href}>
                        <Link href={tool.href} className={styles.card}>
                          <span>
                            <strong>{tool.label}</strong>
                            <small>{tool.description}</small>
                          </span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
