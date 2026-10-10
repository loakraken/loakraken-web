"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { m, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Fingerprint, Focus, Layers3, ScanLine, ShieldCheck, Terminal } from "lucide-react";
import { CharacterCockpit } from "./cockpit";
import { Hero } from "./hero";
import { LandingMotion, Reveal, useLandingMotion } from "./motion";
import { roadmap } from "./roadmap";
import { SiteHeader } from "@/components/site/site-header";
import { KrakenMark } from "@/components/site/kraken-mark";
import styles from "./landing.module.css";

export { KrakenMark } from "@/components/site/kraken-mark";

function PrecisionLanding() {
  const input = useRef<HTMLInputElement>(null);
  const { enabled } = useLandingMotion();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { scrollYProgress } = useScroll();
  const progressTransform = useTransform(scrollYProgress, (value) => `scaleX(${value})`);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const focusSearch = () => {
    input.current?.scrollIntoView({ behavior: enabled ? "smooth" : "instant", block: "center" });
    input.current?.focus({ preventScroll: true });
  };

  const evidence = JSON.stringify({ character: "블레이드", className: "블레이드", source: "design-preview", observation: { gems: 11, level10: 9, level9: [{ slot: 5, kind: "겁화", skill: "마엘스톰" }, { slot: 10, kind: "작열", skill: "터닝 슬래쉬" }] }, diagnosis: "9레벨 보석 2개 확인", evidencePath: "/example/gems/5,10", ruleVersion: "preview-v1" }, null, 2);

  async function copyEvidence() {
    try {
      await navigator.clipboard.writeText(evidence);
      setCopied(true); setCopyError(false);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError(true); }
  }

  return (
    <div className={styles.landing}>
      <a className={styles.skipLink} href="#main">본문으로 건너뛰기</a>
      <m.div className={styles.readingProgress} style={{ transform: progressTransform }} aria-hidden="true" />
      <SiteHeader fixed>
        <button type="button" className={styles.navCta} onClick={focusSearch}>캐릭터 검색 <ArrowUpRight size={14} /></button>
      </SiteHeader>

      <main id="main">
        <Hero inputRef={input} />

        <div className={styles.previewBand}><section className={styles.section} id="preview" aria-labelledby="preview-heading">
          <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>캐릭터 미리보기</span><h2 id="preview-heading">캐릭터의 지금을,<br className={styles.mobileBreak} /> 한눈에.</h2></div><p>장비부터 놓치기 쉬운 세팅까지.<br />당신에게 필요한 정보만, 명료하게.</p></Reveal>
          <Reveal delay={0.08}><CharacterCockpit /></Reveal>
          <Reveal className={styles.previewCaption}><span><Focus size={14} /> 필요한 정보에만 집중하세요.</span><span>예시 데이터 기반의 인터랙티브 미리보기</span></Reveal>
        </section></div>

        <section className={`${styles.section} ${styles.evidenceSection}`} id="evidence" aria-labelledby="evidence-heading">
          <Reveal className={styles.evidenceCopy}>
            <span className={styles.eyebrow}>이해할 수 있는 분석</span>
            <h2 id="evidence-heading">결과만큼,<br /><span>근거도 명확하게.</span></h2>
            <p className={styles.sectionDescription}>숫자 하나로 캐릭터를 단정하지 않습니다.<br />무엇을 확인했고, 왜 그렇게 판단했는지.<br />판단의 모든 과정을 함께 보여 줍니다.</p>
            <div className={styles.principles}>
              <div><span><ScanLine size={18} /></span><div><h3>있는 그대로 확인</h3><p>확인된 정보와 알 수 없는 정보를 구분합니다.</p></div></div>
              <div><span><Fingerprint size={18} /></span><div><h3>판단에 따라오는 근거</h3><p>판단의 출발점이 된 데이터까지 직접 확인합니다.</p></div></div>
              <div><span><Layers3 size={18} /></span><div><h3>변화도 추적 가능하게</h3><p>어떤 분석 기준을 적용했는지 함께 보여줍니다.</p></div></div>
            </div>
          </Reveal>
          <Reveal className={styles.evidenceVisual} delay={0.1}>
            <div className={styles.evidenceTop}><span><span className={styles.statusDot} /> 데이터에서 판단까지</span><span>예시</span></div>
            <div className={styles.pipeline}>
              {[{ icon: ScanLine, label: "캐릭터 정보", text: "장착된 보석 확인", sub: "11 / 11 슬롯" }, { icon: Focus, label: "규칙 확인", text: "최대 레벨 미만 감지", sub: "PREVIEW-V1" }, { icon: ShieldCheck, label: "근거", text: "9레벨 2개 · 교체 후보", sub: "근거와 함께 제시" }].map((step, i) => <div className={styles.pipelineStep} key={step.label}>
                <div className={styles.pipelineIcon}><step.icon size={18} />{i < 2 && <span className={styles.pipelineLine}><i /></span>}</div>
                <div><span>{step.label}</span><h3>{step.text}</h3></div><small>{step.sub}</small>
              </div>)}
            </div>
            <details className={styles.evidenceDetails}>
              <summary><span><Terminal size={15} /> 원본 데이터 보기</span><ChevronDown size={16} /></summary>
              <div className={styles.codeHeader}><span>예시 데이터 · JSON</span><button type="button" onClick={copyEvidence}>{copied ? <><Check size={12} /> 복사됨</> : "복사"}</button></div>
              <pre><code>{evidence}</code></pre>
              <span className={styles.srOnly} role="status">{copied ? "예시 근거를 복사했습니다." : copyError ? "복사할 수 없습니다. 코드를 직접 선택해 복사해 주세요." : ""}</span>
            </details>
            <div className={styles.evidenceBottom}><ShieldCheck size={13} /> 추측은 줄이고, 확인할 수 있는 근거를 더합니다.</div>
          </Reveal>
        </section>

        <section className={`${styles.section} ${styles.roadmapSection}`} id="roadmap" aria-labelledby="roadmap-heading">
          <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>앞으로의 LOAKraken</span><h2 id="roadmap-heading">더 나은 선택을 향해.</h2></div><p>검색과 분석에서 성장, 거래, 일상의 플레이까지.<br />캐릭터 성장의 모든 선택을 하나로 연결합니다.</p></Reveal>
          <Reveal className={styles.roadmapNote}><p>캐릭터 정보, 거래소 시세, 재련·치적 계산기, 주간 일정표를 실제 데이터로 제공하고 있습니다. 랭킹·통계는 표본을 모으는 중이고, 점수와 성능 예측은 계산 모델 검증을 마친 뒤 제공합니다.</p></Reveal>
          <div className={styles.roadmap}>
            {roadmap.map((item) => <Reveal key={item.number} className={styles.roadmapItem}>
              <span className={styles.roadmapNumber}>{item.number}</span><div><span className={styles.roadmapStatus} data-active={item.active}><i />{item.status}</span><h3>{item.title}</h3><p>{item.description}</p><p className={styles.roadmapScope}>{item.scope}</p></div>
            </Reveal>)}
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-heading">
          <Reveal><span className={styles.closingMark}><KrakenMark size={40} /></span><h2 id="closing-heading">다음 성장은,<br /><span>더 명확한 선택에서.</span></h2><p>당신의 캐릭터를 이해하는 새로운 시선.</p><button type="button" className={styles.primaryButton} onClick={focusSearch}>캐릭터 검색 <ArrowRight size={16} /></button></Reveal>
        </section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.brand}><KrakenMark />LOAKraken</Link><p>로스트아크 비공식 팬 프로젝트</p><a href="https://libraries.dev/orbs" target="_blank" rel="noreferrer">Motion with Libraries.dev <ArrowUpRight size={12} /></a></footer>
    </div>
  );
}

export function Landing() {
  return <LandingMotion><PrecisionLanding /></LandingMotion>;
}
