"use client";
// 기여도 계산기 (checklist L41): pick a gate, type the damage you dealt, see
// where it sits between that gate's lower and upper bounds. All numbers are
// the verified sample's (lib/tools/contribution.ts); each gate shows its
// basis date and no source (사용자 결정 10-12).
import { useId, useState } from "react";
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
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="예: 1,800"
                    maxLength={12}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${damageId}-error` : undefined}
                  />
                  {error && (
                    <span id={`${damageId}-error`} className={quote.inputError}>
                      {error}
                    </span>
                  )}
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
                {refAt != null && <span className={styles.ref} style={{ left: `${refAt}%` }} />}
                {marker != null && <span className={styles.marker} style={{ left: `${marker}%` }} data-band={result?.band} />}
              </div>
              <p className={styles.verdict} role="status" aria-live="polite">
                {!range ? (
                  "이 관문은 기준값을 확인하고 있어 아직 계산하지 않아요."
                ) : result ? (
                  <>
                    내 위치 <b data-band={result.band}>{result.pct.toLocaleString("ko-KR")}%</b> · {BAND_TEXT[result.band]}
                  </>
                ) : (
                  "피해량을 넣으면 위치를 보여 드려요."
                )}
              </p>
              <p className={quote.caption}>기준 시점 {gate.basisDate}</p>
              <ul className={styles.notes}>
                <li>하한은 1인분의 0.9배, 상한은 1.2배예요. 내 위치는 하한이 0%, 상한이 100%예요.</li>
                <li>보스 체력과 기준값은 공식 자료가 없어, 관문마다 최근 기준으로 맞춘 값이에요.</li>
                <li>공대 구성·택틱에 따라 실제 피해량은 달라질 수 있어 서포터는 이 기준을 쓰지 않아요.</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>LOAKraken · 레이드 기여도 계산</footer>
    </div>
  );
}
