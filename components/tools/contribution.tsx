"use client";
// 기여도 계산기 (checklist L41): pick a gate, type the damage you dealt, see
// where it sits between that gate's lower and upper bounds. All numbers are
// the verified sample's (lib/tools/contribution.ts); each gate shows its
// basis date and no source (사용자 결정 10-12).
//
// Motion (사용자 10-16): the % counts from the shown value to the new one in
// ~0.3s, the bar's fill scales and its marker slides (transform only, no
// layout), a band change rings the marker once, and typing again mid-way
// carries on from where it is. Reduced motion shows the new value at once.
// Screen readers hear the final value only.
import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "@/components/landing/motion-context";
import Link from "next/link";
import { ArrowLeft, Flash } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { Select } from "@/components/ui/select";
import {
  RAIDS,
  difficultiesOf,
  formatEok,
  gatesOf,
  parseDamage,
  position,
  type Band,
} from "@/lib/tools/contribution";
import quote from "./material-quote.module.css";
import styles from "./contribution.module.css";

const BAND_TEXT: Record<Band, string> = {
  BELOW_LOW: "하한 아래예요",
  IN_RANGE: "범위 안이에요",
  ABOVE_HIGH: "상한 위예요",
};

const COUNT_MS = 300;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const pctText = (value: number) => `${(Math.round(value * 10) / 10).toLocaleString("ko-KR")}%`;

/** The shown number runs to `target` from wherever it is now (interruptible). */
function useCountTo(target: number | null) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(target);
  const now = useRef(target);
  useEffect(() => {
    if (target == null || reduce) {
      now.current = target;
      return;
    }
    // From nothing (first damage typed) it counts up from 0, as the fill grows from the left end.
    const from = now.current ?? 0;
    if (from === target) {
      const frame = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(time) {
      const t = Math.min(1, (time - start) / COUNT_MS);
      now.current = from + (target - from) * easeOut(t);
      setShown(now.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);
  return target == null || reduce ? target : shown;
}

export function ContributionTool() {
  const damageId = useId();
  const [raid, setRaid] = useState(RAIDS[RAIDS.length - 1]);
  const [difficulty, setDifficulty] = useState(() => difficultiesOf(RAIDS[RAIDS.length - 1])[0]);
  const [gateNo, setGateNo] = useState(1);
  const [text, setText] = useState("");

  const difficulties = difficultiesOf(raid);
  const gates = gatesOf(raid, difficulty);
  const gate = gates.find((g) => g.gate === gateNo) ?? gates[0];
  const damage = parseDamage(text);
  const error = damage !== null && Number.isNaN(damage) ? "숫자만 입력해 주세요(억 단위)." : null;
  const range = gate.low != null && gate.high != null ? { low: gate.low, high: gate.high } : null;
  const result = range && damage !== null && !error ? position(damage, range) : null;
  // The marker stays on the bar; past either end it sits at the edge.
  const marker = result ? Math.min(100, Math.max(0, result.pct)) : null;
  const refAt =
    range && gate.reference != null ? ((gate.reference - range.low) / (range.high - range.low)) * 100 : null;
  const shownPct = useCountTo(result ? result.pct : null);
  // A band change (e.g. into 범위 안) rings the marker once; the count is the ring's key.
  const [ring, setRing] = useState({ band: result?.band ?? null, count: 0 });
  if (result && result.band !== ring.band) {
    setRing({ band: result.band, count: ring.band ? ring.count + 1 : ring.count });
  }

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#contribution-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="contribution-main">
        <section className={quote.hero} aria-labelledby="contribution-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Flash size={18} />
          </span>
          <p className={quote.heroKicker}>레이드 계산</p>
          <h1 id="contribution-heading">기여도 계산기</h1>
          <p className={quote.heroCopy}>내 피해량이 그 관문에서 어느 정도인지, 하한과 상한 사이로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>

        <div className={quote.band}>
          <div className={quote.workspace}>
            <section className={quote.card} aria-labelledby="contribution-pick">
              <h2 id="contribution-pick">관문과 피해량</h2>
              <div className={styles.fields}>
                <div className={quote.field}>
                  <span id="contribution-raid">레이드</span>
                  <Select
                    aria-labelledby="contribution-raid"
                    value={raid}
                    items={RAIDS.map((r) => ({ value: r, label: r }))}
                    onValueChange={(next) => {
                      setRaid(next);
                      setDifficulty(difficultiesOf(next)[0]);
                      setGateNo(1);
                    }}
                  />
                </div>
                <div className={quote.field}>
                  <span id="contribution-difficulty">난이도</span>
                  <Select
                    aria-labelledby="contribution-difficulty"
                    value={difficulty}
                    items={difficulties.map((d) => ({ value: d, label: d }))}
                    onValueChange={(next) => {
                      setDifficulty(next);
                      setGateNo(1);
                    }}
                  />
                </div>
                <div className={quote.field}>
                  <span id="contribution-gate">관문</span>
                  <Select
                    aria-labelledby="contribution-gate"
                    value={gate.gate}
                    items={gates.map((g) => ({ value: g.gate, label: `${g.gate}관문${g.boss ? ` · ${g.boss}` : ""}` }))}
                    onValueChange={(next) => setGateNo(Number(next))}
                  />
                </div>
                <div className={quote.field} data-grow="">
                  <label htmlFor={damageId}>
                    <span>내 피해량(억)</span>
                  </label>
                  <input
                    id={damageId}
                    name="damage"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="예: 1,800…"
                    maxLength={12}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${damageId}-error` : undefined}
                  />
                  {/* Always laid out, one line high: an error arriving pushed the
                      result card 31px (PM-프론트 #582 P1, 점검표 A7). */}
                  <span id={`${damageId}-error`} className={`${quote.inputError} ${styles.errorSlot}`} role="alert">
                    {error ?? ""}
                  </span>
                </div>
              </div>
            </section>

            <section className={quote.card} aria-labelledby="contribution-result">
              <h2 id="contribution-result">
                {raid} {difficulty} {gate.gate}관문
              </h2>
              <dl className={styles.range}>
                <div>
                  <dt>하한</dt>
                  <dd>{gate.low != null ? formatEok(gate.low) : "데이터 없음"}</dd>
                </div>
                {gate.reference != null && (
                  <div>
                    <dt>1인분</dt>
                    <dd>{formatEok(gate.reference)}</dd>
                  </div>
                )}
                <div>
                  <dt>상한</dt>
                  <dd>{gate.high != null ? formatEok(gate.high) : "데이터 없음"}</dd>
                </div>
              </dl>
              {/* Height held whether or not a damage is typed (CLS 0). */}
              <div className={styles.bar} aria-hidden="true">
                <span className={styles.track} />
                {/* Fill and marker move by transform from where they are; with no
                    damage the fill is empty and the marker waits at the left end. */}
                <span className={styles.fill} style={{ transform: `scaleX(${(marker ?? 0) / 100})` }} />
                {refAt != null && <span className={styles.ref} style={{ left: `${refAt}%` }} />}
                <span className={styles.rail} style={{ transform: `translateX(${(marker ?? 0) - 100}%)` }}>
                  <span className={styles.marker} data-band={result?.band} data-hidden={marker == null || undefined}>
                    {ring.count > 0 && <span key={ring.count} className={styles.ring} />}
                  </span>
                </span>
              </div>
              {/* The moving number is for the eye; the status line under it reads the final value once. */}
              <p className={styles.verdict} aria-hidden="true">
                {!range ? (
                  "이 관문은 기준값을 확인하고 있어 아직 계산하지 않아요."
                ) : result && shownPct != null ? (
                  <>
                    내 위치 <b className={styles.pct} data-band={result.band}>{pctText(shownPct)}</b> · {BAND_TEXT[result.band]}
                  </>
                ) : (
                  "피해량을 넣으면 위치를 보여 드려요."
                )}
              </p>
              <p className="sr-only" role="status" aria-live="polite">
                {!range
                  ? "이 관문은 기준값을 확인하고 있어 아직 계산하지 않아요."
                  : result
                    ? `내 위치 ${pctText(result.pct)} · ${BAND_TEXT[result.band]}`
                    : "피해량을 넣으면 위치를 보여 드려요."}
              </p>
              <p className={quote.caption}>기준 시점 {gate.basisDate}</p>
              <ul className={styles.notes}>
                <li>하한은 1인분의 0.9배, 상한은 1.2배예요. 내 위치는 하한이 0%, 상한이 100%예요.</li>
                <li>관문마다 위의 기준 시점에 맞춘 값이에요.</li>
                <li>딜러 기준이에요. 서포터는 이 기준을 쓰지 않아요.</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 레이드 기여도 계산</footer>
    </div>
  );
}
