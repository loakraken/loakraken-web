"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BorderBeam } from "border-beam";
import { m, useInView, useMotionTemplate, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Command, Fingerprint, Focus, Layers3, Pause, Play, ScanLine, Search, ShieldCheck, Terminal } from "lucide-react";
import { CharacterCockpit } from "./cockpit";
import { IntelligenceOrb, InlineOrb } from "./orb";
import { LandingMotion, Reveal, useLandingMotion } from "./motion";
import { roadmap } from "./roadmap";
import { characterNameError, normalizeCharacterName } from "@/lib/character/model";
import styles from "./landing.module.css";

export function KrakenMark() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v7m-4-4 1 5m7-5-1 5M8 14l-3 5m11-5 3 5M8 19h8M3 21h18M3 12l2 1m16-1-2 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="13" r="2" fill="currentColor" stroke="none" /></svg>;
}

const noSubscribe = () => () => {};
// Platform is unknown during SSR; render the hint only after hydration to avoid a mismatch.
const platformKey = () => (/mac|iphone|ipad/i.test(navigator.platform) ? "mac" : "other");

function PrecisionLanding() {
  const shortcutKey = useSyncExternalStore(noSubscribe, platformKey, () => null);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const hero = useRef<HTMLElement>(null);
  const heroVisible = useInView(hero);
  const { enabled, paused, toggle } = useLandingMotion();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeSection, setActiveSection] = useState("intro");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { scrollYProgress } = useScroll();
  const progressTransform = useTransform(scrollYProgress, (value) => `scaleX(${value})`);
  const rotateX = useSpring(0, { stiffness: 100, damping: 20 });
  const rotateY = useSpring(0, { stiffness: 100, damping: 20 });
  const orbTransform = useMotionTemplate`perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.scrollIntoView({ behavior: "instant", block: "center" });
        input.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", shortcut);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
    }, { rootMargin: "-15% 0px -55% 0px" });
    for (const id of ["intro", "preview", "evidence", "roadmap"]) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => { window.removeEventListener("keydown", shortcut); observer.disconnect(); clearTimeout(copyTimer.current); };
  }, []);

  const focusSearch = () => {
    input.current?.scrollIntoView({ behavior: enabled ? "smooth" : "instant", block: "center" });
    input.current?.focus({ preventScroll: true });
  };

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeCharacterName(query);
    const issue = characterNameError(name);
    if (issue) { setError(issue); input.current?.focus(); return; }
    setError(""); setSearching(true);
    router.push(`/character/${encodeURIComponent(name)}`);
  }

  const evidence = JSON.stringify({ character: "별빛모험가", source: "design-preview", observation: { gemSlots: 11, equipped: 10 }, diagnosis: "빈 보석 슬롯 확인", evidencePath: "/example/gems/10", ruleVersion: "preview-v1" }, null, 2);

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
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="LOAKraken 홈"><span className={styles.brandIcon}><KrakenMark /></span><span>LOAKraken</span><span className={styles.brandTag}>BETA</span></Link>
        <nav className={styles.navigation} aria-label="주요 메뉴">
          {[{ id: "intro", name: "소개" }, { id: "preview", name: "캐릭터 미리보기" }, { id: "evidence", name: "진단 근거" }, { id: "roadmap", name: "로드맵" }].map((item) => <a key={item.id} href={`#${item.id}`} data-active={activeSection === item.id} aria-current={activeSection === item.id ? "location" : undefined}>{item.name}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <button type="button" className={styles.motionToggle} onClick={toggle} aria-label={paused ? "모션 재생" : "모션 일시정지"} aria-pressed={paused} title={paused ? "모션 재생" : "모션 일시정지"}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
          <button type="button" className={styles.navCta} onClick={focusSearch}>캐릭터 검색 <ArrowUpRight size={14} /></button>
        </div>
      </header>

      <main id="main">
        <section ref={hero} className={styles.hero} id="intro" aria-labelledby="hero-heading" data-in-view={heroVisible}>
          <div className={styles.heroContent}>
            <div className={`${styles.statusPill} ${styles.heroEnter}`}>LOAKraken</div>
            <h1 className={`${styles.heroTitle} ${styles.heroEnter}`} id="hero-heading">당신의 캐릭터.<br /><span>가능성을 더 선명하게.</span></h1>
            <p className={`${styles.heroDescription} ${styles.heroEnter}`}>지금의 세팅부터 다음 성장까지.<br />흩어진 정보를 모아, 더 명확한 선택으로.</p>
            <m.div className={styles.orbInteraction} style={{ transform: enabled ? orbTransform : "none" }}
              onPointerMove={(event) => {
                if (!enabled || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                const box = event.currentTarget.getBoundingClientRect();
                rotateX.set((0.5 - (event.clientY - box.top) / box.height) * 12);
                rotateY.set(((event.clientX - box.left) / box.width - 0.5) * 12);
              }} onPointerLeave={() => { rotateX.set(0); rotateY.set(0); }}>
              <IntelligenceOrb state={searching ? "searching" : focused ? "connecting" : "breathing"} />
            </m.div>
            <p className={styles.orbCaption}><span className={styles.statusDot} />{searching ? "캐릭터 화면으로 이동하고 있어요" : focused ? "어떤 캐릭터를 살펴볼까요?" : "당신의 다음 선택을 기다리고 있어요"}</p>
            <div className={styles.searchArea}>
              <BorderBeam className={styles.searchBeam} theme="light" colorVariant="mono" staticColors size="line" duration={5} strength={focused ? 0.55 : 0.22} active={enabled && heroVisible} borderRadius={36}>
                <form className={styles.searchForm} onSubmit={search} noValidate aria-busy={searching}>
                  <label htmlFor="character-search" className={styles.srOnly}>캐릭터 이름</label>
                  <Search className={styles.searchIcon} size={19} aria-hidden="true" />
                  <input ref={input} id="character-search" name="character" value={query} onChange={(event) => { setQuery(event.target.value); if (error) setError(""); }}
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="캐릭터 이름을 입력하세요" maxLength={65} autoComplete="off" spellCheck={false} disabled={searching} aria-invalid={!!error} aria-describedby={error ? "search-error" : "search-help"} />
                  {shortcutKey && <kbd className={styles.shortcut} aria-hidden="true">{shortcutKey === "mac" ? <Command size={12} /> : "Ctrl"} K</kbd>}
                  <button className={styles.searchSubmit} type="submit" disabled={searching} aria-label={searching ? "캐릭터 화면으로 이동 중" : undefined}>{searching ? <InlineOrb /> : <>캐릭터 검색 <ArrowRight size={16} /></>}</button>
                </form>
              </BorderBeam>
              <div className={styles.searchMessage} aria-live="polite">{error ? <p id="search-error" className={styles.error}>{error}</p> : <p id="search-help">이름으로 캐릭터의 현재 정보를 조회하세요. <a href="#preview">예시 화면 살펴보기 <ArrowUpRight size={12} /></a></p>}</div>
            </div>
          </div>
          <a className={styles.exploreLink} href="#preview">새로운 관측 경험 살펴보기 <ArrowDown size={16} /></a>
        </section>

        <div className={styles.previewBand}><section className={styles.section} id="preview" aria-labelledby="preview-heading">
          <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>캐릭터 미리보기</span><h2 id="preview-heading">캐릭터의 지금을,<br className={styles.mobileBreak} /> 한눈에.</h2></div><p>장비부터 놓치기 쉬운 세팅까지.<br />당신에게 필요한 정보만, 명료하게.</p></Reveal>
          <Reveal delay={0.08}><CharacterCockpit /></Reveal>
          <Reveal className={styles.previewCaption}><span><Focus size={14} /> 필요한 정보에만 집중하세요.</span><span>예시 데이터 기반의 인터랙티브 미리보기</span></Reveal>
        </section></div>

        <section className={`${styles.section} ${styles.evidenceSection}`} id="evidence" aria-labelledby="evidence-heading">
          <Reveal className={styles.evidenceCopy}>
            <span className={styles.eyebrow}>이해할 수 있는 분석</span>
            <h2 id="evidence-heading">결과만큼,<br /><span>근거도 명확하게.</span></h2>
            <p className={styles.sectionDescription}>숫자 하나로 캐릭터를 단정하지 않습니다.<br />무엇을 확인했고, 왜 그렇게 판단했는지.<br />진단의 모든 과정이 연결됩니다.</p>
            <div className={styles.principles}>
              <div><span><ScanLine size={18} /></span><div><h3>있는 그대로 관측</h3><p>확인된 정보와 알 수 없는 정보를 구분합니다.</p></div></div>
              <div><span><Fingerprint size={18} /></span><div><h3>판단에 따라오는 근거</h3><p>진단이 시작된 데이터까지 직접 확인합니다.</p></div></div>
              <div><span><Layers3 size={18} /></span><div><h3>변화도 추적 가능하게</h3><p>어떤 분석 기준을 적용했는지 함께 보여줍니다.</p></div></div>
            </div>
          </Reveal>
          <Reveal className={styles.evidenceVisual} delay={0.1}>
            <div className={styles.evidenceTop}><span><span className={styles.statusDot} /> 데이터에서 판단까지</span><span>예시</span></div>
            <div className={styles.pipeline}>
              {[{ icon: ScanLine, label: "관측 데이터", text: "장착된 보석 확인", sub: "10 / 11 슬롯" }, { icon: Focus, label: "규칙 확인", text: "미장착 슬롯 감지", sub: "PREVIEW-V1" }, { icon: ShieldCheck, label: "진단 근거", text: "빈 슬롯 확인 필요", sub: "근거와 함께 제시" }].map((step, i) => <div className={styles.pipelineStep} key={step.label}>
                <div className={styles.pipelineIcon}><step.icon size={18} />{i < 2 && <span className={styles.pipelineLine}><i /></span>}</div>
                <div><span>{step.label}</span><h3>{step.text}</h3></div><small>{step.sub}</small>
              </div>)}
            </div>
            <details className={styles.evidenceDetails}>
              <summary><span><Terminal size={15} /> 진단 근거 보기</span><ChevronDown size={16} /></summary>
              <div className={styles.codeHeader}><span>예시 데이터 · JSON</span><button type="button" onClick={copyEvidence}>{copied ? <><Check size={12} /> 복사됨</> : "복사"}</button></div>
              <pre><code>{evidence}</code></pre>
              <span className={styles.srOnly} role="status">{copied ? "예시 근거를 복사했습니다." : copyError ? "복사할 수 없습니다. 코드를 직접 선택해 복사해 주세요." : ""}</span>
            </details>
            <div className={styles.evidenceBottom}><ShieldCheck size={13} /> 추측은 줄이고, 확인할 수 있는 근거를 더합니다.</div>
          </Reveal>
        </section>

        <section className={`${styles.section} ${styles.roadmapSection}`} id="roadmap" aria-labelledby="roadmap-heading">
          <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>앞으로의 LOAKraken</span><h2 id="roadmap-heading">더 나은 선택을 향해.</h2></div><p>검색과 분석에서 성장, 거래, 일상의 플레이까지.<br />캐릭터 성장의 모든 선택을 하나로 연결합니다.</p></Reveal>
          <Reveal className={styles.roadmapNote}><p>캐릭터 조회와 관측 근거를 실제 데이터로 제공하고 있습니다. 아래는 구현 완료 목록이 아닌 제품 목표입니다. 성장 이력은 저장 기준을 정한 뒤, 점수·랭킹·성능 예측은 계산 모델과 데이터 검증을 마친 뒤 제공합니다.</p></Reveal>
          <div className={styles.roadmap}>
            {roadmap.map((item) => <Reveal key={item.number} className={styles.roadmapItem}>
              <span className={styles.roadmapNumber}>{item.number}</span><div><span className={styles.roadmapStatus} data-active={item.active}><i />{item.status}</span><h3>{item.title}</h3><p>{item.description}</p><p className={styles.roadmapScope}>{item.scope}</p></div>
            </Reveal>)}
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-heading">
          <Reveal><span className={styles.closingMark}><KrakenMark /></span><h2 id="closing-heading">다음 성장은,<br /><span>더 명확한 선택에서.</span></h2><p>당신의 캐릭터를 이해하는 새로운 시선.</p><button type="button" className={styles.primaryButton} onClick={focusSearch}>캐릭터 검색 <ArrowRight size={16} /></button></Reveal>
        </section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.brand}><KrakenMark />LOAKraken</Link><p>로스트아크 비공식 팬 프로젝트 · 캐릭터 관측</p><a href="https://libraries.dev/orbs" target="_blank" rel="noreferrer">Motion with Libraries.dev <ArrowUpRight size={12} /></a></footer>
    </div>
  );
}

export function Landing() {
  return <LandingMotion><PrecisionLanding /></LandingMotion>;
}
