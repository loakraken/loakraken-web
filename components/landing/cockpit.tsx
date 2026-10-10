"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, m } from "motion/react";
import { ChevronRight, Diamonds, ExportCircle, FlashCircle, MessageQuestion, TickCircle } from "@/components/ui/icons";
import { GameIcon } from "@/components/character/imagery";
import { InlineOrb } from "./orb";
import { useLandingMotion } from "./motion";
import { accessories, armor, belowMaxGems, gemAverage, gems, itemLevel, previewCharacter as hero } from "./preview-character";
import styles from "./landing.module.css";

const [whole, fraction] = itemLevel.toFixed(2).split(".");
const armorAverage = armor.slice(1).reduce((sum, piece) => sum + piece.refine, 0) / (armor.length - 1);
const equipment = [
  { name: "무기", value: `+${armor[0].refine}`, progress: armor[0].refine / 25, icon: armor[0].icon },
  { name: "방어구 평균", value: `+${armorAverage.toFixed(1)}`, progress: armorAverage / 25, icon: armor[1].icon },
  { name: "보석 평균", value: `Lv.${gemAverage.toFixed(1)}`, progress: gemAverage / 10, icon: gems[0].icon },
];
const qualityTier = (q: number) => (q >= 100 ? "max" : q >= 90 ? "high" : q >= 70 ? "good" : "normal");

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
            <div className={styles.characterAvatar}>
              {/* eslint-disable-next-line @next/next/no-img-element -- official CDN class emblem at a fixed size */}
              <img src={hero.emblem} alt="" width={40} height={40} referrerPolicy="no-referrer" />
            </div>
            <div><span className={styles.eyebrow}>캐릭터 프로필</span><h3>{hero.name} <span>{hero.className}</span></h3><p>{hero.server} <span>·</span> 전투 레벨 {hero.combatLevel}</p></div>
          </div>
          <div className={styles.itemLevel}><span>아이템 레벨</span><strong>{Number(whole).toLocaleString("ko-KR")}<span>.{fraction}</span></strong></div>
        </div>
        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as string)}>
          <Tabs.List className={styles.cockpitTabs} aria-label="캐릭터 미리보기 영역" data-keyboard={keyboard}
            onKeyDownCapture={() => setKeyboard(true)} onPointerDownCapture={() => setKeyboard(false)}>
            <Tabs.Tab className={styles.cockpitTab} value="overview">종합</Tabs.Tab>
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
                      <div className={styles.cardHeading}><span>성장의 기반</span><FlashCircle size={15} /></div>
                      {equipment.map(({ name, value, progress, icon }) => <div key={name} className={styles.equipmentRow}>
                        <GameIcon src={icon} grade="고대" size={32} />
                        <div><div className={styles.metricHeading}><span>{name}</span><strong>{value}</strong></div>
                          <div className={styles.meter}><span style={{ transform: `scaleX(${progress})` }} /></div></div>
                      </div>)}
                      <span className={styles.mutedCaption}>운명의 전율 T4 · 최대 +25 · 보석 최대 10레벨 기준 예시</span>
                    </div>
                    <div className={styles.observationCard}>
                      <div className={styles.cardHeading}><span>확인 현황</span><InlineOrb state="connecting" /></div>
                      <div className={styles.observedCount}><strong>06</strong><span>/ 08 영역</span></div>
                      <div className={styles.coverageBlocks} aria-label="8개 영역 중 6개 확인 예시">{Array.from({ length: 8 }, (_, i) => <i key={i} data-observed={i < 6} />)}</div>
                      <ul className={styles.statusList}>
                        <li><span><TickCircle size={13} /> 장비 · 각인 · 보석</span><b>확인됨</b></li>
                        <li><span><MessageQuestion size={13} /> 아크 그리드</span><b>데이터 없음</b></li>
                      </ul>
                    </div>
                    <div className={styles.diagnosticCard}>
                      <div className={styles.cardHeading}><span>다음으로 살펴볼 것</span><ExportCircle size={16} /></div>
                      <span className={styles.diagnosticLabel}><span /> 확인 필요</span>
                      <h4>9레벨 보석 {belowMaxGems.length}개,<br />다음 성장 후보예요.</h4>
                      <p>{belowMaxGems.map((g) => `${g.skill} ${g.kind}`).join(" · ")}.<br />수치와 근거를 함께 살펴봅니다.</p>
                      <a href="#evidence" className={styles.cardLink}>근거 보기 <ChevronRight size={14} /></a>
                    </div>
                  </> : <div className={styles.gemPanel}>
                    <div>
                      <div className={styles.cardHeading}><span>장비</span><FlashCircle size={15} /></div>
                      <ul className={styles.gearGrid}>{armor.map((piece) => <li key={piece.slot} title={piece.name}>
                        <GameIcon src={piece.icon} grade={piece.grade} size={36} />
                        <span><b>{piece.slot} +{piece.refine}</b><small>T4 · {piece.name}</small></span>
                        <i data-tier={qualityTier(piece.quality)} aria-label={`품질 ${piece.quality}`}>{piece.quality}</i>
                      </li>)}</ul>
                      <ul className={styles.accessoryStrip} aria-label="장신구·팔찌·어빌리티 스톤">{accessories.map((item, i) => <li key={i} title={`${item.name} · ${item.grade}`}>
                        <GameIcon src={item.icon} grade={item.grade} size={30} />
                        <small>{item.slot === "어빌리티 스톤" ? "스톤" : item.slot}</small>
                      </li>)}</ul>
                    </div>
                    <div>
                      <div className={styles.cardHeading}><span>보석 · 평균 {gemAverage.toFixed(1)}</span><Diamonds size={16} /></div>
                      <ul className={styles.gemGrid}>{gems.map((g, i) => <li key={i} className={styles.gemSlot} data-below={g.level < 10 || undefined} title={`${g.level}레벨 ${g.kind}의 보석 · ${g.skill}`}>
                        <GameIcon src={g.icon} grade={g.level === 10 ? "고대" : "유물"} size={34} />
                        <b>{g.level}{g.kind === "겁화" ? "뎀" : "쿨"}</b>
                      </li>)}</ul>
                      <p className={styles.gemNote}><span className={styles.diagnosticLabel}><span /> 예시 점검</span> 9레벨 {belowMaxGems.length}개를 10레벨로 바꾸면 보석 평균이 10.0이 됩니다.</p>
                    </div>
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
