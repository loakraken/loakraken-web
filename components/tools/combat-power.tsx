"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlashCircle, RotateLeft } from "@/components/ui/icons";
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
  GEAR_TYPES,
  GRADES,
  GRADE_LABEL,
  KIND_LABEL,
  braceletName,
  isOpen,
  type Grade,
  NO_EDITS,
  combatPowerFailureCopy,
  gemLevel,
  hasComputed,
  toChanges,
  type Current,
  type Edits,
  type Options,
  type Simulation,
} from "@/lib/combat-power/model";
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
  return { gems, gear, polish, bracelet, engravings, stones, arkPassive, cores };
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
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {original == null && <option value="">—</option>}
        {values.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
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
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {values.map((level) => (
          <option key={level} value={level}>
            {format(level)}
          </option>
        ))}
      </select>
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
              <select
                value={edits.gemAll ?? ""}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    gemAll: event.target.value ? Number(event.target.value) : null,
                    gems: {},
                  }))
                }
                aria-label="보석 모두 같은 레벨로"
              >
                <option value="">그대로</option>
                {gemValues.map((level) => (
                  <option key={level} value={level}>
                    {level === 0 ? "모두 빼기" : `${level}레벨`}
                  </option>
                ))}
              </select>
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
                  <Locked caption="등급" value={line.grade ? (GRADE_LABEL[line.grade] ?? line.grade) : "—"} />
                ) : (
                  <Choice
                    label={`${line.item} ${line.option} 등급`}
                    value={edits.polish[key] ?? line.grade ?? ""}
                    original={line.grade}
                    values={gradeValues}
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
                <Choice
                  label={`팔찌 ${line.name} 등급`}
                  value={edits.bracelet[line.line] ?? line.grade ?? ""}
                  original={line.grade}
                  values={gradeValues}
                  onChange={(grade) =>
                    setEdits((prev) => ({ ...prev, bracelet: { ...prev.bracelet, [line.line]: grade as Grade } }))
                  }
                />
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
        지금은 보석·품질·각인·스톤을 바꿀 수 있어요. 재련·연마·팔찌·아크 패시브·아크 그리드는 계산식을 확인하는 대로
        열어요.
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
  data,
  changed,
  stale,
}: {
  base: number | null;
  data: Simulation | null;
  changed: number;
  stale: boolean;
}) {
  const computed = data && hasComputed(data);
  const before = data?.before ?? base;
  return (
    <section className={styles.band} aria-labelledby="cp-result" data-stale={stale || undefined}>
      <p id="cp-result" className={styles.bandLabel}>
        전투력
      </p>
      <p className={styles.bandValue}>
        {before == null ? "—" : power(computed && data.after != null ? data.after : before)}
        {computed && data.delta != null && (
          <span className={data.delta >= 0 ? styles.gain : styles.loss}>
            {signed(data.delta)}
            {data.deltaPercent != null &&
              ` (${data.deltaPercent < 0 ? "−" : "+"}${Math.abs(data.deltaPercent).toFixed(3)}%)`}
          </span>
        )}
      </p>
      <p className={styles.bandNote}>
        {changed === 0
          ? "아래에서 값을 바꾸면 바로 다시 계산해요."
          : computed
            ? `바꾼 ${changed}개 중 계산된 항목만 반영했어요${data.partial ? ` · 계산 준비 중 ${data.unsupportedCount}개` : ""}.`
            : `바꾼 ${changed}개 항목은 계산식을 확인하고 있어 아직 반영하지 않았어요.`}
      </p>
    </section>
  );
}

function ChangeList({ data }: { data: Simulation }) {
  if (data.contributions.length === 0) return null;
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
                  {changeText(item.kind, item.from) ?? "—"} → {changeText(item.kind, item.to) ?? "—"}
                </small>
              )}
            </span>
            {item.status === "OK" && item.delta != null ? (
              <b className={item.delta >= 0 ? styles.gain : styles.loss}>{signed(item.delta)}</b>
            ) : (
              <span className={styles.pending} title={item.basis}>
                계산 준비 중
              </span>
            )}
          </li>
        ))}
      </ul>
      {data.contributions.some((item) => item.status !== "OK") && (
        <p className={styles.basis}>
          {data.contributions.find((item) => item.status !== "OK")?.basis}
        </p>
      )}
    </section>
  );
}

function CombatPowerContent({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [input, setInput] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState(
    initialName && !characterNameError(initialName) ? normalizeCharacterName(initialName) : "",
  );
  const [edits, setEdits] = useState<Edits>(NO_EDITS);

  const character = useQuery({
    queryKey: ["character", name],
    queryFn: ({ signal }) => fetchCharacter(name, signal),
    enabled: !!name,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const options = useQuery({
    queryKey: ["combat-power-options"],
    queryFn: ({ signal }) => fetchOptions(signal),
    staleTime: Infinity,
    retry: false,
  });
  const data = character.data?.data ?? null;
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
  // The backend read a newer cache than the screen: reload the character first.
  const outdated = !!result && !!data && result.fetchedAt !== data.fetchedAt;

  const error = characterNameError(input);
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
  const busy = character.isFetching && !data;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || waiting) return;
    setTouched(true);
    if (error) return;
    const target = normalizeCharacterName(input);
    router.replace(`?${new URLSearchParams({ character: target })}`, { scroll: false });
    if (target !== name) setEdits(NO_EDITS);
    setName(target);
  }

  function reload() {
    setEdits(NO_EDITS);
    void character.refetch();
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
                  <ResultBand
                    base={data.combatPower}
                    data={result}
                    changed={changes.length}
                    stale={simulation.isFetching || changes !== debounced}
                  />
                  <div className={styles.side}>
                    {changes.length > 0 && (
                      <button
                        type="button"
                        className={quote.outlinePill}
                        onClick={() => setEdits(NO_EDITS)}
                      >
                        <RotateLeft size={14} aria-hidden="true" /> 처음 값으로
                      </button>
                    )}
                    {outdated && (
                      <p className={styles.outdated} role="status">
                        캐릭터 정보가 새로 갱신됐어요.{" "}
                        <button type="button" className={styles.link} onClick={reload}>
                          다시 불러오기
                        </button>
                      </p>
                    )}
                    {result && <ChangeList data={result} />}
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
                  캐릭터 정보를 읽고 있어요
                </p>
              ) : (
                <p className={styles.empty}>
                  캐릭터를 불러오면 보석·재련·품질을 바꿨을 때 전투력이 얼마나 오르는지 보여 드려요.
                </p>
              )}
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

export function CombatPowerTool({ initialName }: { initialName: string }) {
  return <CombatPowerContent initialName={initialName} />;
}
