"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlashCircle, RotateLeft, UndoArrow } from "@/components/ui/icons";
import { Select as ChoiceSelect } from "@/components/ui/select";
import {
  characterNameError,
  normalizeCharacterName,
  type Character,
} from "@/lib/character/model";
import { CharacterQueryError, fetchCharacter } from "@/lib/character/client";
import {
  CombatPowerQueryError,
  fetchOptions,
  postSimulation,
} from "@/lib/combat-power/client";
import {
  ARK_PASSIVE_MAX,
  ARM_GUARD_GRADES,
  ARM_GUARD_MAX,
  ROLE_REASONS,
  GEAR_TYPES,
  GRADES,
  GRADE_LABEL,
  KIND_LABEL,
  braceletName,
  gradeWithValue,
  isOpen,
  polishValue,
  type Grade,
  NO_EDITS,
  combatPowerFailureCopy,
  gemLevel,
  hasComputed,
  toChanges,
  type Current,
  type Edits,
  type Options,
  type PolishValues,
  type Simulation,
} from "@/lib/combat-power/model";
import {
  historyReducer,
  isEmpty,
  applySaved,
  parseSaved,
  savedKey,
  serializeSaved,
  startHistory,
} from "@/lib/combat-power/history";
import { editsFor, type SpecUpChange } from "@/lib/spec-up/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { SiteHeader } from "@/components/site/site-header";
import quote from "./material-quote.module.css";
import styles from "./combat-power.module.css";

const power = (value: number) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : "±"}${power(Math.abs(value))}`;

/** Delays edits so dragging through levels sends one request (PM-프론트 18:49). */
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Backend echoes polish/bracelet grades as LOW·MID·HIGH; show 하·중·상. */
const gradeText = (text: string | null | undefined) =>
  text?.replace(/\b(LOW|MID|HIGH)\b/g, (grade) => GRADE_LABEL[grade] ?? grade);

/** Gem level 0 removes the gem (backend #250). */
const gemOption = (level: number) => (level === 0 ? "빼기" : String(level));

/** How a change's from/to reads: gem 0 is "빼기", grade codes are 하·중·상. */
const changeText = (kind: string, text: string | null | undefined) =>
  (kind === "GEM_LEVEL" || kind === "GEM_LEVEL_ALL") && text === "0" ? "빼기" : gradeText(text);

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** The parts of the character the first cut can change. */
function currentOf(data: Character) {
  const gems = (data.loadout.gems?.items ?? []).flatMap((gem) =>
    gem.slot != null && gem.level != null
      ? [{ slot: gem.slot, level: gem.level, name: gem.name ?? `보석 ${gem.slot + 1}` }]
      : [],
  );
  const gear = data.loadout.equipment.flatMap((item, index) =>
    (GEAR_TYPES as readonly string[]).includes(item.type ?? "") &&
    (item.detail?.refineLevel != null || item.detail?.quality != null)
      ? [
          {
            index,
            type: item.type ?? "",
            name: item.name ?? item.type ?? "",
            refine: item.detail?.refineLevel ?? null,
            quality: item.detail?.quality ?? null,
            advanced: item.detail?.advancedRefineLevel ?? null,
          },
        ]
      : [],
  );
  const isGrade = (value: string | null | undefined): value is Grade =>
    (GRADES as readonly string[]).includes(value ?? "");
  const polish = data.loadout.equipment.flatMap((item, index) =>
    (item.detail?.polishEffects ?? []).map((effect, line) => ({
      index,
      line,
      item: item.name ?? item.type ?? "",
      option: effect.name,
      value: effect.value,
      grade: isGrade(effect.grade) ? effect.grade : null,
    })),
  );
  const braceletItem = data.loadout.equipment.find((item) => item.type === "팔찌");
  // Range-type lines (combat stats) have no grade and are not changeable yet.
  const bracelet = (braceletItem?.detail?.braceletEffects ?? []).flatMap((effect, line) =>
    isGrade(effect.grade)
      ? [{ line, text: effect.text, name: braceletName(effect.text), grade: effect.grade }]
      : [],
  );
  const engravings = (data.loadout.engravings?.arkPassiveEffects ?? []).flatMap((item) =>
    item.name && item.level != null ? [{ name: item.name, level: item.level }] : [],
  );
  const stones = data.loadout.equipment.flatMap((item) => item.detail?.stoneEngravings ?? []);
  const arkPassive = (data.loadout.arkPassive?.points ?? []).flatMap((item) =>
    item.name && item.value != null ? [{ tree: item.name, points: item.value }] : [],
  );
  const cores = (data.loadout.arkGrid?.slots ?? []).flatMap((slot) =>
    slot.index != null && slot.grade && slot.point != null
      ? [{ slotIndex: slot.index, name: slot.name ?? `코어 ${slot.index + 1}`, grade: slot.grade, point: slot.point }]
      : [],
  );
  const guardItem = data.loadout.equipment.find((item) => item.type === "완갑");
  const armGuard =
    guardItem && guardItem.detail?.refineLevel != null && guardItem.grade
      ? { level: guardItem.detail.refineLevel, grade: guardItem.grade, name: guardItem.name ?? "팔 보호구" }
      : null;
  return { gems, gear, polish, bracelet, engravings, stones, arkPassive, cores, armGuard };
}

function Choice({
  label,
  caption,
  value,
  original,
  values,
  onChange,
}: {
  label: string;
  caption?: string;
  value: string;
  original: string | null;
  values: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.select} data-changed={(original != null && value !== original) || undefined}>
      {caption && <span className={styles.caption} aria-hidden="true">{caption}</span>}
      <span className={styles.sr}>{label}</span>
      <ChoiceSelect
        value={value}
        onValueChange={onChange}
        items={[...(original == null ? [{ value: "", label: "—" }] : []), ...values]}
      />
    </label>
  );
}

function Card({
  id,
  title,
  locked,
  children,
}: {
  id: string;
  title: string;
  /** 1차판 밖: current values only, with the reason once under the title. */
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <header className={styles.cardHead}>
        <h2 id={id}>{title}</h2>
        {locked && <span className={styles.lockedBadge}>준비 중</span>}
      </header>
      {locked && <p className={styles.none}>{LOCKED_NOTE}</p>}
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

const LOCKED_NOTE = "계산식을 확인하고 있어 아직 바꿀 수 없어요. 확인되는 대로 열어요.";

/** A control the 1차판 keeps closed: the current value and "준비 중". */
function Locked({ caption, value }: { caption: string; value: ReactNode }) {
  return (
    <span className={styles.locked} title={LOCKED_NOTE}>
      {caption} {value} · 준비 중
    </span>
  );
}

function Select({
  label,
  caption,
  value,
  original,
  values,
  format = String,
  onChange,
}: {
  label: string;
  /** Short visible name when the row does not say what the number is. */
  caption?: string;
  value: number;
  original: number;
  values: number[];
  /** Option text; the number itself by default. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.select} data-changed={value !== original || undefined}>
      {caption && <span className={styles.caption} aria-hidden="true">{caption}</span>}
      <span className={styles.sr}>{label}</span>
      <ChoiceSelect
        value={value}
        onValueChange={onChange}
        items={values.map((level) => ({ value: level, label: format(level) }))}
      />
    </label>
  );
}

function Editors({
  options,
  current,
  edits,
  setEdits,
}: {
  options: Options;
  current: ReturnType<typeof currentOf>;
  edits: Edits;
  setEdits: (update: (prev: Edits) => Edits) => void;
}) {
  const gemValues = options.gemLevels;
  const refineValues = range(options.refineMin, options.refineMax);
  const qualityValues = range(0, options.qualityMax);
  const braceletFamilies = (options.braceletOptions ?? []).map((option) => ({ value: option.name, label: option.name }));
  const gradeValues = options.polishGrades.map((grade) => ({
    value: grade,
    label: GRADE_LABEL[grade] ?? grade,
  }));
  return (
    <div className={styles.editors}>
      <section className={styles.card} aria-labelledby="cp-gems">
        <header className={styles.cardHead}>
          <h2 id="cp-gems">보석</h2>
          {current.gems.length > 0 && (
            <label className={styles.bulk}>
              <span>모두</span>
              <ChoiceSelect
                value={edits.gemAll == null ? "" : String(edits.gemAll)}
                onValueChange={(v) =>
                  setEdits((prev) => ({
                    ...prev,
                    gemAll: v ? Number(v) : null,
                    gems: {},
                  }))
                }
                aria-label="보석 모두 같은 레벨로"
                items={[
                  { value: "", label: "그대로" },
                  ...gemValues.map((level) => ({ value: String(level), label: level === 0 ? "모두 빼기" : `${level}레벨` })),
                ]}
              />
            </label>
          )}
        </header>
        {current.gems.length === 0 ? (
          <p className={styles.none}>장착한 보석이 없어요.</p>
        ) : (
          <ul className={styles.rows}>
            {current.gems.map((gem) => (
              <li key={gem.slot}>
                <span className={styles.rowName}>{gem.name}</span>
                <span className={styles.rowFrom}>Lv.{gem.level}</span>
                <Select
                  label={`${gem.name} 레벨`}
                  value={gemLevel(edits, gem)}
                  original={gem.level}
                  values={gemValues}
                  format={gemOption}
                  onChange={(level) =>
                    setEdits((prev) => ({ ...prev, gems: { ...prev.gems, [gem.slot]: level } }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="cp-gear">
        <header className={styles.cardHead}>
          <h2 id="cp-gear">장비 재련·품질</h2>
        </header>
        {/* 계산 검증 10-12 00:46: armour quality only raises 생명 활성력. */}
        {current.gear.some((item) => item.type !== "무기" && item.quality != null) && (
          <p className={styles.none}>
            방어구 품질은 생명 활성력(체력)만 올려 딜러 전투력은 그대로예요. 전투력에는 무기 품질이 들어가요.
          </p>
        )}
        {current.gear.length === 0 ? (
          <p className={styles.none}>재련 단계나 품질을 읽은 장비가 없어요.</p>
        ) : (
          <ul className={styles.rows}>
            {current.gear.map((item) => (
              <li key={item.index}>
                <span className={styles.rowName}>{item.name}</span>
                {item.refine != null && !isOpen("EQUIPMENT_REFINE") ? (
                  <Locked caption="재련" value={`+${item.refine}`} />
                ) : item.refine != null ? (
                  <Select
                    label={`${item.type} 재련 단계`}
                    caption="재련"
                    value={edits.refine[item.index] ?? item.refine}
                    original={item.refine}
                    values={refineValues}
                    onChange={(refine) =>
                      setEdits((prev) => ({ ...prev, refine: { ...prev.refine, [item.index]: refine } }))
                    }
                  />
                ) : (
                  <span className={styles.rowFrom}>재련 —</span>
                )}
                {item.advanced != null && !isOpen("EQUIPMENT_ADVANCED_REFINE") && (
                  <Locked caption="상급" value={item.advanced} />
                )}
                {item.advanced != null && isOpen("EQUIPMENT_ADVANCED_REFINE") && (
                  <Select
                    label={`${item.type} 상급 재련 단계`}
                    caption="상급"
                    value={edits.advanced[item.index] ?? item.advanced}
                    original={item.advanced}
                    values={range(0, options.advancedRefineMax)}
                    onChange={(level) =>
                      setEdits((prev) => ({ ...prev, advanced: { ...prev.advanced, [item.index]: level } }))
                    }
                  />
                )}
                {item.quality != null ? (
                  <Select
                    label={`${item.type} 품질`}
                    caption="품질"
                    value={edits.quality[item.index] ?? item.quality}
                    original={item.quality}
                    values={qualityValues}
                    onChange={(quality) =>
                      setEdits((prev) => ({ ...prev, quality: { ...prev.quality, [item.index]: quality } }))
                    }
                  />
                ) : (
                  <span className={styles.rowFrom}>품질 —</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {current.armGuard && (
        <Card id="cp-arm-guard" title="팔 보호구" locked={!isOpen("ARM_GUARD")}>
          <li>
            <span className={styles.rowName}>{current.armGuard.name}</span>
            {!isOpen("ARM_GUARD") ? (
              <Locked caption="단계" value={`+${current.armGuard.level} · ${current.armGuard.grade}`} />
            ) : (
              <>
                <Select
                  label="팔 보호구 단계"
                  caption="단계"
                  value={edits.armGuard.level ?? current.armGuard.level}
                  original={current.armGuard.level}
                  values={range(0, ARM_GUARD_MAX)}
                  onChange={(level) => setEdits((prev) => ({ ...prev, armGuard: { ...prev.armGuard, level } }))}
                />
                <Choice
                  label="팔 보호구 등급"
                  caption="등급"
                  value={edits.armGuard.grade ?? current.armGuard.grade}
                  original={current.armGuard.grade}
                  values={ARM_GUARD_GRADES.map((grade) => ({ value: grade, label: grade }))}
                  onChange={(grade) => setEdits((prev) => ({ ...prev, armGuard: { ...prev.armGuard, grade } }))}
                />
              </>
            )}
          </li>
        </Card>
      )}

      {current.polish.length > 0 && (
        <Card id="cp-polish" title="연마" locked={!isOpen("POLISH")}>
          {current.polish.map((line) => {
            const key = `${line.index}:${line.line}`;
            return (
              <li key={key}>
                <span className={styles.rowName}>
                  {line.option}
                  <small className={styles.rowSub}>
                    {line.item} · {line.value}
                  </small>
                </span>
                {!isOpen("POLISH") ? (
                  <Locked caption="등급" value={line.grade ? gradeWithValue(line.grade, line.value) : "—"} />
                ) : (
                  <Choice
                    label={`${line.item} ${line.option} 등급`}
                    value={edits.polish[key] ?? line.grade ?? ""}
                    original={line.grade}
                    values={options.polishGrades.map((grade) => ({
                      value: grade,
                      label: gradeWithValue(
                        grade,
                        polishValue(options.polishValues, line.option, { value: line.value, grade: line.grade }, grade),
                      ),
                    }))}
                    onChange={(grade) =>
                      setEdits((prev) => ({ ...prev, polish: { ...prev.polish, [key]: grade as Grade } }))
                    }
                  />
                )}
              </li>
            );
          })}
        </Card>
      )}

      {current.bracelet.length > 0 && (
        <Card id="cp-bracelet" title="팔찌" locked={!isOpen("BRACELET_EFFECT")}>
          {current.bracelet.map((line) => (
            <li key={line.line}>
              <span className={styles.rowName}>{line.text}</span>
              {!isOpen("BRACELET_EFFECT") ? (
                <Locked caption="등급" value={line.grade ? (GRADE_LABEL[line.grade] ?? line.grade) : "—"} />
              ) : (
                <>
                  {/* The family comes from the backend's list (#332); a line
                      whose text is not a listed family keeps its own name. */}
                  <Choice
                    label={`팔찌 ${line.line + 1}번째 효과 계열`}
                    caption="계열"
                    value={edits.braceletName[line.line] ?? line.name}
                    original={line.name}
                    values={[
                      ...(braceletFamilies.some((f) => f.value === line.name) ? [] : [{ value: line.name, label: line.name }]),
                      ...braceletFamilies,
                      { value: "없음", label: "빼기" },
                    ]}
                    onChange={(name) =>
                      setEdits((prev) => ({ ...prev, braceletName: { ...prev.braceletName, [line.line]: name } }))
                    }
                  />
                  <Choice
                    label={`팔찌 ${line.name} 등급`}
                    caption="등급"
                    value={edits.bracelet[line.line] ?? line.grade ?? ""}
                    original={line.grade}
                    values={gradeValues}
                    onChange={(grade) =>
                      setEdits((prev) => ({ ...prev, bracelet: { ...prev.bracelet, [line.line]: grade as Grade } }))
                    }
                  />
                </>
              )}
            </li>
          ))}
        </Card>
      )}

      {(current.engravings.length > 0 || current.stones.length > 0) && (
        <Card id="cp-engravings" title="각인·스톤">
          {current.engravings.map((item) => (
            <li key={`e-${item.name}`}>
              <span className={styles.rowName}>{item.name}</span>
              <span className={styles.rowFrom}>Lv.{item.level}</span>
              <Select
                label={`${item.name} 각인 레벨`}
                value={edits.engraving[item.name] ?? item.level}
                original={item.level}
                values={options.engravingLevels}
                onChange={(level) =>
                  setEdits((prev) => ({ ...prev, engraving: { ...prev.engraving, [item.name]: level } }))
                }
              />
            </li>
          ))}
          {current.stones.map((item) => (
            <li key={`s-${item.name}`}>
              <span className={styles.rowName}>
                {item.name}
                <small className={styles.rowSub}>어빌리티 스톤</small>
              </span>
              <span className={styles.rowFrom}>Lv.{item.level}</span>
              <Select
                label={`스톤 ${item.name} 레벨`}
                value={edits.stone[item.name] ?? item.level}
                original={item.level}
                values={options.stoneLevels}
                onChange={(level) =>
                  setEdits((prev) => ({ ...prev, stone: { ...prev.stone, [item.name]: level } }))
                }
              />
            </li>
          ))}
        </Card>
      )}

      {current.arkPassive.length > 0 && (
        <Card id="cp-ark-passive" title="아크 패시브" locked={!isOpen("ARK_PASSIVE_POINT")}>
          {current.arkPassive.map((item) => (
            <li key={item.tree}>
              <span className={styles.rowName}>{item.tree}</span>
              <span className={styles.rowFrom}>{item.points}P</span>
              {isOpen("ARK_PASSIVE_POINT") && (
                <PointField
                  label={`아크 패시브 ${item.tree} 포인트`}
                  value={edits.arkPassive[item.tree] ?? item.points}
                  original={item.points}
                  max={ARK_PASSIVE_MAX}
                  onChange={(points) =>
                    setEdits((prev) => ({ ...prev, arkPassive: { ...prev.arkPassive, [item.tree]: points } }))
                  }
                />
              )}
            </li>
          ))}
        </Card>
      )}

      {current.cores.length > 0 && (
        <Card id="cp-cores" title="아크 그리드 코어" locked={!isOpen("ARK_GRID_CORE")}>
          {current.cores.map((item) => {
            const edit = edits.core[item.slotIndex] ?? { grade: item.grade, point: item.point };
            const set = (next: Partial<typeof edit>) =>
              setEdits((prev) => ({ ...prev, core: { ...prev.core, [item.slotIndex]: { ...edit, ...next } } }));
            return (
              <li key={item.slotIndex}>
                <span className={styles.rowName}>{item.name}</span>
                {!isOpen("ARK_GRID_CORE") ? (
                  <Locked caption={item.grade} value={`${item.point}P`} />
                ) : (
                  <>
                    <Choice
                      label={`${item.name} 등급`}
                      caption="등급"
                      value={edit.grade}
                      original={item.grade}
                      values={options.coreGrades.map((grade) => ({ value: grade, label: grade }))}
                      onChange={(grade) => set({ grade })}
                    />
                    <Select
                      label={`${item.name} 포인트`}
                      caption="포인트"
                      value={edit.point}
                      original={item.point}
                      values={range(0, options.corePointMax)}
                      onChange={(point) => set({ point })}
                    />
                  </>
                )}
              </li>
            );
          })}
        </Card>
      )}
      <p className={styles.later}>
        지금은 보석·품질·각인·스톤을 바꿀 수 있어요. 재련·연마·팔찌·팔 보호구·아크 패시브·아크 그리드는 계산식을
        확인하는 대로 열어요.
      </p>
    </div>
  );
}

/** Ark passive points: typed, applied only when a whole number in range. */
function PointField({
  label,
  value,
  original,
  max,
  onChange,
}: {
  label: string;
  value: number;
  original: number;
  max: number;
  onChange: (value: number) => void;
}) {
  // Typed text while focused; otherwise the applied value (so a reset shows).
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={styles.select} data-changed={value !== original || undefined}>
      <span className={styles.sr}>{label}</span>
      <input
        className={styles.number}
        inputMode="numeric"
        value={draft ?? String(value)}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
          setDraft(next);
          const number = Number(next);
          if (next !== "" && number <= max) onChange(number);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

function ResultBand({
  base,
  itemLevel,
  data,
  changed,
  stale,
}: {
  base: number | null;
  itemLevel: number | null;
  data: Simulation | null;
  changed: number;
  stale: boolean;
}) {
  const computed = data && hasComputed(data);
  const before = data?.before ?? base;
  return (
    <section className={styles.band} aria-labelledby="cp-result" data-stale={stale || undefined}>
      <p id="cp-result" className={styles.bandLabel}>
        {changed > 0 ? "예상 전투력" : "전투력"}
      </p>
      <p className={styles.bandValue}>
        {before == null ? "—" : power(computed && data.after != null ? data.after : before)}
        {computed && data.delta != null && (
          <span className={data.delta >= 0 ? styles.gain : styles.loss}>
            <span aria-hidden="true">{data.delta > 0 ? "▲ " : data.delta < 0 ? "▼ " : ""}</span>
            {signed(data.delta)}
            {data.deltaPercent != null &&
              ` (${data.deltaPercent < 0 ? "−" : "+"}${Math.abs(data.deltaPercent).toFixed(3)}%)`}
          </span>
        )}
      </p>
      <p className={styles.bandNote}>
        {changed === 0
          ? "아래에서 값을 바꾸면 바로 다시 계산해요."
          : computed && data.delta === 0 && !data.partial
            ? "바꾼 항목은 전투력에 영향이 없어요. 이유는 아래 '바꾼 것'에 있어요."
            : computed
            ? `바꾼 ${changed}개 중 계산된 항목만 반영했어요${data.partial ? ` · 계산 준비 중 ${data.unsupportedCount}개` : ""}.`
            : `바꾼 ${changed}개 항목은 계산식을 확인하고 있어 아직 반영하지 않았어요.`}
      </p>
      {/* Item level moves only with refining, which is still 준비 중: the
          current value, no made-up change (PM-프론트 16:37 ②). */}
      {itemLevel != null && (
        <p className={styles.bandSub}>
          아이템 레벨 <b>{itemLevel.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</b>
        </p>
      )}
    </section>
  );
}

/** POLISH from/to read "옵션 +1.60%" → "옵션 HIGH": show the grade with its value. */
function polishText(text: string | null, from: string | null, values: PolishValues | undefined) {
  const match = text?.match(/^(.*) (LOW|MID|HIGH)$/);
  if (!match) return gradeText(text);
  const [, option, grade] = match;
  // from is "옵션 +1.60%": the accessory's current value decides if the table fits.
  const current = from?.startsWith(`${option} `) ? from.slice(option.length + 1) : null;
  const value = current ? polishValue(values, option, { value: current, grade: null }, grade) : null;
  return `${option} ${gradeWithValue(grade, value)}`;
}

function ChangeList({ data, values }: { data: Simulation; values?: PolishValues }) {
  if (data.contributions.length === 0) return null;
  // Rows held back by the role are said once, above the result.
  const role = (item: Simulation["contributions"][number]) => !!item.reasonCode && ROLE_REASONS.has(item.reasonCode);
  return (
    <section className={styles.changes} aria-labelledby="cp-changes">
      <h2 id="cp-changes">바꾼 것</h2>
      <ul>
        {data.contributions.map((item, i) => (
          <li key={`${item.kind}-${item.target}-${i}`}>
            <span className={styles.kind}>{KIND_LABEL[item.kind] ?? item.kind}</span>
            <span className={styles.target}>
              {item.target}
              {(item.from != null || item.to != null) && (
                <small>
                  {changeText(item.kind, item.from) ?? "—"} →{" "}
                  {(item.kind === "POLISH" ? polishText(item.to, item.from, values) : changeText(item.kind, item.to)) ?? "—"}
                </small>
              )}
            </span>
            {item.status === "OK" && item.delta != null ? (
              <b className={item.delta >= 0 ? styles.gain : styles.loss}>{signed(item.delta)}</b>
            ) : (
              <span className={styles.pending}>계산 준비 중</span>
            )}
            {/* 사용자 지적 10-12 (L23): a change that moved nothing, or was
                not computed, says why right under it — the backend's
                sentence as it is. A bare ±0.00 read as broken. */}
            {(item.status !== "OK" || item.delta === 0) && item.basis && !role(item) && (
              <small className={styles.why}>{item.basis}</small>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The simulator itself — result, changes and editors for one character. The
 * tool page puts its own search above it; the character page shows it as the
 * 시뮬레이터 tab (PM-프론트 16:37 ①), where the character is already loaded.
 */
export function CombatPowerSimulator({
  name,
  initial,
  start,
  head,
}: {
  name: string;
  initial?: Character;
  /** One change to begin with (스펙업 "적용해 보기"), as a step 이전 can undo. */
  start?: SpecUpChange | null;
  /** Shown at the top of the sticky column (the character tab's lead line). */
  head?: ReactNode;
}) {
  const embedded = !!initial;
  // 이전·다음·초기화 (PM-프론트 16:37 ②): every edit is a step.
  const [history, dispatch] = useReducer(historyReducer, undefined, () => {
    const empty = startHistory();
    const first = editsFor(start, NO_EDITS);
    return first ? historyReducer(empty, { type: "load", edits: first }) : empty;
  });
  const edits = history.present;
  const setEdits = useCallback(
    (update: (prev: Edits) => Edits) => dispatch({ type: "set", next: update }),
    [],
  );
  const saved = useSavedEdits(name);
  const [notice, setNotice] = useState("");

  const character = useQuery({
    queryKey: ["character", name],
    queryFn: ({ signal }) => fetchCharacter(name, signal),
    // On the character page the page owns this query (and its refresh
    // cooldown); the tab only reads it.
    enabled: !!name && !embedded,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const options = useQuery({
    queryKey: ["combat-power-options"],
    queryFn: ({ signal }) => fetchOptions(signal),
    staleTime: Infinity,
    retry: false,
  });
  const data = character.data?.data ?? initial ?? null;
  const current = useMemo(() => (data ? currentOf(data) : null), [data]);
  const changes = useMemo(
    () => (current ? toChanges(edits, current as Current) : []),
    [edits, current],
  );
  const debounced = useDebounced(changes);
  // Same changes → same key → no new request (PM-프론트 18:49).
  const simulation = useQuery({
    queryKey: ["combat-power", name, data?.fetchedAt, debounced],
    queryFn: ({ signal }) => postSimulation({ characterName: name, changes: debounced }, signal),
    enabled: !!data && debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const result = changes.length > 0 ? (simulation.data?.data ?? null) : null;
  // 서포터·판정 불가(backend #332): every change comes back with this reason.
  const roleReason =
    result?.contributions.find((item) => item.reasonCode && ROLE_REASONS.has(item.reasonCode))?.basis ?? null;
  // The backend read a newer cache than the screen: reload the character first.
  const outdated = !!result && !!data && result.fetchedAt !== data.fetchedAt;

  const failure =
    character.error instanceof CharacterQueryError
      ? character.error.info
      : simulation.error instanceof CombatPowerQueryError
        ? simulation.error.info
        : options.error instanceof CombatPowerQueryError
          ? options.error.info
          : character.error || simulation.error || options.error
            ? { code: "LOST_ARK_API_ERROR", status: 502 }
            : null;
  const limit = useRateLimit(character.error ?? simulation.error);
  const waiting = limit.seconds > 0;

  function reload() {
    dispatch({ type: "reset" });
    void character.refetch();
  }

  function save() {
    const at = new Date();
    try {
      if (!current) return;
      localStorage.setItem(savedKey(name), serializeSaved(edits, at, current));
      window.dispatchEvent(new Event(SAVED_EVENT));
      setNotice(`입력을 저장했어요(${savedTime(at.toISOString())}).`);
    } catch {
      setNotice("이 브라우저에서는 저장할 수 없어요.");
    }
  }

  function load() {
    if (!saved || !current) return;
    // Only what still points at the same gear (PM 총괄 10-12 01:54).
    const applied = applySaved(saved, current);
    if ("legacy" in applied) {
      setNotice("예전 방식으로 저장한 입력이라 장비를 확인할 수 없어 불러오지 않았어요. 다시 저장해 주세요.");
      return;
    }
    dispatch({ type: "load", edits: applied.edits });
    setNotice(
      `${savedTime(saved.savedAt)}에 저장한 입력을 불러왔어요.` +
        (applied.skipped > 0 ? ` 장비가 바뀌어 ${applied.skipped}개는 불러오지 않았어요.` : ""),
    );
  }

  return (
    <div aria-live="polite">
      {failure ? (
        <div className={quote.notice}>
          <div role="alert">
            <strong>{combatPowerFailureCopy(failure).title}</strong>
            <p>{combatPowerFailureCopy(failure).text}</p>
          </div>
          <button
            type="button"
            className={quote.outlinePill}
            aria-disabled={character.isFetching || waiting || undefined}
            onClick={() => !character.isFetching && !waiting && reload()}
          >
            다시 불러오기
          </button>
        </div>
      ) : data && current && options.data ? (
        <div className={styles.columns}>
          {/* Desktop: result on the left, sticky at the top. Phones: inputs
              first and the result pinned to the bottom, so nothing above
              the inputs grows when an answer arrives. */}
          {/* 사용자 지적 10-12: on wide screens the whole column — lead,
              result, buttons and 바꾼 것 — follows the scroll, not the
              result alone; a column taller than the screen scrolls inside
              itself with the result held at its top. */}
          <div className={styles.rail}>
          {head && <div className={styles.railHead}>{head}</div>}
          {roleReason && (
            <p className={styles.roleNote} role="status">
              {roleReason}
            </p>
          )}
          <ResultBand
            base={data.combatPower}
            itemLevel={data.itemLevel ?? null}
            data={result}
            changed={changes.length}
            stale={simulation.isFetching || changes !== debounced}
          />
          <div className={styles.side}>
            <div className={styles.toolbar} role="toolbar" aria-label="입력 기록">
              <button
                type="button"
                className={quote.outlinePill}
                aria-disabled={history.past.length === 0 || undefined}
                onClick={() => dispatch({ type: "undo" })}
              >
                <UndoArrow size={14} aria-hidden="true" /> 이전
              </button>
              <button
                type="button"
                className={quote.outlinePill}
                aria-disabled={history.future.length === 0 || undefined}
                onClick={() => dispatch({ type: "redo" })}
              >
                <UndoArrow size={14} aria-hidden="true" className={styles.redoIcon} /> 다음
              </button>
              <button
                type="button"
                className={quote.outlinePill}
                aria-disabled={isEmpty(edits) || undefined}
                onClick={() => dispatch({ type: "reset" })}
              >
                <RotateLeft size={14} aria-hidden="true" /> 초기화
              </button>
              <button
                type="button"
                className={quote.outlinePill}
                aria-disabled={isEmpty(edits) || undefined}
                onClick={() => !isEmpty(edits) && save()}
              >
                입력 저장
              </button>
              {saved && (
                <button type="button" className={quote.outlinePill} onClick={load}>
                  저장한 입력 불러오기
                </button>
              )}
            </div>
            <p className={styles.toolbarNote} role="status">
              {notice}
            </p>
            {outdated && (
              <p className={styles.outdated} role="status">
                캐릭터 정보가 새로 갱신됐어요.{" "}
                <button type="button" className={styles.link} onClick={reload}>
                  다시 불러오기
                </button>
              </p>
            )}
            {result && <ChangeList data={result} values={options.data.data.polishValues} />}
          </div>
          </div>
          <Editors
            options={options.data.data}
            current={current}
            edits={edits}
            setEdits={setEdits}
          />
        </div>
      ) : name ? (
        <p className={styles.empty} data-loading="" role="status">
          {embedded ? "시뮬레이터를 준비하고 있어요" : "캐릭터 정보를 읽고 있어요"}
        </p>
      ) : (
        <p className={styles.empty}>
          캐릭터를 불러오면 보석·재련·품질을 바꿨을 때 전투력이 얼마나 오르는지 보여 드려요.
        </p>
      )}
    </div>
  );
}

/* Saved inputs: per browser, per character (L6). Read through the store
   so a save in another tab shows the load button here too. */
const SAVED_EVENT = "loakraken:combat-power:saved";
const subscribeSaved = (callback: () => void) => {
  window.addEventListener(SAVED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SAVED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};
function useSavedEdits(name: string) {
  const text = useSyncExternalStore(
    subscribeSaved,
    () => {
      try {
        return name ? localStorage.getItem(savedKey(name)) : null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => parseSaved(text), [text]);
}
const savedTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  });

function CombatPowerContent({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [input, setInput] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState(
    initialName && !characterNameError(initialName) ? normalizeCharacterName(initialName) : "",
  );

  // The same query the simulator reads (one request): the search button
  // waits on it and on its rate limit.
  const character = useQuery({
    queryKey: ["character", name],
    queryFn: ({ signal }) => fetchCharacter(name, signal),
    enabled: !!name,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const error = characterNameError(input);
  const limit = useRateLimit(character.error);
  const waiting = limit.seconds > 0;
  const busy = character.isFetching && !character.data;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || waiting) return;
    setTouched(true);
    if (error) return;
    const target = normalizeCharacterName(input);
    router.replace(`?${new URLSearchParams({ character: target })}`, { scroll: false });
    setName(target);
  }

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#cp-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="cp-main">
        <section className={quote.hero} aria-labelledby="cp-page-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <FlashCircle size={18} />
          </span>
          <p className={quote.heroKicker}>전투 계산</p>
          <h1 id="cp-page-heading">전투력 시뮬레이터</h1>
          <p className={quote.heroCopy}>바꾸면 얼마나 오르는지, 항목별로.</p>
          <Link href="/tools" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 도구 전체
          </Link>
        </section>

        <div className={quote.band}>
          <div className={styles.workspace}>
            <form className={styles.search} onSubmit={submit} noValidate>
              <label className={quote.field} data-grow="">
                <span>캐릭터 이름</span>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="시뮬레이션할 캐릭터"
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
                {retryLabel(limit.seconds, "불러오기")}
              </button>
              {touched && error && <p className={quote.inputError}>{error}</p>}
            </form>

            {/* A new character starts from its own values (keyed). */}
            <CombatPowerSimulator key={name} name={name} />
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 공식 전투정보실 원문 기반 계산
      </footer>
    </div>
  );
}

export function CombatPowerTool({ initialName }: { initialName: string }) {
  return <CombatPowerContent initialName={initialName} />;
}
