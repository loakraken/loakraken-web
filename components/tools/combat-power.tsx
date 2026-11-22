"use client";

import { HubTabs } from "@/components/site/hub-tabs";

import {
  useCallback,
  useEffect,
  useId,
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
  GEM_MAX,
  GEM_MIN,
  GEM_OPTIONS,
  GEM_SERIES,
  currentGems,
  gemEditError,
  gemKey,
  gemText,
  sameGem,
  withGemType,
  type CurrentGem,
  type GemEdit,
} from "@/lib/combat-power/ark-gems";
import { BOSS_LEVEL_NOTE, arkGridRealView } from "@/lib/character/efficiency-real";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArkGemRanking } from "./ark-gem-ranking";
import type { GemSwap } from "@/lib/combat-power/gem-ranking";
import {
  ARM_GUARD_GRADES,
  ARM_GUARD_MAX,
  notComputedHere,
  ROLE_REASONS,
  GEAR_TYPES,
  NO_ADVANCED_REFINE,
  hasNoAdvancedRefine,
  GRADES,
  GRADE_LABEL,
  KIND_LABEL,
  braceletName,
  gradeWithValue,
  arkPassiveMax,
  arkPassiveNote,
  isArkPassiveOpen,
  isCoreOpen,
  isAdvancedRefineOpen,
  isOpen,
  isRefineOpen,
  isUpgradeGear,
  KARMA_MAX,
  KARMA_TREE,
  karmaLevelOf,
  polishValue,
  polishOptionText,
  polishSwapOf,
  polishSwapValue,
  polishPreset,
  polishPresetOf,
  wornPolish,
  POLISH_NONE,
  refineEdit,
  type Grade,
  NO_EDITS,
  combatPowerFailureCopy,
  gemLevel,
  hasComputed,
  toChanges,
  type Current,
  type Edits,
  type Options,
  type PolishPreset,
  type PolishValues,
  type Simulation,
  gemLabels,
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
import { editsFor, gearTypeOf, type SpecUpChange } from "@/lib/spec-up/model";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { SiteHeader } from "@/components/site/site-header";
import quote from "./material-quote.module.css";
import styles from "./combat-power.module.css";
import { FpEnd } from "@/components/ui/fp-end";

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

/** The choices plus the current value when it lies outside them (a weapon at +8 under refineMin 10),
 * so the select never shows empty and picking it back is "no change". */
const withCurrent = (values: number[], current: number) =>
  values.includes(current) ? values : [...values, current].sort((x, y) => x - y);

/** The parts of the character the first cut can change. */
function currentOf(data: Character, karmaSim = false, armorSim = false, gemSim = false) {
  const worn = (data.loadout.gems?.items ?? []).flatMap((gem) =>
    gem.slot != null && gem.level != null
      ? [{ slot: gem.slot, level: gem.level, name: gem.name ?? `보석 ${gem.slot + 1}` }]
      : [],
  );
  const labels = gemLabels(worn, data.loadout.gems?.effects?.skills);
  const gems = worn.map((gem) => ({ ...gem, label: labels.get(gem.slot) ?? gem.name }));
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
            // No advanced step on 전율 gear: nothing to show or edit. A weapon's opens only when it is 업화; any
            // other weapon (에스더, special, 결단) has no model, so its field is hidden (PM 총괄 11-21).
            advanced:
              hasNoAdvancedRefine(item.name) || (item.type === "무기" && !isUpgradeGear(item.name))
                ? null
                : (item.detail?.advancedRefineLevel ?? null),
            noAdvanced: hasNoAdvancedRefine(item.name),
            upgrade: isUpgradeGear(item.name),
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
      part: item.type ?? null,
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
  // 깨달음 카르마 레벨 (api #1004): only where the screen edits it, and only once it was read.
  const karma = karmaSim ? karmaLevelOf(data.loadout.arkPassive?.points) : null;
  // 아크 그리드 젬 (ARK_GEM_SIM, api #1079): the gems a swap starts from, in the cores that are open.
  const arkGems = gemSim ? currentGems(data.loadout.arkGrid?.slots ?? [], isCoreOpen) : [];
  // Armour 재련 · 상급 재련 (ARMOR_CP_SIM): the rows open and their edits go out.
  return { gems, gear, polish, bracelet, engravings, stones, arkPassive, karma, cores, arkGems, armGuard, armor: armorSim };
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

/** 연마 한꺼번에: the grades the options offer, then no scoring option. */
const POLISH_PRESETS: readonly { value: PolishPreset; label: string }[] = [
  { value: "HIGH", label: "모두 상" },
  { value: "MID", label: "모두 중" },
  { value: "LOW", label: "모두 하" },
  { value: POLISH_NONE, label: "모두 없음" },
];

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

/**
 * One gem worn and the gem to try in its place (api #1079): type (that core's three), 의지력 효율, point and two
 * options of the type with their levels. Folded to one line (the gem as it reads now) until opened; a type change
 * keeps the options the new type rolls (withGemType). A swap the api would refuse says why and is not sent.
 */
function GemRow({
  gem,
  swap,
  onChange,
  onReset,
}: {
  gem: CurrentGem;
  swap: GemEdit;
  onChange: (next: GemEdit) => void;
  onReset: () => void;
}) {
  const name = `${gem.core.replace(/^.*:\s*/, "")} 젬 ${gem.index + 1}`;
  const changed = !sameGem(swap, gem.edit);
  const error = gemEditError(swap, gem.series);
  const pool = GEM_OPTIONS[swap.gemType] ?? [];
  const levels = range(GEM_MIN, GEM_MAX);
  const effect = (i: 0 | 1, next: Partial<GemEdit["effects"][number]>) => {
    const effects = [...swap.effects] as GemEdit["effects"];
    effects[i] = { ...effects[i], ...next };
    onChange({ ...swap, effects });
  };
  return (
    <li className={styles.gemRow}>
      <details className={styles.gemDetails}>
        <summary className={`${styles.gemSummary} hit-44`} data-changed={changed || undefined}>
          <span className={styles.rowName}>{name}</span>
          <span className={styles.gemText}>
            {gemText(swap)}
            {!gem.active && " · 꺼진 젬"}
          </span>
        </summary>
        <div className={styles.gemEditor}>
          <Choice
            label={`${name} 종류`}
            caption="종류"
            value={swap.gemType}
            original={gem.edit.gemType}
            values={GEM_SERIES[gem.series].map((type) => ({ value: type, label: type }))}
            onChange={(type) => onChange(withGemType(swap, type))}
          />
          <Select
            label={`${name} 의지력 효율`}
            caption="의지력 효율"
            value={swap.willEfficiency}
            original={gem.edit.willEfficiency}
            values={levels}
            onChange={(willEfficiency) => onChange({ ...swap, willEfficiency })}
          />
          <Select
            label={`${name} 포인트`}
            caption="포인트"
            value={swap.point}
            original={gem.edit.point}
            values={levels}
            onChange={(point) => onChange({ ...swap, point })}
          />
          {([0, 1] as const).map((i) => (
            <span key={i} className={styles.gemOption}>
              <Choice
                label={`${name} 옵션 ${i + 1}`}
                caption={`옵션 ${i + 1}`}
                value={swap.effects[i].name}
                original={gem.edit.effects[i].name}
                // The other line's option is not offered: one gem rolls two different options.
                values={pool
                  .filter((option) => option === swap.effects[i].name || option !== swap.effects[1 - i].name)
                  .map((option) => ({ value: option, label: option }))}
                onChange={(option) => effect(i, { name: option })}
              />
              <Select
                label={`${name} 옵션 ${i + 1} 레벨`}
                caption="레벨"
                value={swap.effects[i].level}
                original={gem.edit.effects[i].level}
                values={levels}
                onChange={(level) => effect(i, { level })}
              />
            </span>
          ))}
          {changed && (
            <button type="button" className={`${styles.gemReset} hit-44`} onClick={onReset}>
              지금 젬으로 되돌리기
            </button>
          )}
          {/* Always there, its text changing: a status region mounted with its text may go unread (#1928 P3). */}
          <p className={styles.gemError} role="status">
            {error ?? ""}
          </p>
        </div>
      </details>
    </li>
  );
}

function Editors({
  options,
  current,
  edits,
  setEdits,
  gemRanking,
}: {
  options: Options;
  current: ReturnType<typeof currentOf>;
  edits: Edits;
  setEdits: (update: (prev: Edits) => Edits) => void;
  /** 바꿔 본 젬 순위, right under the gems it ranks. */
  gemRanking?: ReactNode;
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
                <span className={styles.rowName}>{gem.label}</span>
                <span className={styles.rowFrom}>Lv.{gem.level}</span>
                <Select
                  label={`${gem.label} 레벨`}
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
                {item.refine != null && !isRefineOpen(item.type, current.armor) ? (
                  <Locked caption="재련" value={`+${item.refine}`} />
                ) : item.refine != null ? (
                  <Select
                    label={`${item.type} 재련 단계`}
                    caption="재련"
                    value={
                      refineEdit(edits.refine[item.index], item, { min: options.refineMin, max: options.refineMax }, current.armor) ??
                      item.refine
                    }
                    original={item.refine}
                    values={withCurrent(refineValues, item.refine)}
                    onChange={(refine) =>
                      setEdits((prev) => ({ ...prev, refine: { ...prev.refine, [item.index]: refine } }))
                    }
                  />
                ) : (
                  <span className={styles.rowFrom}>재련 —</span>
                )}
                {item.noAdvanced && (
                  <span className={styles.rowFrom} title={NO_ADVANCED_REFINE}>
                    상급 재련 없음
                  </span>
                )}
                {item.advanced != null && !isAdvancedRefineOpen(item.type, current.armor, item.upgrade) && (
                  <Locked caption="상급" value={item.advanced} />
                )}
                {item.advanced != null && isAdvancedRefineOpen(item.type, current.armor, item.upgrade) && (
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
          {/* 연마 한꺼번에 (PM 총괄 11-21, X1): every line at one grade on its own option, or every line with no
              scoring option. One press is one 이전; a button is pressed while every line is at it. */}
          {isOpen("POLISH") && (
            <li className={styles.presetRow}>
              <div className={styles.presets} role="group" aria-label="연마 모든 줄 한꺼번에">
                {POLISH_PRESETS.filter((preset) => preset.value === POLISH_NONE || options.polishGrades.includes(preset.value)).map(
                  (preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`${styles.preset} hit-44`}
                      aria-pressed={polishPresetOf(edits, current.polish) === preset.value}
                      onClick={() => setEdits((prev) => polishPreset(prev, current.polish, preset.value))}
                    >
                      {preset.label}
                    </button>
                  ),
                )}
              </div>
            </li>
          )}
          {current.polish.map((line) => {
            const key = `${line.index}:${line.line}`;
            // A spec-up 연마 step (api #951) puts another accessory in: the line names its new option, the one worn
            // now under it, and a line with no scoring option has no grade to pick (never the raw "NONE").
            const swap = polishSwapOf(edits, line);
            if (swap != null)
              return (
                <li key={key}>
                  <span className={styles.rowName}>
                    {polishOptionText(swap)}
                    <small className={styles.rowSub}>
                      {`${line.item} · 지금 ${line.option} ${line.value} `}
                      {/* Back to the worn line, this line only (review P3 #1700); 이전 undoes it. */}
                      <button
                        type="button"
                        className={styles.link}
                        aria-label={`${line.item} 연마 ${line.line + 1} 지금 줄로 되돌리기`}
                        onClick={() => setEdits((prev) => wornPolish(prev, key))}
                      >
                        되돌리기
                      </button>
                    </small>
                  </span>
                  {swap === POLISH_NONE ? (
                    <span className={styles.locked}>등급 없음</span>
                  ) : (
                    <Choice
                      label={`${line.item} ${polishOptionText(swap)} 등급`}
                      value={edits.polish[key] ?? line.grade ?? ""}
                      // Not the line worn: every grade is a change, and there is no empty pick.
                      original=""
                      values={options.polishGrades.map((grade) => ({
                        value: grade,
                        label: gradeWithValue(grade, polishSwapValue(options.polishValues, swap, grade, line.part)),
                      }))}
                      onChange={(grade) =>
                        setEdits((prev) => ({ ...prev, polish: { ...prev.polish, [key]: grade as Grade } }))
                      }
                    />
                  )}
                </li>
              );
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
        <Card
          id="cp-ark-passive"
          title="아크 패시브"
          locked={!current.arkPassive.some((item) => isArkPassiveOpen(item.tree)) && current.karma == null}
        >
          {current.arkPassive.map((item) => (
            <li key={item.tree}>
              <span className={styles.rowName}>{item.tree}</span>
              {!isArkPassiveOpen(item.tree) ? (
                <Locked caption="포인트" value={`${item.points}P`} />
              ) : (
                <span className={styles.rowFrom}>{item.points}P</span>
              )}
              {isArkPassiveOpen(item.tree) && (
                <PointField
                  label={`아크 패시브 ${item.tree} 포인트`}
                  value={edits.arkPassive[item.tree] ?? item.points}
                  original={item.points}
                  max={arkPassiveMax(item.tree)}
                  // The in-game maximum, said beside the field (review P3 #1706); none for the api range.
                  hint={arkPassiveNote(item.tree)}
                  onChange={(points) =>
                    setEdits((prev) => ({ ...prev, arkPassive: { ...prev.arkPassive, [item.tree]: points } }))
                  }
                />
              )}
            </li>
          ))}
          {/* 깨달음 카르마 레벨 (api #1004, KARMA_SIM): its own row, apart from the tree's points. */}
          {current.karma != null && (
            <li key="karma">
              <span className={styles.rowName}>
                깨달음 카르마
                <small className={styles.rowSub}>레벨</small>
              </span>
              <span className={styles.rowFrom}>Lv.{current.karma}</span>
              <Select
                label="깨달음 카르마 레벨"
                value={edits.karma[KARMA_TREE] ?? current.karma}
                original={current.karma}
                values={range(0, KARMA_MAX)}
                onChange={(level) => setEdits((prev) => ({ ...prev, karma: { ...prev.karma, [KARMA_TREE]: level } }))}
              />
            </li>
          )}
        </Card>
      )}

      {current.cores.length > 0 && (
        <Card id="cp-cores" title="아크 그리드 코어" locked={!current.cores.some((item) => isCoreOpen(item.name))}>
          {current.cores.map((item) => {
            const edit = edits.core[item.slotIndex] ?? { grade: item.grade, point: item.point };
            const set = (next: Partial<typeof edit>) =>
              setEdits((prev) => ({ ...prev, core: { ...prev.core, [item.slotIndex]: { ...edit, ...next } } }));
            return (
              <li key={item.slotIndex}>
                <span className={styles.rowName}>{item.name}</span>
                {!isCoreOpen(item.name) ? (
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

      {/* 아크 그리드 젬 (ARK_GEM_SIM, api #1079): each gem worn in an open core can be swapped for another. */}
      {current.arkGems.length > 0 && (
        <Card id="cp-ark-gems" title="아크 그리드 젬">
          {current.arkGems.map((gem) => {
            const key = gemKey(gem);
            return (
              <GemRow
                key={key}
                gem={gem}
                swap={edits.arkGem[key] ?? gem.edit}
                onChange={(next) => setEdits((prev) => ({ ...prev, arkGem: { ...prev.arkGem, [key]: next } }))}
                onReset={() =>
                  setEdits((prev) => {
                    const rest = { ...prev.arkGem };
                    delete rest[key];
                    return { ...prev, arkGem: rest };
                  })
                }
              />
            );
          })}
        </Card>
      )}
      {gemRanking}
      {current.armor ? (
        <p className={styles.later}>
          지금은 보석·품질·각인·스톤·연마·팔찌·팔 보호구·재련·상급 재련(업화 무기·방어구)·아크 그리드 코어·아크 패시브
          진화와 도약을 바꿀 수 있어요. 아크 패시브 깨달음·혼돈의 별 무기 코어는 계산식을 확인하는 대로 열어요.
        </p>
      ) : (
        <p className={styles.later}>
          지금은 보석·품질·각인·스톤·연마·팔찌·팔 보호구·무기 재련·업화 무기 상급 재련·아크 그리드 코어·아크 패시브 진화와
          도약을 바꿀 수 있어요. 방어구 재련·상급 재련·아크 패시브 깨달음·혼돈의 별 무기 코어는 계산식을 확인하는 대로 열어요.
        </p>
      )}
    </div>
  );
}

/** Ark passive points: typed, applied only when a whole number in range. */
function PointField({
  label,
  value,
  original,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  original: number;
  max: number;
  /** A short visible note on the range ("최대 70"), read with the field. */
  hint?: string;
  onChange: (value: number) => void;
}) {
  // Typed text while focused; otherwise the applied value (so a reset shows).
  const [draft, setDraft] = useState<string | null>(null);
  // The last keystroke went over the maximum and was held to it (QA P2-1 v0.3.13).
  const [clamped, setClamped] = useState(false);
  const noteId = useId();
  // Gone once the value moves off the maximum (another key, 이전, 초기화).
  const note = clamped && value === max ?`최대 ${max}까지 넣을 수 있어 ${max}에 맞췄어요` : hint;
  return (
    <>
      <label className={styles.select} data-changed={value !== original || undefined}>
        <span className={styles.sr}>{label}</span>
        <input
          className={styles.number}
          inputMode="numeric"
          aria-describedby={note ? noteId : undefined}
          value={draft ?? String(value)}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
            if (next === "") {
              setDraft(next);
              return;
            }
            // Typed key by key, "71" passes through 7 first: over the maximum it is held
            // to the maximum, never left at the digits applied before (QA P2-1 v0.3.13).
            const over = Number(next) > max;
            setClamped(over);
            setDraft(over ? String(max) : next);
            onChange(Math.min(Number(next), max));
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
      {/* Outside the label, so the field's name stays the label alone; read as its description,
          and said aloud when it changes to the clamp note. */}
      {note && (
        <span id={noteId} className={`${styles.caption} ${styles.note}`} aria-live="polite">
          {note}
        </span>
      )}
    </>
  );
}

function ResultBand({
  base,
  itemLevel,
  ark,
  data,
  changed,
  stale,
}: {
  base: number | null;
  itemLevel: number | null;
  /** Today's 아크 그리드 효율 and its 보스 피해 환산 Lv (X2), when worked out and shown on this deployment. */
  ark: { total: string; bossLevel: string } | null;
  data: Simulation | null;
  changed: number;
  stale: boolean;
}) {
  const computed = data && hasComputed(data);
  const before = data?.before ?? base;
  // Changes without a number, split as the 바꾼 것 rows say them (v0.3.15 RC P1-1): not computed for this character
  // (the armour CP gate) is counted as 계산하지 않음, never as 'coming soon'.
  const open = data?.contributions.filter((item) => !(item.status === "OK" && item.delta != null)) ?? [];
  const held = open.filter(notComputedHere).length;
  const counts = (pending: number) =>
    `${pending > 0 ? ` · 계산 준비 중 ${pending}개` : ""}${held > 0 ? ` · 계산하지 않음 ${held}개` : ""}`;
  return (
    <section className={styles.band} aria-labelledby="cp-result" data-stale={stale || undefined}>
      <p id="cp-result" className={styles.bandLabel}>
        {changed > 0 ? "예상 전투력" : "전투력"}
      </p>
      <p className={styles.bandValue}>
        {before == null ? "—" : power(computed && data.after != null ? data.after : before)}
      </p>
      {/* Its own line, held from the start: beside the value it wrapped under
          it on the first change and pushed everything below 24px (A7). */}
      <p className={styles.bandDelta}>
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
            ? "바꾼 항목은 전투력에 영향이 없어요. 이유는 아래 ‘바꾼 것’에 있어요."
            : computed
            ? `바꾼 ${changed}개 중 계산된 항목만 반영했어요${data.partial || held > 0 ? counts(Math.max(0, data.unsupportedCount - held)) : ""}.`
            : held === 0
              ? `바꾼 ${changed}개 항목은 계산식을 확인하고 있어 아직 반영하지 않았어요.`
              : `바꾼 ${changed}개 항목은 반영하지 않았어요${counts(open.length - held)}. 이유는 아래 ‘바꾼 것’에 있어요.`}
      </p>
      {/* Item level moves with refining; the simulation does not return one, so
          this is today's value, no made-up change (PM-프론트 16:37 ②), and says
          so now that the weapon's refine can change (PM 총괄 11-12). One fixed
          text: nothing in the band changes length when a step is picked (A7). */}
      {itemLevel != null && (
        <p className={styles.bandSub}>
          지금 아이템 레벨 <b>{itemLevel.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</b>
        </p>
      )}
      {/* X2: today's value too (a gem swap's own share is in 바꿔 본 젬 순위); drawn with the band, so it never moves it. */}
      {ark && (
        <p className={styles.bandSub}>
          지금 아크 그리드 효율 <b>{ark.total}</b> ·{" "}
          {/* What the level is on its term, reachable by keyboard and touch (a title attribute is not). */}
          <Tooltip>
            <TooltipTrigger className={styles.bandTerm} aria-label={`보스 피해 환산: ${BOSS_LEVEL_NOTE}`}>
              보스 피해 환산
            </TooltipTrigger>
            <TooltipContent>{BOSS_LEVEL_NOTE}</TooltipContent>
          </Tooltip>{" "}
          <b>Lv {ark.bossLevel}</b>
        </p>
      )}
    </section>
  );
}

/** POLISH from/to read "옵션 +1.60%" → "옵션 HIGH": show the grade with its value. */
function polishText(text: string | null, from: string | null, values: PolishValues | undefined) {
  const match = text?.match(/^(.*) (LOW|MID|HIGH)$/);
  if (!match) return gradeText(text);
  // A 연마 step's option keeps the request's " %" mark ("추가 피해 % HIGH", api #951): shown without it.
  const [, option, grade] = match;
  // from is "옵션 +1.60%": the accessory's current value decides if the table fits.
  const current = from?.startsWith(`${option} `) ? from.slice(option.length + 1) : null;
  const value = current ? polishValue(values, option, { value: current, grade: null }, grade) : null;
  return `${polishOptionText(option)} ${gradeWithValue(grade, value)}`;
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
              // Outside the armour CP gate the api does not compute armour for this character (not 'coming soon'):
              // its sentence follows right under (PM 총괄 11-21).
              <span className={styles.pending}>{notComputedHere(item) ? "계산하지 않음" : "계산 준비 중"}</span>
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
  karma = false,
  armor = false,
  gem = false,
  efficiency = false,
}: {
  name: string;
  initial?: Character;
  /** KARMA_SIM on this deployment (server flag): the 깨달음 카르마 레벨 field. */
  karma?: boolean;
  /** ARMOR_CP_SIM on this deployment (server flag): armour 재련 · 상급 재련. */
  armor?: boolean;
  /** ARK_GEM_SIM on this deployment (server flag): 아크 그리드 젬 바꾸기 and 바꿔 본 젬 순위 (api #1079). */
  gem?: boolean;
  /** CHARACTER_EFFICIENCY on this deployment (server flag): today's 아크 그리드 효율 and 보스 피해 환산 Lv (X2). */
  efficiency?: boolean;
  /** Changes to begin with (스펙업 "적용해 보기" or a 목표 path), as one step 이전 can undo. */
  start?: SpecUpChange[];
  /** Shown at the top of the sticky column (the character tab's lead line). */
  head?: ReactNode;
}) {
  const embedded = !!initial;
  // 이전·다음·초기화 (PM-프론트 16:37 ②): every edit is a step.
  const [history, dispatch] = useReducer(historyReducer, undefined, () => {
    const empty = startHistory();
    // In order: a later step on the same slot (8→9→10) leaves the last level.
    // The character tab passes the character, so a weapon refine step comes in (#1567).
    const gearType = gearTypeOf(initial);
    const first = (start ?? []).reduce<Edits | null>(
      (edits, change) => editsFor(change, edits ?? NO_EDITS, gearType, armor) ?? edits,
      null,
    );
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
  const current = useMemo(() => (data ? currentOf(data, karma, armor, gem) : null), [data, karma, armor, gem]);
  const refineMin = options.data?.data.refineMin;
  const refineMax = options.data?.data.refineMax;
  // No changes until the options are here (codex #1572 P3): they carry the refine range, and a refine
  // edit counts only once it is known, so a path asked earlier would go out without its refine step and
  // then again with it. The editors wait for the options too, so nothing on screen waits longer.
  const changes = useMemo(
    () =>
      current && refineMin != null && refineMax != null
        ? toChanges(edits, current as Current, { min: refineMin, max: refineMax })
        : [],
    [edits, current, refineMin, refineMax],
  );
  const debounced = useDebounced(changes);
  // 바꿔 본 젬 순위 (ARK_GEM_SIM): every gem swap that differs from the gem worn and the api takes, each computed on
  // its own; debounced as the simulator's own changes are.
  const swaps = useMemo<GemSwap[]>(
    () =>
      (current?.arkGems ?? []).flatMap((gem) => {
        const swap = edits.arkGem[gemKey(gem)];
        return swap && !sameGem(swap, gem.edit) && !gemEditError(swap, gem.series) ? [{ key: gemKey(gem), gem, swap }] : [];
      }),
    [current, edits.arkGem],
  );
  const gemSwaps = useDebounced(swaps);
  // 아크 그리드 효율 and its 보스 피해 환산 Lv (X2), as the character page shows them (CHARACTER_EFFICIENCY on).
  const arkView = arkGridRealView(
    efficiency ? data?.arkGridEfficiency?.real : null,
    !!data?.loadout.arkGrid && data.loadout.arkGrid.slots.length > 0,
  );
  const ark = arkView.state === "ready" ? { total: arkView.total, bossLevel: arkView.bossLevel } : null;
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
            ark={ark}
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
            gemRanking={<ArkGemRanking name={name} fetchedAt={data.fetchedAt} swaps={gemSwaps} />}
          />
        </div>
      ) : name ? (
        <p className={styles.empty} data-loading="" role="status">
          {embedded ? "시뮬레이터를 준비하고 있어요…" : "캐릭터 정보를 읽고 있어요…"}
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

function CombatPowerContent({
  initialName,
  karma = false,
  armor = false,
  gem = false,
  efficiency = false,
}: {
  initialName: string;
  karma?: boolean;
  armor?: boolean;
  gem?: boolean;
  efficiency?: boolean;
}) {
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
          <p className={quote.heroKicker}>전투 계산</p>
          <h1 id="cp-page-heading">전투력 시뮬레이터</h1>
          <p className={quote.heroCopy}>바꾸면 얼마나 오르는지, 항목별로.</p>
          <span className={quote.heroIcon} aria-hidden="true">
            <FlashCircle size={18} />
          </span>
          <Link href="/tools" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 도구 전체
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
                  placeholder="시뮬레이션할 캐릭터"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-invalid={touched && !!error}
                />
              </label>
              <button
                type="submit"
                className={quote.secondaryPill}
                // Drawn once whole (data-fp-whole, A7 rest sweep): the button ends the row, so its label arriving grew it leftwards.
                data-fp-whole=""
                aria-disabled={busy || waiting || undefined}
                aria-busy={busy || undefined}
              >
                {retryLabel(limit.seconds, "불러오기")}
                <FpEnd />
              </button>
              {touched && error && <p className={quote.inputError}>{error}</p>}
            </form>

            {/* A new character starts from its own values (keyed). */}
            <CombatPowerSimulator key={name} name={name} karma={karma} armor={armor} gem={gem} efficiency={efficiency} />
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 공식 전투정보실 원문 기반 계산
      </footer>
    </div>
  );
}

export function CombatPowerTool({
  initialName,
  karma = false,
  armor = false,
  gem = false,
  efficiency = false,
}: {
  initialName: string;
  karma?: boolean;
  armor?: boolean;
  /** ARK_GEM_SIM on this deployment (server flag): 아크 그리드 젬 바꾸기 (api #1079). */
  gem?: boolean;
  /** CHARACTER_EFFICIENCY on this deployment (server flag): today's 아크 그리드 효율 and 보스 피해 환산 Lv (X2). */
  efficiency?: boolean;
}) {
  return <CombatPowerContent initialName={initialName} karma={karma} armor={armor} gem={gem} efficiency={efficiency} />;
}
