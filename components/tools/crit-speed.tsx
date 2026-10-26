"use client";

import { HubTabs } from "@/components/site/hub-tabs";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Speedometer } from "@/components/ui/icons";
import {
  characterNameError,
  normalizeCharacterName,
} from "@/lib/character/model";
import { CritSpeedQueryError, postCritSpeed } from "@/lib/crit-speed/client";
import {
  AXIS_LABEL,
  CATEGORY_LABEL,
  DEFAULT_SETTINGS,
  MAX_SYNERGY,
  SPEED_BUFFS,
  SUPPORT_PRESETS,
  SYNERGY_CLASSES,
  TARGET_LABEL,
  critSpeedFailureCopy,
  classStateSources,
  groupSources,
  percent,
  toAssumptions,
  type CritSource,
  type CritSpeed,
  type CritToggle,
  groupToggles,
  type Settings,
  type SpeedBuff,
} from "@/lib/crit-speed/model";
import { UNKNOWN_LABEL } from "@/lib/tools/contract";
import { retryLabel } from "@/lib/api/rate-limit";
import { useUrlState, writeUrlParam, type UrlCodec } from "@/lib/tools/url-state";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import quote from "./material-quote.module.css";
import { SiteHeader } from "@/components/site/site-header";
import styles from "./crit-speed.module.css";

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const count = (value: number) => value.toLocaleString("ko-KR");

/** Delays fast-changing settings so typing a number sends one request. */
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className={styles.toggle}>
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function NumberField({
  label,
  value,
  max,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <label className={styles.number}>
      <span>{label}</span>
      <span className={styles.numberInput}>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={0.1}
          placeholder="0"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : 0);
          }}
        />
        <em>%</em>
      </span>
    </label>
  );
}

function Chip({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} hit-44`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  className,
  onReset,
}: {
  settings: Settings;
  setSettings: (update: (prev: Settings) => Settings) => void;
  className: string | null;
  onReset: () => void;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  const synergy = settings.synergy.filter((name) => name !== className);
  return (
    <section className={styles.settings} aria-labelledby="settings-heading">
      <h2 id="settings-heading">가정</h2>
      <p className={styles.settingsHint}>
        캐릭터 정보에 없는 파티·버프 조건이에요. 캐릭터 값과 따로 더해요.
      </p>

      <h3>치명타</h3>
      <Toggle
        label="백어택"
        hint="치명타 적중률 +10%"
        checked={settings.backAttack}
        onChange={(value) => set("backAttack", value)}
      />
      <Toggle
        label="직업 상태 가정"
        hint="공식 문구의 특정 상태(예: 리퍼 혼돈)를 켠 값으로 계산"
        checked={settings.classState}
        onChange={(value) => set("classState", value)}
      />
      <Toggle
        label="치명 펫"
        hint="치명 +160"
        checked={settings.critPet}
        onChange={(value) => set("critPet", value)}
      />
      <p className={styles.groupLabel} id="support-label">
        서포터 약점 노출{" "}
        <small>공식 원문에서 근거를 찾지 못한 사용자 가정 값</small>
      </p>
      <div className={styles.chips} role="group" aria-labelledby="support-label">
        {SUPPORT_PRESETS.map((value) => (
          <Chip
            key={value}
            pressed={settings.supportCritRate === value}
            onClick={() => set("supportCritRate", value)}
          >
            {value ? percent(value) : "없음"}
          </Chip>
        ))}
      </div>
      <p className={styles.groupLabel} id="synergy-label">
        치명타 시너지 <small>동일 직업 제외 · 최대 {MAX_SYNERGY}개 · 1개당 +10%</small>
      </p>
      <div className={styles.chips} role="group" aria-labelledby="synergy-label">
        {SYNERGY_CLASSES.map((name) => {
          const pressed = synergy.includes(name);
          const own = name === className;
          return (
            <Chip
              key={name}
              pressed={pressed}
              disabled={own || (!pressed && synergy.length >= MAX_SYNERGY)}
              onClick={() =>
                set(
                  "synergy",
                  pressed ? synergy.filter((n) => n !== name) : [...synergy, name],
                )
              }
            >
              {name}
              {own && " (본인)"}
            </Chip>
          );
        })}
      </div>
      <div className={styles.numbers}>
        <NumberField
          label="스킬 트라이포드 치적"
          value={settings.tripodCritRate}
          max={100}
          onChange={(value) => set("tripodCritRate", value)}
        />
        <NumberField
          label="기타 치적 (아크 그리드 등)"
          value={settings.extraCritRate}
          max={100}
          onChange={(value) => set("extraCritRate", value)}
        />
      </div>

      <h3>공격·이동 속도</h3>
      <div className={styles.numbers}>
        <NumberField
          label="공격 속도 (각인·트라이포드·팔찌, 감소는 음수)"
          value={settings.attackSpeed}
          max={100}
          min={-100}
          onChange={(value) => set("attackSpeed", value)}
        />
        <NumberField
          label="이동 속도 (각인·트라이포드·팔찌, 감소는 음수)"
          value={settings.moveSpeed}
          max={100}
          min={-100}
          onChange={(value) => set("moveSpeed", value)}
        />
      </div>
      <p className={styles.groupLabel} id="buff-label">
        버프
      </p>
      <div className={styles.chips} role="group" aria-labelledby="buff-label">
        {SPEED_BUFFS.map((buff) => {
          const pressed = settings.buffs.includes(buff.id);
          return (
            <Chip
              key={buff.id}
              pressed={pressed}
              onClick={() =>
                set(
                  "buffs",
                  pressed
                    ? settings.buffs.filter((b) => b !== buff.id)
                    : [...settings.buffs, buff.id],
                )
              }
            >
              {buff.label} +{buff.attack}%
            </Chip>
          );
        })}
      </div>
      <button
        type="button"
        className={`${styles.reset} hit-44`}
        onClick={onReset}
      >
        기본값으로
      </button>
    </section>
  );
}

function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      {/* 모션 목록(치명·속도): scale only (no layout); grows from the start
          once on arrival (.k-grow-x), then eases to new values. */}
      <i className="k-grow-x" style={{ scale: `${ratio} 1` }} />
    </div>
  );
}

function SourceList({
  sources,
  axis,
}: {
  sources: CritSource[];
  axis: CritSource["axis"];
}) {
  const groups = groupSources(sources, axis);
  if (!groups.length) return <p className={quote.caption}>출처가 없어요.</p>;
  return (
    <ul className={styles.sources}>
      {groups.map((group) => (
        <li key={group.category}>
          <div className={styles.sourceHead}>
            <strong>{CATEGORY_LABEL[group.category] ?? UNKNOWN_LABEL}</strong>
            <span>+{percent(group.total)}</span>
          </div>
          <ul>
            {group.items.map((item, i) => (
              <li key={`${item.name}-${i}`}>
                <span className={styles.kind} data-kind={item.kind}>
                  {item.kind === "OBSERVED"
                    ? "캐릭터"
                    : item.kind === "ASSUMED"
                      ? "가정"
                      : UNKNOWN_LABEL}
                </span>
                <span className={styles.sourceName}>
                  {item.name ?? AXIS_LABEL[item.axis] ?? UNKNOWN_LABEL}
                  {item.text && <small>{item.text}</small>}
                </span>
                <b>+{percent(item.value)}</b>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function SwiftnessTable({ speed }: { speed: CritSpeed["speed"] }) {
  if (!speed.swiftnessTable.length) return null;
  return (
    <details className={styles.table}>
      <summary>
        신속 스탯별 공이속{" "}
        <small>
          신속{" "}
          {speed.swiftnessPerPercent.toLocaleString("ko-KR", {
            maximumFractionDigits: 2,
          })}{" "}
          = 공이속 1% · 신속 외 출처는 그대로
        </small>
      </summary>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th scope="col">신속</th>
              <th scope="col">공격 속도</th>
              <th scope="col">이동 속도</th>
              <th scope="col">음속 돌파</th>
            </tr>
          </thead>
          <tbody>
            {speed.swiftnessTable.map((row) => (
              <tr
                key={row.swiftness}
                data-current={row.current || undefined}
                data-optimal={row.optimal || undefined}
              >
                <th scope="row">
                  {count(row.swiftness)}
                  {row.current && <em>현재</em>}
                  {row.optimal && <em>최적</em>}
                </th>
                <td>
                  {percent(row.attackEffective)}
                  {row.attack !== row.attackEffective && (
                    <small> ({percent(row.attack)})</small>
                  )}
                </td>
                <td>
                  {percent(row.moveEffective)}
                  {row.move !== row.moveEffective && (
                    <small> ({percent(row.move)})</small>
                  )}
                </td>
                <td>{percent(row.supersonicEvolutionDamage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        괄호는 상한({percent(speed.cap)})을 넘은 값이에요. 음속 돌파는 진화형 피해예요.
      </p>
    </details>
  );
}

// Outside the live region: re-calculating must not read every switch again.
function EffectToggles({
  toggles,
  changed,
  onChange,
}: {
  toggles: CritToggle[];
  changed: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <div className={styles.effects}>
      <p className={styles.effectsTitle}>조건부 효과</p>
      {groupToggles(toggles).map((t) => (
        <div key={t.key} className={styles.effect}>
          <Toggle
            label={t.label}
            hint={`${t.values
              .map((v) => `${AXIS_LABEL[v.axis] ?? UNKNOWN_LABEL} +${percent(v.value)}`)
              .join(" · ")} · ${t.coreState ? "핵심 상태라 기본 켬" : "상황 조건이라 기본 끔"}`}
            checked={t.on}
            onChange={(value) => onChange(t.key, value)}
          />
          {t.texts.map((text) => (
            <small key={text}>{text}</small>
          ))}
          {changed[t.key] === true && !t.on && (
            <small className={styles.effectBlocked}>
              공식 문구대로 다른 효과와 동시에 적용되지 않아 꺼진 상태로 계산했어요.
            </small>
          )}
        </div>
      ))}
    </div>
  );
}

function Results({
  data,
  stale,
  classState,
}: {
  data: CritSpeed;
  stale: boolean;
  classState: boolean;
}) {
  const { crit, speed } = data;
  const states = classStateSources(data.sources);
  // Missing on backends before #193; then the class-state notes stand alone.
  const toggles = (data.toggles as CritToggle[] | undefined) ?? [];
  // Missing on backends before #133; the validator lets those through.
  const damage = crit.damage as typeof crit.damage | undefined;
  // Axes the screen does not know yet (newer backend): listed, not dropped.
  const unknownAxes = [
    ...new Set(data.sources.map((s) => s.axis).filter((axis) => !(axis in AXIS_LABEL))),
  ];
  const thorn = crit.bluntThorn;
  const sonic = speed.supersonic;
  const over = crit.totalRate - crit.effectiveRate;
  // A stat that could not be read (backend #711; missing before it): its reason
  // stands where the numbers built on it would be — they would lack the stat.
  const critReason = crit.unavailableReason ?? null;
  const speedReason = speed.unavailableReason ?? null;
  return (
    <div className={styles.results} data-stale={stale || undefined}>
      <p className={styles.who}>
        <strong>{data.characterName}</strong>
        {data.className && ` · ${data.className}`}
        {crit.critStat != null && ` · 치명 ${count(crit.critStat)}`}
        {speed.swiftnessStat != null && ` · 신속 ${count(speed.swiftnessStat)}`}
        <small>수집 {kst.format(new Date(data.fetchedAt))}</small>
      </p>

      <section className={styles.block} aria-labelledby="crit-heading">
        <p className={styles.kicker} id="crit-heading">
          치명타 적중률
        </p>
        {critReason ? (
          <p className={styles.unavailable}>{critReason}</p>
        ) : (
          <>
            <p className={styles.figure}>{percent(crit.effectiveRate)}</p>
            <p className={styles.figureNote}>
              {/* The sum written out once (PM-프론트 P2, crit-speed v7): with 뭉툭한 가시 the
                  total can pass a cap, and the reader saw only the parts. */}
              캐릭터 {percent(crit.observedRate)} + 가정 {percent(crit.assumedRate)} = 합계 {percent(crit.totalRate)}
              {over > 0.005 && ` · 상한을 넘은 ${percent(over)}는 적용되지 않아요`}
              {` · 치명 ${crit.critStatPerPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} = 치적 1%`}
            </p>
          </>
        )}
        {critReason || toggles.length > 0 ? null : classState ? (
          states.map((s, i) => (
            <p key={`${s.name}-${i}`} className={styles.figureNote}>
              가정한 직업 상태 · {s.name} +{percent(s.value)}: {s.text}
            </p>
          ))
        ) : (
          <p className={styles.figureNote}>직업 상태 가정 없이 관측한 상태 그대로 계산했어요.</p>
        )}
        {damage && (
          <p className={styles.damage}>
            <span>치명타 피해</span>
            <b>{percent(damage.total)}</b>
            <small>
              기본 {percent(damage.base)} + 캐릭터 {percent(damage.observed)} ·
              스킬 한정 효과는 빼고 계산해요
            </small>
          </p>
        )}
        {!critReason && (
          <>
            <ul className={styles.targets}>
              {crit.targets.map((target) => {
                const copy = TARGET_LABEL[target.key] ?? {
                  title: `치명타 적중률 ${percent(target.targetRate)}`,
                  hint: "",
                };
                return (
                  <li key={target.key} data-reached={target.reached || undefined}>
                    <div>
                      <strong>{copy.title}</strong>
                      <small>
                        목표 {percent(target.targetRate)}
                        {target.requiredCritStat != null &&
                          ` · 치명 ${count(target.requiredCritStat)} 필요`}
                      </small>
                    </div>
                    <b>
                      {target.reached
                        ? "달성"
                        : `치명 +${count(target.requiredAdditionalCritStat)}`}
                    </b>
                  </li>
                );
              })}
            </ul>
            <div className={styles.node}>
              <div className={styles.nodeHead}>
                <strong>뭉툭한 가시</strong>
                <span>
                  {thorn.source === "EQUIPPED_NODE"
                    ? `장착 Lv.${thorn.level ?? "-"}`
                    : "미장착 · Lv.2 기준"}
                </span>
              </div>
              <Meter
                value={thorn.evolutionDamage}
                max={thorn.maxEvolutionDamage}
                label="뭉툭한 가시 진화형 피해"
              />
              <p>
                진화형 피해 {percent(thorn.evolutionDamage)} / 최대{" "}
                {percent(thorn.maxEvolutionDamage)} · 치적 상한{" "}
                {percent(thorn.critCap)}, 넘는 치적의 {percent(thorn.conversionPercent)}
                를 진화형 피해로 전환 · 최적 치적 {percent(thorn.optimalCritRate)}
              </p>
            </div>
          </>
        )}
      </section>

      <section className={styles.block} aria-labelledby="speed-heading">
        <p className={styles.kicker} id="speed-heading">
          공격·이동 속도
        </p>
        {speedReason ? (
          <p className={styles.unavailable}>{speedReason}</p>
        ) : (
          <>
            <div className={styles.speeds}>
              {(["attack", "move"] as const).map((axis) => {
                const value = speed[axis];
                const name = axis === "attack" ? "공격 속도" : "이동 속도";
                return (
                  <div key={axis}>
                    <div className={styles.nodeHead}>
                      <strong>{name}</strong>
                      <span>
                        {percent(value.effective)} / 상한 {percent(speed.cap)}
                      </span>
                    </div>
                    <Meter value={value.effective} max={speed.cap} label={name} />
                    <p>
                      캐릭터 {percent(value.observed)} + 가정 {percent(value.assumed)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className={styles.node}>
              <div className={styles.nodeHead}>
                <strong>음속 돌파</strong>
                <span>
                  {sonic.source === "EQUIPPED_NODE"
                    ? `장착 Lv.${sonic.level ?? "-"}`
                    : "미장착 · Lv.2 기준"}
                </span>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>적정 신속</dt>
                  <dd>
                    {sonic.requiredSwiftness != null
                      ? count(sonic.requiredSwiftness)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>추가 필요</dt>
                  <dd>
                    {sonic.requiredAdditionalSwiftness > 0
                      ? `+${count(sonic.requiredAdditionalSwiftness)}`
                      : "달성"}
                  </dd>
                </div>
                <div>
                  <dt>적정 속도</dt>
                  <dd>{percent(sonic.optimalSpeed)}</dd>
                </div>
              </dl>
              <Meter
                value={sonic.evolutionDamage}
                max={sonic.maxEvolutionDamage}
                label="음속 돌파 진화형 피해"
              />
              <p>
                진화형 피해 {percent(sonic.evolutionDamage)} / 최대{" "}
                {percent(sonic.maxEvolutionDamage)} · 상한 이내 속도의{" "}
                {percent(sonic.conversionPercent)} 전환, 둘 다 상한을 넘으면 +
                {percent(sonic.overCapBonus)}와 초과분의{" "}
                {percent(sonic.overCapConversionPercent)}
              </p>
            </div>
            <SwiftnessTable speed={speed} />
          </>
        )}
      </section>

      <section className={styles.block} aria-labelledby="source-heading">
        <p className={styles.kicker} id="source-heading">
          출처
        </p>
        <h3 className={styles.sourceTitle}>치명타 적중률</h3>
        <SourceList sources={data.sources} axis="CRIT" />
        {damage && (
          <>
            <h3 className={styles.sourceTitle}>치명타 피해</h3>
            {data.sources.some((s) => s.axis === "CRIT_DAMAGE") ? (
              <SourceList sources={data.sources} axis="CRIT_DAMAGE" />
            ) : (
              <p className={quote.caption}>
                장비·팔찌·각인·아크 패시브·카드에 치명타 피해 효과가 없어 기본{" "}
                {percent(damage.base)}예요.
              </p>
            )}
          </>
        )}
        <h3 className={styles.sourceTitle}>공격 속도</h3>
        <SourceList sources={data.sources} axis="ATTACK_SPEED" />
        <h3 className={styles.sourceTitle}>이동 속도</h3>
        <SourceList sources={data.sources} axis="MOVE_SPEED" />
        {unknownAxes.map((axis) => (
          <div key={axis}>
            <h3 className={styles.sourceTitle}>{UNKNOWN_LABEL} 항목</h3>
            <SourceList sources={data.sources} axis={axis} />
          </div>
        ))}
      </section>

      <div className={quote.resultFooter}>
        <span>
          캐릭터 값은 공식 전투정보실 원문에서 읽은 값이고, 가정은 위에서 고른
          조건이에요. 규칙 {data.ruleVersion}
        </span>
        {data.limitations.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </div>
    </div>
  );
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * The assumptions as one JSON value in the address (#889): each known key is
 * taken only with the right type, the rest falls back to the default.
 */
const settingsCodec: UrlCodec<Settings> = {
  parse: (raw) => {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const out: Settings = { ...DEFAULT_SETTINGS, toggles: {} };
    for (const key of ["backAttack", "critPet", "classState"] as const) if (typeof v[key] === "boolean") out[key] = v[key];
    for (const key of ["supportCritRate", "tripodCritRate", "extraCritRate", "attackSpeed", "moveSpeed"] as const) {
      const n = v[key];
      if (typeof n === "number" && Number.isFinite(n)) out[key] = n;
    }
    if (isStrings(v.synergy)) out.synergy = v.synergy;
    if (isStrings(v.buffs)) out.buffs = v.buffs.filter((b): b is SpeedBuff => SPEED_BUFFS.some((x) => x.id === b));
    if (v.toggles && typeof v.toggles === "object")
      for (const [k, on] of Object.entries(v.toggles as Record<string, unknown>)) if (typeof on === "boolean") out.toggles[k] = on;
    return out;
  },
  format: (value) => JSON.stringify(value),
};

function CritSpeedContent({ initialName }: { initialName: string }) {
  const [input, setInput] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState(
    initialName && !characterNameError(initialName)
      ? normalizeCharacterName(initialName)
      : "",
  );
  // The assumptions live in the address: back and reload keep them (#889).
  const [settings, setSettings] = useUrlState<Settings>("assume", DEFAULT_SETTINGS, settingsCodec);
  // Number fields keep their own text, so a reset remounts the panel.
  const [resetKey, setResetKey] = useState(0);
  const debounced = useDebounced(settings);
  const query = useQuery({
    queryKey: ["crit-speed", name, debounced],
    queryFn: ({ signal }) =>
      postCritSpeed(
        { characterName: name, assumptions: toAssumptions(debounced) },
        signal,
      ),
    enabled: !!name,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const data = query.data?.data ?? null;
  // Missing on backends before #193.
  const effects = (data?.toggles as CritToggle[] | undefined) ?? [];
  // Synergy uses the loaded class; the request re-filters it the same way.
  const className = data?.characterName === name ? data.className : null;
  const error = characterNameError(input);
  const failure =
    query.error instanceof CritSpeedQueryError
      ? query.error.info
      : query.error
        ? { code: "LOST_ARK_API_ERROR", status: 502 }
        : null;
  // Busy buttons stay focusable (aria-disabled, not disabled) so a keyboard
  // user keeps their place while the request runs; the handlers guard.
  const busy = query.isFetching && !data;
  // 429: same notice as every screen; the seconds left sit on the buttons
  // (outside the alert) and they stay blocked until then.
  const limit = useRateLimit(query.error);
  const waiting = limit.seconds > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || waiting) return;
    setTouched(true);
    if (error) return;
    const target = normalizeCharacterName(input);
    // Keeps the assumptions' key in the address (a whole new query dropped them).
    writeUrlParam("character", target);
    // Effect keys belong to one character's class and nodes.
    if (target !== name) setSettings((prev) => ({ ...prev, toggles: {} }));
    setName(target);
  }

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#crit-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="crit-main">
        <section className={quote.hero} aria-labelledby="crit-page-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Speedometer size={18} />
          </span>
          <p className={quote.heroKicker}>전투 계산</p>
          <h1 id="crit-page-heading">치적·뭉가·음돌</h1>
          <p className={quote.heroCopy}>내 캐릭터 기준으로, 가정은 따로.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 캐릭터 검색으로
          </Link>
          <HubTabs hub="growth" />
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <form className={styles.search} onSubmit={submit} noValidate>
              <label className={quote.field} data-grow="">
                <span>캐릭터 이름</span>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="계산할 캐릭터"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-invalid={touched && !!error}
                />
              </label>
              <button
                type="submit"
                className={quote.secondaryPill}
                aria-disabled={busy || waiting || undefined}
                aria-busy={busy || undefined}
              >
                {retryLabel(limit.seconds, "계산하기")}
              </button>
              {touched && error && (
                <p className={quote.inputError}>{error}</p>
              )}
            </form>

            <div className={styles.columns}>
              <SettingsPanel
                key={resetKey}
                onReset={() => {
                  setSettings(DEFAULT_SETTINGS);
                  setResetKey((k) => k + 1);
                }}
                settings={settings}
                setSettings={setSettings}
                className={className}
              />
              <div className={styles.output}>
                {!failure && data && effects.length > 0 && (
                  <EffectToggles
                    toggles={effects}
                    changed={settings.toggles}
                    onChange={(key, value) =>
                      setSettings((prev) => ({
                        ...prev,
                        toggles: { ...prev.toggles, [key]: value },
                      }))
                    }
                  />
                )}
                <div className={styles.live} aria-live="polite">
                  {failure ? (
                    <div className={quote.notice}>
                      {/* The alert holds the sentence only; the retry button's countdown
                          ticks outside it so it is not re-announced every second. */}
                      <div role="alert">
                        <strong>{critSpeedFailureCopy(failure).title}</strong>
                        <p>{critSpeedFailureCopy(failure).text}</p>
                      </div>
                      <button
                        type="button"
                        className={quote.outlinePill}
                        aria-disabled={query.isFetching || waiting || undefined}
                        aria-busy={query.isFetching || undefined}
                        // The output is a live region: a fixed name while waiting and
                        // hidden seconds keep the countdown from being read out.
                        aria-label={waiting ? "다시 계산, 잠시 뒤 가능" : undefined}
                        onClick={() => !query.isFetching && !waiting && query.refetch()}
                      >
                        {waiting && <span aria-hidden="true">{limit.seconds}초 뒤 </span>}
                        다시 계산
                      </button>
                    </div>
                  ) : data ? (
                    <>
                      {query.isFetching && (
                        <p className={styles.updating} role="status">
                          다시 계산하고 있어요
                        </p>
                      )}
                      <Results
                        data={data}
                        stale={query.isPlaceholderData}
                        classState={settings.classState}
                      />
                    </>
                  ) : name ? (
                    <p className={styles.empty} data-loading="" role="status">
                      캐릭터 정보를 읽고 있어요…
                    </p>
                  ) : (
                    <p className={styles.empty}>
                      캐릭터를 검색하면 치명타 적중률과 공이속, 뭉툭한 가시·음속
                      돌파 목표를 계산해요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 공식 전투정보실 원문 기반 계산
      </footer>
    </div>
  );
}

export function CritSpeedTool({ initialName }: { initialName: string }) {
  return (
    <CritSpeedContent initialName={initialName} />
  );
}
