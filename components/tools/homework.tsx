"use client";

import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRemaining } from "@/components/home/clock";
import { useMutation } from "@tanstack/react-query";
import { Add, ArrowDown, ArrowLeft, CloseCircle, TaskSquare } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import dynamic from "next/dynamic";
import { CharacterQueryError, fetchSiblings } from "@/lib/character/client";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import {
  characterCheckState,
  moveRaid,
  nextCleared,
  raidCheckState,
  setCharacterCleared,
  setRaidCleared,
  GOLD_CHARACTERS,
  GOLD_RAIDS_PER_CHARACTER,
  STORAGE_KEY,
  addCharacters,
  characterGold,
  eligibleModes,
  modeOf,
  nextReset,
  parseState,
  rollWeek,
  rosterSummary,
  unsettledModes,
  type Character,
  type HomeworkState,
  type RaidPlan,
} from "@/lib/tools/homework";
import { DIFFICULTY_LABEL, RAID_DATA, formatGold } from "@/lib/tools/raid-rewards";
import quote from "./material-quote.module.css";
import styles from "./homework.module.css";

type Sibling = { characterName: string; serverName: string; className: string; itemLevel: number };

const raidName = (id: string) => RAID_DATA.raids.find((r) => r.id === id)?.shortName ?? id;

function load(now: number): HomeworkState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY), now);
  } catch {
    return parseState(null, now);
  }
}

/**
 * Weekly reset countdown in the site-wide format (web #372, 사용자 19:32):
 * "H시간 M분" above an hour, a ticking "M분 SS초" under it.
 */
function ResetLeft({ now }: { now: number }) {
  const left = useRemaining(nextReset(now), now);
  return <>{left === undefined ? null : (left ?? "곧 초기화")}</>;
}

function Summary({ state, now }: { state: HomeworkState; now: number }) {
  const s = rosterSummary(state);
  const unsettled = unsettledModes(state.characters);
  return (
    <section className={styles.summary} aria-labelledby="hw-summary">
      <h2 id="hw-summary" className={styles.sr}>
        이번 주 요약
      </h2>
      <div className={styles.headline}>
        <p className={styles.label}>이번 주 골드</p>
        <p className={styles.big}>
          {formatGold(s.earned)}
          <small> / {formatGold(s.possible)}</small>
        </p>
        <p className={styles.note}>
          거래 가능 {formatGold(s.earned - s.earnedBound)} · 귀속 {formatGold(s.earnedBound)}
          {s.moreSpent > 0 && ` · 더보기 지출 −${formatGold(s.moreSpent)} 반영`}
          {s.unknownGates > 0 && ` · 골드 미확인 관문 ${s.unknownGates}개는 빠져 있어요`}
        </p>
        {unsettled.length > 0 && (
          <p className={styles.note}>
            합계에서 뺀 항목(클리어 골드 데이터 없음):{" "}
            {unsettled
              .map(({ raid, mode }) => `${raid.shortName} ${DIFFICULTY_LABEL[mode.difficulty]}`)
              .join(", ")}
          </p>
        )}
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>골드 캐릭터</dt>
          <dd>
            {s.goldCharacters}/{GOLD_CHARACTERS}
          </dd>
        </div>
        <div>
          <dt>레이드</dt>
          <dd>
            {s.raidsDone}/{s.raids}
          </dd>
        </div>
        <div>
          <dt>관문</dt>
          <dd>
            {s.gatesDone}/{s.gates}
          </dd>
          {/* Progress at a glance; grows on each check (모션 목록 숙제 진행률). */}
          <span className={styles.progress} aria-hidden="true">
            <i style={{ transform: `scaleX(${s.gates ? s.gatesDone / s.gates : 0})` }} />
          </span>
        </div>
        <div>
          <dt>주간 초기화까지</dt>
          <dd>
            <ResetLeft now={now} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function AddRoster({ onAdd }: { onAdd: (picked: Sibling[]) => void }) {
  const inputId = useId();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const siblings = useMutation({
    mutationFn: (target: string) => fetchSiblings(target, new AbortController().signal),
    onSuccess: (envelope) => {
      const list = [...envelope.data.siblings].sort((a, b) => b.itemLevel - a.itemLevel);
      setPicked(new Set(list.slice(0, GOLD_CHARACTERS).map((s) => s.characterName)));
    },
  });
  const list = siblings.data
    ? [...siblings.data.data.siblings].sort((a, b) => b.itemLevel - a.itemLevel)
    : [];
  const failure = siblings.error instanceof CharacterQueryError ? siblings.error.info : null;
  const limit = useRateLimit(siblings.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = name.trim();
    if (!target || siblings.isPending || limit.seconds > 0) return;
    siblings.mutate(target);
  }

  return (
    <section className={styles.card} aria-labelledby="hw-add">
      <h2 id="hw-add" className={styles.cardTitle}>
        원정대 불러오기
      </h2>
      <form className={styles.addForm} onSubmit={submit} noValidate>
        <label htmlFor={inputId} className={styles.sr}>
          캐릭터 이름
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="원정대 캐릭터 이름 하나"
          autoComplete="off"
          maxLength={16}
        />
        <button
          type="submit"
          className={quote.secondaryPill}
          aria-disabled={siblings.isPending || limit.seconds > 0 || undefined}
          aria-busy={siblings.isPending || undefined}
        >
          {siblings.isPending ? "불러오는 중" : retryLabel(limit.seconds, "불러오기")}
        </button>
      </form>
      {failure && (
        <p className={styles.error} role="alert">
          {limit.limited
            ? `${rateLimitCopy().title}. ${rateLimitCopy().text}`
            : failure.code === "CHARACTER_NOT_FOUND"
              ? "그 이름의 캐릭터를 찾지 못했어요."
              : "원정대를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."}
        </p>
      )}
      {list.length > 0 && (
        <fieldset className={styles.pick}>
          <legend>숙제에 넣을 캐릭터</legend>
          <ul>
            {list.map((s) => (
              <li key={s.characterName}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(s.characterName)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(s.characterName);
                      else next.delete(s.characterName);
                      setPicked(next);
                    }}
                  />
                  <span>
                    <b>{s.characterName}</b> {s.className} · {s.itemLevel.toLocaleString("ko-KR")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={quote.primaryPill}
            disabled={!picked.size}
            onClick={() => {
              onAdd(list.filter((s) => picked.has(s.characterName)));
              siblings.reset();
              setName("");
            }}
          >
            <Add size={16} aria-hidden="true" /> {picked.size}명 추가
          </button>
        </fieldset>
      )}
    </section>
  );
}

/**
 * Bencho "Reorder list", loaded when "순서 바꾸기" first opens — it is not
 * needed for the page to work (arrows and Alt+↑↓ do the same moves).
 */
const Arrange = dynamic(() => import("./homework-arrange"), {
  ssr: false,
  loading: () => <p className={styles.note}>순서 목록을 불러오고 있어요.</p>,
});

/** Bencho "Checklist", loaded with the first character card (same height held). */
const Checklist = dynamic(() => import("./homework-checklist"), { ssr: false });

function RaidRow({
  plan,
  itemLevel,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  selected,
  onSelect,
}: {
  plan: RaidPlan;
  itemLevel: number;
  /** Position in the character's list (gold goes to the first three). */
  index: number;
  count: number;
  onChange: (plan: RaidPlan) => void;
  onRemove: () => void;
  /** Move to a new position; the parent saves and announces it. */
  onMove: (to: number) => void;
  /** 선택 (사용자 안 10-11 21:06): while selected, ↑↓ move this raid. */
  selected: boolean;
  onSelect: (on: boolean) => void;
}) {
  const mode = modeOf(plan);
  if (!mode) return null;
  // Some sites pay nothing for a lower difficulty when a higher one is open;
  // the official guide limits gold only by six characters and three clears
  // a week, so the gold stays (PM 총괄 2026-10-10 09:30).
  const guide = RAID_DATA.sources[RAID_DATA.rules.source];
  const higherOpen = RAID_DATA.raids
    .find((r) => r.id === plan.raidId)
    ?.modes.some(
      (m) => m.difficulty !== "SINGLE" && m.minItemLevel > mode.minItemLevel && m.minItemLevel <= itemLevel,
    );
  const title = `${raidName(plan.raidId)} ${DIFFICULTY_LABEL[plan.difficulty]}`;
  const toggle = (key: "cleared" | "more", i: number) =>
    onChange({ ...plan, [key]: plan[key].map((v, j) => (j === i ? !v : v)) });
  // Keyboard move: Alt+↑/↓ anywhere in the raid (PM-프론트 기준 ③), plain
  // ↑/↓ while the raid is selected, Esc lets go (사용자 안 10-11 21:06).
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (selected && event.key === "Escape") {
      event.preventDefault();
      onSelect(false);
      return;
    }
    if (!(event.altKey || selected) || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const to = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (to >= 0 && to < count) onMove(to);
  };
  return (
    <li className={styles.raid} data-selected={selected || undefined} onKeyDown={onKeyDown}>
      <div className={styles.raidHead}>
        <strong className={styles.raidTitle}>{title}</strong>
        <span className={styles.raidTools}>
          <button
            type="button"
            className={styles.selectButton}
            aria-pressed={selected}
            aria-label={`${title} 선택`}
            aria-keyshortcuts="ArrowUp ArrowDown Escape"
            onClick={() => onSelect(!selected)}
          >
            선택
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label={`${title} 위로`}
            aria-keyshortcuts="Alt+ArrowUp"
          >
            <ArrowDown size={14} aria-hidden="true" style={{ rotate: "180deg" }} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onMove(index + 1)}
            disabled={index === count - 1}
            aria-label={`${title} 아래로`}
            aria-keyshortcuts="Alt+ArrowDown"
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className={styles.removeButton} onClick={onRemove} aria-label={`${title} 빼기`}>
            <CloseCircle size={18} aria-hidden="true" />
          </button>
        </span>
      </div>
      {higherOpen && (
        <p className={styles.note}>
          상위 난이도에 갈 수 있지만 골드를 그대로 계산해요.{" "}
          <a href={guide?.url ?? undefined} target="_blank" rel="noreferrer">
            공식 게임 가이드 &lsquo;콘텐츠 현황 확인&rsquo;
          </a>
          ({guide?.date} 수정) 기준 골드 제한은 캐릭터 6개·주 3회예요.
        </p>
      )}
      <ul className={styles.gates} role="group" aria-label={title}>
        {mode.gates.map((gate, i) => (
          <li key={gate.gate} data-done={plan.cleared[i] || undefined}>
            <label className={styles.gateCheck}>
              <input type="checkbox" checked={plan.cleared[i]} onChange={() => toggle("cleared", i)} />
              <span>
                {gate.gate}관문
                <small>{gate.gold === null ? "데이터 없음" : formatGold(gate.gold)}</small>
              </span>
            </label>
            {gate.moreCost !== null && (
              <label className={styles.moreCheck}>
                <input type="checkbox" checked={plan.more[i]} onChange={() => toggle("more", i)} />
                <span>더보기 −{formatGold(gate.moreCost)}</span>
              </label>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

function CharacterCard({
  character,
  goldFull,
  onChange,
  onRemove,
}: {
  character: Character;
  goldFull: boolean;
  onChange: (character: Character) => void;
  onRemove: () => void;
}) {
  const selectId = useId();
  const gold = characterGold(character);
  // Announces a move once (PM-프론트 기준 ③); the moved row keeps focus.
  const [moved, setMoved] = useState("");
  const [arranging, setArranging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const used = new Set(character.raids.map((r) => r.raidId));
  // One move for the arrows, 선택 + ↑↓, Alt+↑↓ and the order list's rows:
  // saved, then announced once ("…를 N번째로 옮겼어요").
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= character.raids.length || from === to) return;
    const plan = character.raids[from];
    onChange(moveRaid(character, from, to));
    setMoved(`${raidName(plan.raidId)} ${DIFFICULTY_LABEL[plan.difficulty]}: ${to + 1}번째로 옮겼어요.`);
  };
  const options = eligibleModes(character.itemLevel).filter(({ raid }) => !used.has(raid.id));
  return (
    <section className={styles.card} aria-label={`${character.name} 숙제`}>
      <div className={styles.charHead}>
        <div>
          <h3 className={styles.charName}>{character.name}</h3>
          <p className={styles.note}>
            {character.className} · {character.itemLevel.toLocaleString("ko-KR")}
            {character.server && ` · ${character.server}`}
          </p>
        </div>
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          aria-label={`${character.name} 빼기`}
        >
          <CloseCircle size={18} aria-hidden="true" />
        </button>
      </div>
      <label className={styles.goldToggle}>
        <input
          type="checkbox"
          role="switch"
          checked={character.gold}
          disabled={!character.gold && goldFull}
          onChange={(e) => onChange({ ...character, gold: e.target.checked })}
        />
        <span>
          골드 받기
          <small>
            {character.gold
              ? `${formatGold(gold.earned)} / ${formatGold(gold.possible)}`
              : goldFull
                ? `원정대 골드 캐릭터 ${GOLD_CHARACTERS}명을 모두 썼어요`
                : "골드 없이 진행"}
          </small>
        </span>
      </label>
      {character.raids.length > 0 && (
        // 전체 체크(사용자 14:44): Bencho "Checklist" — the first row is the
        // whole character, the rest one per raid; some gates done shows as
        // mixed. The wall demo's fall-and-reset and typed tasks are off.
        // Held at the block's own height (6 + 40 per row) until its chunk
        // arrives, so the raids below do not move.
        <div className={styles.checklist} style={{ minHeight: 6 + 40 * (character.raids.length + 1) }}>
          <Checklist
            items={[
              {
                key: "all",
                label: "전체 완료",
                done: characterCheckState(character) === "all",
                mixed: characterCheckState(character) === "some",
              },
              ...character.raids.map((plan) => ({
                key: plan.raidId,
                label: `${raidName(plan.raidId)} ${DIFFICULTY_LABEL[plan.difficulty]}`,
                done: raidCheckState(plan) === "all",
                mixed: raidCheckState(plan) === "some",
              })),
            ]}
            onToggle={(i) => {
              if (i === 0) {
                onChange(setCharacterCleared(character, nextCleared(characterCheckState(character))));
                return;
              }
              const plan = character.raids[i - 1];
              onChange({
                ...character,
                raids: character.raids.map((r, j) =>
                  j === i - 1 ? setRaidCleared(plan, nextCleared(raidCheckState(plan))) : r,
                ),
              });
            }}
          />
        </div>
      )}
      {character.raids.length > 1 && (
        <div className={styles.reorder}>
          {/* 사용자 지적 10-11 21:00: one word at a time, 순서 바꾸기 ↔ 완료,
              and the button keeps the wider word's width (both are laid out
              in one grid cell, the other one hidden). */}
          <button
            type="button"
            className={styles.reorderToggle}
            aria-expanded={arranging}
            onClick={() => setArranging((v) => !v)}
          >
            <span className={styles.swap}>
              <span aria-hidden={arranging || undefined} data-off={arranging || undefined}>
                순서 바꾸기
              </span>
              <span aria-hidden={!arranging || undefined} data-off={!arranging || undefined}>
                완료
              </span>
            </span>
          </button>
          {arranging && (
            <>
              <p className={styles.note}>끌거나, 줄을 고른 뒤 ↑↓(또는 Alt+↑↓)로 옮겨요.</p>
              {character.gold && (
                <p className={styles.legend}>
                  <span className={styles.legendDot} aria-hidden="true" />
                  주간 골드를 받는 레이드 — 위에서부터 캐릭터당 {GOLD_RAIDS_PER_CHARACTER}개
                </p>
              )}
              <div className={styles.arrange}>
                <Arrange
                  label={`${character.name} 레이드 순서`}
                  describe={(name, position, gold) =>
                    `${name}, ${position}번째${gold ? ", 골드 받음" : ""}`
                  }
                  items={character.raids.map((plan, index) => ({
                    id: plan.raidId,
                    name: `${raidName(plan.raidId)} ${DIFFICULTY_LABEL[plan.difficulty]}`,
                    mark: character.gold && index < GOLD_RAIDS_PER_CHARACTER,
                    tint: "var(--primary)",
                  }))}
                  onMove={(id, delta) => {
                    const from = character.raids.findIndex((r) => r.raidId === id);
                    move(from, from + delta);
                  }}
                  onReorder={(ids) => {
                    const raids = ids
                      .map((id) => character.raids.find((r) => r.raidId === id))
                      .filter((r): r is RaidPlan => !!r);
                    if (raids.length !== character.raids.length) return;
                    onChange({ ...character, raids });
                    setMoved("순서를 바꿨어요.");
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
      <ul className={styles.raids}>
        {character.raids.map((plan, index) => (
          <RaidRow
            key={plan.raidId}
            plan={plan}
            itemLevel={character.itemLevel}
            index={index}
            count={character.raids.length}
            onMove={(to) => move(index, to)}
            selected={selectedId === plan.raidId}
            onSelect={(on) => setSelectedId(on ? plan.raidId : null)}
            onChange={(next) =>
              onChange({ ...character, raids: character.raids.map((r, j) => (j === index ? next : r)) })
            }
            onRemove={() => onChange({ ...character, raids: character.raids.filter((_, j) => j !== index) })}
          />
        ))}
      </ul>
      {character.raids.length > GOLD_RAIDS_PER_CHARACTER && (
        <p className={styles.note}>
          골드는 위에서부터 {GOLD_RAIDS_PER_CHARACTER}개 레이드만 받아요. 순서는 화살표, 또는 &lsquo;선택&rsquo;을 누른 뒤
          ↑↓로 바꿔요(Esc로 끝).
        </p>
      )}
      <p className={styles.sr} role="status" aria-live="polite">
        {moved}
      </p>
      {options.length > 0 && (
        <div className={styles.addRaid}>
          <label htmlFor={selectId} className={styles.sr}>
            레이드 추가
          </label>
          <Select
            id={selectId}
            className={styles.select}
            value=""
            onValueChange={(picked) => {
              const [raidId, difficulty] = picked.split("|");
              const found = options.find((o) => o.raid.id === raidId && o.mode.difficulty === difficulty);
              if (!found) return;
              const plan: RaidPlan = {
                raidId,
                difficulty: found.mode.difficulty,
                cleared: found.mode.gates.map(() => false),
                more: found.mode.gates.map(() => false),
              };
              onChange({ ...character, raids: [...character.raids, plan] });
            }}
            items={[
              { value: "", label: "레이드 추가…", disabled: true },
              ...options.map(({ raid, mode }) => ({
                value: `${raid.id}|${mode.difficulty}`,
                label: `${raid.shortName} ${DIFFICULTY_LABEL[mode.difficulty]}${mode.status === "UNVERIFIED" ? " (골드 미확인)" : ""}`,
              })),
            ]}
          />
        </div>
      )}
    </section>
  );
}

export default function HomeworkTool() {
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState<HomeworkState>(() => load(Date.now()));

  // Tick once a minute: countdown, and the weekly reset when it passes.
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((s) => rollWeek(s, t));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [state]);

  const goldFull = state.characters.filter((c) => c.gold).length >= GOLD_CHARACTERS;
  const update = (index: number, next: Character) =>
    setState((s) => ({ ...s, characters: s.characters.map((c, j) => (j === index ? next : c)) }));

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#hw-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      {/* At least a screen tall, like the loading shell: the footer starts below
          the fold either way, so stored rosters arriving do not push it (390 CLS). */}
      <main id="hw-main" className={styles.main}>
        <section className={quote.hero} aria-labelledby="hw-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <TaskSquare size={18} />
          </span>
          <p className={quote.heroKicker}>내 진행</p>
          <h1 id="hw-heading">숙제 체크</h1>
          <p className={quote.heroCopy}>원정대 주간 레이드와 골드, 한 화면에서.</p>
          <Link href="/" className={quote.back}>
            <ArrowLeft size={14} aria-hidden="true" /> 홈으로
          </Link>
        </section>
        <div className={quote.band}>
          <div className={styles.workspace}>
            <Summary state={state} now={now} />
            <AddRoster onAdd={(picked) =>
              setState((s) =>
                addCharacters(
                  s,
                  picked.map((p) => ({
                    name: p.characterName,
                    server: p.serverName,
                    className: p.className,
                    itemLevel: p.itemLevel,
                  })),
                ),
              )
            } />
            {state.characters.length === 0 ? (
              <p className={styles.empty}>
                캐릭터 이름을 넣으면 원정대를 불러와요. 레벨에 맞는 레이드 3개를 골드가 많은
                순서로 넣어 드려요(자동 구성은 추정 — 공식 규칙이 아닌 기본값이라 바꿔도 돼요).
              </p>
            ) : (
              <div className={styles.grid}>
                {state.characters.map((character, index) => (
                  <CharacterCard
                    key={character.name}
                    character={character}
                    goldFull={goldFull}
                    onChange={(next) => update(index, next)}
                    onRemove={() =>
                      setState((s) => ({ ...s, characters: s.characters.filter((_, j) => j !== index) }))
                    }
                  />
                ))}
              </div>
            )}
            <p className={styles.footnote}>
              진행 상황은 이 브라우저에만 저장돼요. 매주 수요일 06:00에 체크가 풀려요. 골드는
              레이드 보상표의 공식 값으로 계산하고, 확인되지 않은 레이드는 &lsquo;데이터
              없음&rsquo;으로 둬요. 더보기 비용은 귀속 골드에서 먼저 빠지고, 골드를 받지 않는
              캐릭터의 더보기도 원정대 합계에서 빼요. 무료 더보기를 쓴 관문은 더보기 체크를
              하지 않으면 비용 없이 계산돼요. 자동 구성(레벨 높은 순 6명·레이드별 최대 골드
              난이도)은 추정이에요. <Link href="/tools/raid-rewards">레이드 보상표</Link>
            </p>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        LOAKraken · 브라우저 저장
      </footer>
    </div>
  );
}
