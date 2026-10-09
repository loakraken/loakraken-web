"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ListChecks, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { CharacterQueryError, fetchSiblings } from "@/lib/character/client";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import {
  GOLD_CHARACTERS,
  GOLD_RAIDS_PER_CHARACTER,
  STORAGE_KEY,
  addCharacters,
  characterGold,
  eligibleModes,
  formatCountdown,
  modeOf,
  nextReset,
  parseState,
  rollWeek,
  rosterSummary,
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

function Summary({ state, now }: { state: HomeworkState; now: number }) {
  const s = rosterSummary(state);
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
        </div>
        <div>
          <dt>주간 초기화까지</dt>
          <dd>{formatCountdown(nextReset(now) - now)}</dd>
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
            <Plus size={16} aria-hidden="true" /> {picked.size}명 추가
          </button>
        </fieldset>
      )}
    </section>
  );
}

function RaidRow({
  plan,
  onChange,
  onRemove,
}: {
  plan: RaidPlan;
  onChange: (plan: RaidPlan) => void;
  onRemove: () => void;
}) {
  const mode = modeOf(plan);
  if (!mode) return null;
  const title = `${raidName(plan.raidId)} ${DIFFICULTY_LABEL[plan.difficulty]}`;
  const toggle = (key: "cleared" | "more", i: number) =>
    onChange({ ...plan, [key]: plan[key].map((v, j) => (j === i ? !v : v)) });
  return (
    <li className={styles.raid}>
      <div className={styles.raidHead}>
        <strong>{title}</strong>
        <button type="button" className={styles.iconButton} onClick={onRemove} aria-label={`${title} 빼기`}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
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
  const used = new Set(character.raids.map((r) => r.raidId));
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
          className={styles.iconButton}
          onClick={onRemove}
          aria-label={`${character.name} 빼기`}
        >
          <Trash2 size={16} aria-hidden="true" />
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
      <ul className={styles.raids}>
        {character.raids.map((plan, index) => (
          <RaidRow
            key={plan.raidId}
            plan={plan}
            onChange={(next) =>
              onChange({ ...character, raids: character.raids.map((r, j) => (j === index ? next : r)) })
            }
            onRemove={() => onChange({ ...character, raids: character.raids.filter((_, j) => j !== index) })}
          />
        ))}
      </ul>
      {character.raids.length > GOLD_RAIDS_PER_CHARACTER && (
        <p className={styles.note}>
          골드는 위에서부터 {GOLD_RAIDS_PER_CHARACTER}개 레이드만 받아요.
        </p>
      )}
      {options.length > 0 && (
        <div className={styles.addRaid}>
          <label htmlFor={selectId} className={styles.sr}>
            레이드 추가
          </label>
          <select
            id={selectId}
            className={styles.select}
            value=""
            onChange={(e) => {
              const [raidId, difficulty] = e.target.value.split("|");
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
          >
            <option value="">레이드 추가…</option>
            {options.map(({ raid, mode }) => (
              <option key={`${raid.id}|${mode.difficulty}`} value={`${raid.id}|${mode.difficulty}`}>
                {raid.shortName} {DIFFICULTY_LABEL[mode.difficulty]}
                {mode.status === "UNVERIFIED" ? " (골드 미확인)" : ""}
              </option>
            ))}
          </select>
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
      <main id="hw-main">
        <section className={quote.hero} aria-labelledby="hw-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <ListChecks size={18} />
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
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 브라우저 저장
      </footer>
    </div>
  );
}
