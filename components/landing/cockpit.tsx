"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, m } from "motion/react";
import { ArrowUpRight, Check, ChevronRight, CircleHelp, Gem, ShieldCheck, Sparkles, Swords } from "lucide-react";
import { InlineOrb } from "./orb";
import { useLandingMotion } from "./motion";
import styles from "./landing.module.css";

const equipment = [
  { name: "무기", value: "+25", progress: 88, icon: Swords },
  { name: "초월", value: "126", progress: 100, icon: Sparkles },
  { name: "엘릭서", value: "40", progress: 76, icon: ShieldCheck },
];

export function CharacterCockpit() {
  const [tab, setTab] = useState("overview");
  const [keyboard, setKeyboard] = useState(false);
  const { enabled } = useLandingMotion();

  return (
    <div className={styles.cockpit}>
      <div className={styles.windowBar}>
        <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
        <span>나의 캐릭터</span>
        <span className={styles.sampleBadge}>예시 데이터</span>
      </div>
      <div className={styles.cockpitBody}>
        <div className={styles.characterHeader}>
          <div className={styles.characterIdentity}>
            <div className={styles.characterAvatar}><Swords size={26} strokeWidth={1.25} /></div>
            <div><span className={styles.eyebrow}>캐릭터 프로필</span><h3>별빛모험가 <span>바드</span></h3><p>아만 <span>·</span> 전투 레벨 70</p></div>
          </div>
          <div className={styles.itemLevel}><span>아이템 레벨</span><strong>1,700<span>.50</span></strong></div>
        </div>
        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as string)}>
          <Tabs.List className={styles.cockpitTabs} aria-label="캐릭터 미리보기 영역" data-keyboard={keyboard}
            onKeyDownCapture={() => setKeyboard(true)} onPointerDownCapture={() => setKeyboard(false)}>
            <Tabs.Tab className={styles.cockpitTab} value="overview">종합 관측</Tabs.Tab>
            <Tabs.Tab className={styles.cockpitTab} value="equipment">장비·보석</Tabs.Tab>
            <Tabs.Indicator className={styles.tabIndicator} />
          </Tabs.List>
          <div className={styles.panelSpace}>
            <AnimatePresence mode="wait" initial={false}>
              <m.div key={tab} initial={enabled && !keyboard ? { opacity: 0, transform: "translateY(6px)" } : false}
                animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0 }}
                transition={{ duration: enabled && !keyboard ? 0.18 : 0 }}>
                <Tabs.Panel value={tab} className={styles.cockpitPanel}>
                  {tab === "overview" ? <>
                    <div className={styles.equipmentOverview}>
                      <div className={styles.cardHeading}><span>성장의 기반</span><Swords size={15} /></div>
                      {equipment.map(({ name, value, progress, icon: Icon }) => <div key={name} className={styles.equipmentRow}>
                        <span className={styles.equipmentIcon}><Icon size={17} /></span>
                        <div><div className={styles.metricHeading}><span>{name}</span><strong>{value}{name === "초월" && <small> ★</small>}</strong></div>
                          <div className={styles.meter}><span style={{ transform: `scaleX(${progress / 100})` }} /></div></div>
                      </div>)}
                      <span className={styles.mutedCaption}>표시된 수치는 화면 설명용 예시입니다.</span>
                    </div>
                    <div className={styles.observationCard}>
                      <div className={styles.cardHeading}><span>관측 현황</span><InlineOrb state="connecting" /></div>
                      <div className={styles.observedCount}><strong>06</strong><span>/ 08 영역</span></div>
                      <div className={styles.coverageBlocks} aria-label="8개 영역 중 6개 확인 예시">{Array.from({ length: 8 }, (_, i) => <i key={i} data-observed={i < 6} />)}</div>
                      <ul className={styles.statusList}>
                        <li><span><Check size={13} /> 장비 · 각인 · 보석</span><b>확인됨</b></li>
                        <li><span><CircleHelp size={13} /> 아크 그리드</span><b>데이터 없음</b></li>
                      </ul>
                    </div>
                    <div className={styles.diagnosticCard}>
                      <div className={styles.cardHeading}><span>다음으로 살펴볼 것</span><ArrowUpRight size={16} /></div>
                      <span className={styles.diagnosticLabel}><span /> 확인 필요</span>
                      <h4>보석의 빈 슬롯을<br />확인해 보세요.</h4>
                      <p>현재 세팅에서 놓친 부분부터.<br />수치와 근거를 함께 살펴봅니다.</p>
                      <a href="#evidence" className={styles.cardLink}>진단 근거 보기 <ChevronRight size={14} /></a>
                    </div>
                  </> : <div className={styles.gemPanel}>
                    <div><div className={styles.cardHeading}><span>보석 장착 현황</span><Gem size={16} /></div>
                      <div className={styles.gemGrid}>{Array.from({ length: 11 }, (_, i) => <div key={i} className={styles.gemSlot} data-empty={i === 10}>
                        {i === 10 ? <span>빈 슬롯</span> : <><Gem size={22} /><b>{i < 4 ? "10" : "9"}<small> LV</small></b></>}
                      </div>)}</div>
                    </div>
                    <div className={styles.gemDescription}><span className={styles.diagnosticLabel}>예시 진단</span><h4>장착 상태부터,<br />하나씩 정확하게.</h4><p>미장착 슬롯과 확인할 수 없는 데이터를 구분합니다. 정보가 없는 항목을 임의로 0점 처리하지 않습니다.</p></div>
                  </div>}
                </Tabs.Panel>
              </m.div>
            </AnimatePresence>
          </div>
        </Tabs.Root>
      </div>
      <div className={styles.cockpitFooter}><span><i /> 디자인 미리보기</span><span>실제 캐릭터 정보가 아닙니다</span></div>
    </div>
  );
}
