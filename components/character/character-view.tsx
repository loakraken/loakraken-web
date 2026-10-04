"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Pause,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  LandingMotion,
  Reveal,
  useLandingMotion,
} from "@/components/landing/motion";
import { InlineOrb } from "@/components/landing/orb";
import { CharacterQueryError, fetchCharacter } from "@/lib/character/client";
import {
  characterNameError,
  coverageLabels,
  emptyObservation,
  evidenceAt,
  failureCopy,
  normalizeCharacterName,
  safePortrait,
  type CharacterEnvelope,
  type CoverageSection,
  type CoverageState,
  type QueryFailure,
} from "@/lib/character/model";
import styles from "./character.module.css";

const number = (value: number | null | undefined) =>
  value == null
    ? "미제공"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const text = (value: string | null | undefined) => value || "미제공";
const sectionLinks = [
  ["diagnostics", "진단 근거"],
  ["equipment", "장비"],
  ["gems", "보석"],
  ["engravings", "각인"],
  ["cards", "카드"],
  ["passive", "아크패시브"],
  ["grid", "아크그리드"],
  ["siblings", "원정대"],
];
const collectionLabels: Record<string, string> = {
  items: "항목",
  effects: "효과",
  slots: "슬롯",
  arkPassiveEffects: "패시브 각인",
  points: "포인트",
};

function SearchBox({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const issue = characterNameError(value);
    setError(issue);
    if (issue) return;
    const normalized = normalizeCharacterName(value);
    if (normalized === name) return;
    setMoving(true);
    router.push(`/character/${encodeURIComponent(normalized)}`);
  }
  return (
    <div className={styles.searchWrap}>
      <form
        onSubmit={submit}
        noValidate
        className={styles.search}
        aria-busy={moving}
      >
        <Search size={17} aria-hidden="true" />
        <label className={styles.srOnly} htmlFor="detail-search">
          다른 캐릭터 이름
        </label>
        <input
          id="detail-search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          maxLength={65}
          placeholder="다른 캐릭터 검색"
          disabled={moving}
          aria-invalid={!!error}
          aria-describedby={error ? "detail-search-error" : undefined}
        />
        <button type="submit" disabled={moving} aria-label="캐릭터 검색">
          {moving ? <InlineOrb /> : <ArrowRight size={18} />}
        </button>
      </form>
      {error && (
        <p className={styles.inputError} id="detail-search-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  state,
  coverage,
  children,
}: {
  id: string;
  title: string;
  state: CoverageState;
  coverage?: CoverageSection;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.panel} aria-labelledby={`${id}-heading`}>
      <div className={styles.panelHeading}>
        <h2 id={`${id}-heading`}>{title}</h2>
        <span className={styles.coverage} data-state={state}>
          {coverageLabels[state]}
        </span>
      </div>
      {coverage && (
        <div className={styles.collections}>
          {Object.entries(coverage.collections).map(([key, value]) => (
            <span key={key}>
              {collectionLabels[key] ?? key} · {coverageLabels[value]}
            </span>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function Empty({ state }: { state: CoverageState }) {
  return <p className={styles.empty}>{emptyObservation(state)}</p>;
}

function Evidence({
  envelope,
  path,
}: {
  envelope: CharacterEnvelope;
  path: string;
}) {
  const evidence = evidenceAt(envelope, path);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const content = JSON.stringify(
    { path, found: evidence.found, value: evidence.value },
    null,
    2,
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setFailed(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <details className={styles.evidence}>
      <summary>관측 근거 보기</summary>
      <code>{path}</code>
      <pre>
        {evidence.found
          ? JSON.stringify(evidence.value, null, 2)
          : "현재 응답에서 해당 근거를 찾지 못했습니다."}
      </pre>
      <button type="button" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "복사됨" : "근거 복사"}
      </button>
      <span role="status" className={styles.copyStatus}>
        {failed ? "복사하지 못했어요. 근거를 직접 선택해 주세요." : ""}
      </span>
    </details>
  );
}

function Portrait({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const safe = safePortrait(url);
  return (
    <div className={styles.portrait}>
      {safe && !failed ? (
        // Official portraits have variable dimensions; do not proxy arbitrary image URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safe}
          alt={`${name} 캐릭터`}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

function CharacterContent({
  name,
  initialError,
  renderedAt,
}: {
  name: string;
  initialError?: QueryFailure;
  renderedAt: number;
}) {
  const { paused, toggle } = useLandingMotion();
  const [now, setNow] = useState(renderedAt);
  const [refreshed, setRefreshed] = useState(false);
  const query = useQuery({
    queryKey: ["character", name],
    queryFn: ({ signal }) => fetchCharacter(name, signal),
    enabled: false,
    retry: false,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const envelope = query.data;
  const data = envelope?.data;
  const error =
    query.error instanceof CharacterQueryError
      ? query.error.info
      : !refreshed
        ? initialError
        : undefined;
  const copy = error ? failureCopy(error) : null;
  const remaining = error?.retryAt
    ? Math.max(0, Math.ceil((error.retryAt - now) / 1000))
    : 0;
  const invalidName = !!characterNameError(name);
  const coolingDown = remaining > 0;
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      coolingDown ? 1000 : 30_000,
    );
    return () => clearInterval(timer);
  }, [coolingDown]);
  async function refresh() {
    if (query.isFetching || remaining > 0 || invalidName) return;
    await query.refetch();
    setRefreshed(true);
    setNow(Date.now());
  }
  const old = data ? now - Date.parse(data.fetchedAt) >= 300_000 : false;
  const time = data
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(data.fetchedAt))
    : "";

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#character-main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          LOAKraken
        </Link>
        <SearchBox name={name} />
        <button
          className={styles.motionButton}
          type="button"
          aria-label={paused ? "모션 재생" : "모션 일시정지"}
          aria-pressed={paused}
          onClick={toggle}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </header>
      <main id="character-main" className={styles.main}>
        <Link href="/#intro" className={styles.back}>
          <ArrowLeft size={14} /> 캐릭터 검색으로
        </Link>
        <div className={styles.hero}>
          {data && <Portrait url={data.imageUrl} name={data.characterName} />}
          <div className={styles.identity}>
            <p className={styles.eyebrow}>CHARACTER OBSERVATION</p>
            <h1>{(data?.characterName ?? name) || "캐릭터 조회"}</h1>
            <p>
              {data
                ? `${data.serverName} · ${data.className} · Lv. ${number(data.characterLevel)}`
                : "현재 상태부터, 다음 선택까지."}
            </p>
            {data?.title && <span className={styles.title}>{data.title}</span>}
          </div>
          {!invalidName && (
            <button
              type="button"
              className={styles.refresh}
              onClick={refresh}
              disabled={query.isFetching || remaining > 0}
            >
              {query.isFetching ? <InlineOrb /> : <RefreshCw size={15} />}
              {query.isFetching
                ? "조회 중"
                : remaining > 0
                  ? `${remaining}초 후 재조회`
                  : data
                    ? "다시 조회"
                    : "다시 시도"}
            </button>
          )}
        </div>
        <div aria-live="polite" className={styles.queryStatus}>
          {query.isFetching
            ? "캐릭터 정보를 조회하고 있습니다. 기존 데이터가 있다면 그대로 유지합니다."
            : refreshed && !error
              ? "조회가 완료됐습니다."
              : ""}
        </div>
        {copy && (
          <div className={styles.error} role="alert">
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
            {data && (
              <p>
                갱신에 실패해 마지막으로 조회한 정보를 표시합니다. 아래 수집
                시각을 확인해 주세요.
              </p>
            )}
          </div>
        )}
        {!data && (
          <div className={styles.noData}>
            <p>조회가 완료되면 장비와 세팅, 관측 근거를 함께 볼 수 있습니다.</p>
            <Link href="/#preview">
              예시 화면 살펴보기 <ArrowRight size={15} />
            </Link>
          </div>
        )}
        {data && envelope && (
          <>
            <div className={styles.timestamp}>
              <span>
                원천 수집 <time dateTime={data.fetchedAt}>{time} KST</time>
              </span>
              {old && <strong>수집 후 5분 이상 경과</strong>}
              <p>
                조회 시각과 게임 내 변경 시각은 다릅니다. 다시 조회해도 서버
                캐시가 남아 있으면 수집 시각은 유지됩니다.
              </p>
            </div>
            <Reveal className={styles.metrics}>
              <div>
                <span>아이템 레벨</span>
                <strong>{number(data.itemLevel)}</strong>
              </div>
              <div>
                <span>전투력</span>
                <strong>{number(data.combatPower)}</strong>
              </div>
              <div>
                <span>원정대 레벨</span>
                <strong>{number(data.expeditionLevel)}</strong>
              </div>
              <div>
                <span>길드</span>
                <strong>{text(data.guildName)}</strong>
              </div>
            </Reveal>
            <nav className={styles.sectionNav} aria-label="캐릭터 정보 영역">
              {sectionLinks.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </nav>
            <section
              id="diagnostics"
              className={styles.diagnostics}
              aria-labelledby="diagnostics-heading"
            >
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>확인할 수 있는 근거</p>
                  <h2 id="diagnostics-heading">관측에서 발견한 내용</h2>
                </div>
                <span className={styles.rule}>
                  {data.analysis.diagnostics.ruleVersion}
                </span>
              </div>
              <p className={styles.explanation}>
                정보 부족은 세팅 오류를 뜻하지 않습니다. 확인 항목 역시 의도한
                세팅일 수 있습니다.
              </p>
              {data.analysis.diagnostics.findings.length === 0 ? (
                <p className={styles.empty}>
                  현재 규칙에서 발견된 확인 항목이 없습니다. 모든 세팅이
                  완성됐다는 의미는 아닙니다.
                </p>
              ) : (
                <div className={styles.findings}>
                  {data.analysis.diagnostics.findings.map((finding, index) => (
                    <article
                      key={`${finding.code}-${index}`}
                      className={styles.finding}
                    >
                      <span
                        className={styles.findingCategory}
                        data-category={finding.category}
                      >
                        {finding.category === "DATA_GAP"
                          ? "정보 부족"
                          : finding.category === "SETTING_CHECK"
                            ? "세팅 확인"
                            : "관측 안내"}
                      </span>
                      <p>{finding.message}</p>
                      {finding.observedCount !== null && (
                        <span className={styles.count}>
                          관측 개수 {number(finding.observedCount)}
                        </span>
                      )}
                      <Evidence
                        envelope={envelope}
                        path={finding.evidencePath}
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
            {data.stats.length > 0 && (
              <section className={styles.stats} aria-label="캐릭터 능력치">
                {data.stats.map((stat, i) => (
                  <div key={i}>
                    <span>{text(stat.type)}</span>
                    <strong>{text(stat.value)}</strong>
                  </div>
                ))}
              </section>
            )}
            <div className={styles.grid}>
              <Section
                id="equipment"
                title="장비"
                state={data.coverage.equipment}
              >
                <p className={styles.summary}>
                  관측 장비 {number(data.analysis.equipmentCount)}개
                </p>
                {data.loadout.equipment.length ? (
                  <ul className={styles.rows}>
                    {data.loadout.equipment.map((item, i) => (
                      <li key={i}>
                        <span>{text(item.type)}</span>
                        <div>
                          <strong>{text(item.name)}</strong>
                          <small>{text(item.grade)}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty state={data.coverage.equipment} />
                )}
              </Section>
              <Section
                id="gems"
                title="보석"
                state={data.coverage.gems.state}
                coverage={data.coverage.gems}
              >
                {data.analysis.gems && (
                  <p className={styles.summary}>
                    관측 {number(data.analysis.gems.count)}개 · 확인된 평균 Lv.{" "}
                    {number(data.analysis.gems.averageLevel)}
                    {data.analysis.gems.unknownLevelCount > 0 &&
                      ` · 레벨 미확인 ${data.analysis.gems.unknownLevelCount}개`}
                  </p>
                )}
                {data.loadout.gems?.items.length ? (
                  <ul className={styles.rows}>
                    {data.loadout.gems.items.map((item, i) => (
                      <li key={i}>
                        <span>
                          {item.level != null && item.level > 0
                            ? `Lv. ${item.level}`
                            : "레벨 미확인"}
                        </span>
                        <div>
                          <strong>{text(item.name)}</strong>
                          <small>
                            {text(item.grade)} · 슬롯 {number(item.slot)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty state={data.coverage.gems.collections.items} />
                )}
                {data.loadout.gems?.effects && (
                  <details className={styles.more}>
                    <summary>보석 효과와 연결 스킬</summary>
                    <p>{text(data.loadout.gems.effects.description)}</p>
                    {data.loadout.gems.effects.skills.map((skill, i) => (
                      <div key={i}>
                        <h3>{text(skill.name)}</h3>
                        <p>
                          슬롯 {number(skill.gemSlot)} · {text(skill.option)}
                        </p>
                        {skill.description.map((line, j) => (
                          <p key={j}>{line}</p>
                        ))}
                      </div>
                    ))}
                  </details>
                )}
              </Section>
              <Section
                id="engravings"
                title="각인"
                state={data.coverage.engravings.state}
                coverage={data.coverage.engravings}
              >
                {data.loadout.engravings ? (
                  <>
                    <h3 className={styles.subheading}>장착 슬롯</h3>
                    {data.loadout.engravings.slots.length ? (
                      <ul className={styles.rows}>
                        {data.loadout.engravings.slots.map((item, i) => (
                          <li key={i}>
                            <span>슬롯 {number(item.slot)}</span>
                            <strong>{text(item.name)}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty
                        state={data.coverage.engravings.collections.slots}
                      />
                    )}
                    <h3 className={styles.subheading}>아크패시브 각인</h3>
                    {data.loadout.engravings.arkPassiveEffects.length ? (
                      <ul className={styles.descriptions}>
                        {data.loadout.engravings.arkPassiveEffects.map(
                          (item, i) => (
                            <li key={i}>
                              <strong>
                                {text(item.name)} · Lv. {number(item.level)}
                              </strong>
                              <small>
                                {text(item.grade)} · 어빌리티 스톤 Lv.{" "}
                                {number(item.abilityStoneLevel)}
                              </small>
                              <p>{text(item.description)}</p>
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <Empty
                        state={
                          data.coverage.engravings.collections.arkPassiveEffects
                        }
                      />
                    )}
                    <h3 className={styles.subheading}>기존 각인 효과</h3>
                    {data.loadout.engravings.effects.length ? (
                      <ul className={styles.descriptions}>
                        {data.loadout.engravings.effects.map((item, i) => (
                          <li key={i}>
                            <strong>{text(item.name)}</strong>
                            <p>{text(item.description)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty
                        state={data.coverage.engravings.collections.effects}
                      />
                    )}
                  </>
                ) : (
                  <Empty state={data.coverage.engravings.state} />
                )}
              </Section>
              <Section
                id="cards"
                title="카드"
                state={data.coverage.cards.state}
                coverage={data.coverage.cards}
              >
                {data.analysis.cards && (
                  <p className={styles.summary}>
                    관측 {number(data.analysis.cards.count)}개 · 확인된 각성 합{" "}
                    {number(data.analysis.cards.knownAwakeningTotal)}
                    {data.analysis.cards.unknownAwakeningCount > 0 &&
                      ` · 각성 미확인 ${data.analysis.cards.unknownAwakeningCount}개`}
                  </p>
                )}
                {data.loadout.cards?.items.length ? (
                  <ul className={styles.rows}>
                    {data.loadout.cards.items.map((item, i) => (
                      <li key={i}>
                        <span>
                          {item.awakeCount == null || item.awakeCount < 0
                            ? "각성 미확인"
                            : `${item.awakeCount}각성`}
                        </span>
                        <div>
                          <strong>{text(item.name)}</strong>
                          <small>{text(item.grade)}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty state={data.coverage.cards.collections.items} />
                )}
                {data.loadout.cards && (
                  <>
                    <h3 className={styles.subheading}>세트 효과</h3>
                    {data.loadout.cards.effects.length ? (
                      data.loadout.cards.effects.map((set, i) => (
                        <div key={i} className={styles.effect}>
                          {set.items.map((item, j) => (
                            <div key={j}>
                              <strong>{text(item.name)}</strong>
                              <p>{text(item.description)}</p>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <Empty state={data.coverage.cards.collections.effects} />
                    )}
                  </>
                )}
              </Section>
              <Section
                id="passive"
                title="아크패시브"
                state={data.coverage.arkPassive.state}
                coverage={data.coverage.arkPassive}
              >
                {data.loadout.arkPassive ? (
                  <>
                    <p className={styles.summary}>
                      활성 상태 ·{" "}
                      {data.loadout.arkPassive.enabled === null
                        ? "미확인"
                        : data.loadout.arkPassive.enabled
                          ? "활성"
                          : "비활성"}
                    </p>
                    {data.loadout.arkPassive.points.length ? (
                      <div className={styles.points}>
                        {data.loadout.arkPassive.points.map((point, i) => (
                          <div key={i}>
                            <span>{text(point.name)}</span>
                            <strong>
                              {point.value == null
                                ? "미확인"
                                : number(point.value)}
                            </strong>
                            {point.description && (
                              <small>{point.description}</small>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        state={data.coverage.arkPassive.collections.points}
                      />
                    )}
                    <h3 className={styles.subheading}>패시브 효과</h3>
                    {data.loadout.arkPassive.effects.length ? (
                      <ul className={styles.descriptions}>
                        {data.loadout.arkPassive.effects.map((item, i) => (
                          <li key={i}>
                            <strong>{text(item.name)}</strong>
                            <p>{text(item.description)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty
                        state={data.coverage.arkPassive.collections.effects}
                      />
                    )}
                  </>
                ) : (
                  <Empty state={data.coverage.arkPassive.state} />
                )}
              </Section>
              <Section
                id="grid"
                title="아크그리드"
                state={data.coverage.arkGrid.state}
                coverage={data.coverage.arkGrid}
              >
                {data.analysis.arkGrid && (
                  <p className={styles.summary}>
                    코어 {number(data.analysis.arkGrid.coreCount)}개 · 활성 젬{" "}
                    {number(data.analysis.arkGrid.activeGemCount)} · 비활성{" "}
                    {number(data.analysis.arkGrid.inactiveGemCount)} · 미확인{" "}
                    {number(data.analysis.arkGrid.unknownGemCount)}
                  </p>
                )}
                {data.loadout.arkGrid?.slots.length ? (
                  <ul className={styles.descriptions}>
                    {data.loadout.arkGrid.slots.map((slot, i) => (
                      <li key={i}>
                        <strong>
                          {text(slot.name)} · {number(slot.point)}P
                        </strong>
                        <small>{text(slot.grade)}</small>
                        <div className={styles.gems}>
                          {slot.gems.map((gem, j) => (
                            <span key={j}>
                              젬 {number(gem.index)} ·{" "}
                              {gem.active === null
                                ? "미확인"
                                : gem.active
                                  ? "활성"
                                  : "비활성"}{" "}
                              · {text(gem.grade)}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty state={data.coverage.arkGrid.collections.slots} />
                )}
                {data.loadout.arkGrid && (
                  <>
                    <h3 className={styles.subheading}>그리드 효과</h3>
                    {data.loadout.arkGrid.effects.length ? (
                      <ul className={styles.rows}>
                        {data.loadout.arkGrid.effects.map((effect, i) => (
                          <li key={i}>
                            <strong>{text(effect.name)}</strong>
                            <span>Lv. {number(effect.level)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty
                        state={data.coverage.arkGrid.collections.effects}
                      />
                    )}
                  </>
                )}
              </Section>
            </div>
            <Section
              id="siblings"
              title="원정대 캐릭터"
              state={data.coverage.siblings}
            >
              <p className={styles.explanation}>
                서버를 제한하지 않은 원정대 조회 결과입니다.
              </p>
              {data.siblings.length ? (
                <ul className={styles.siblings}>
                  {data.siblings.map((sibling, i) => (
                    <li
                      key={`${sibling.serverName}-${sibling.characterName}-${i}`}
                    >
                      <div>
                        <strong>{sibling.characterName}</strong>
                        <p>
                          {sibling.serverName} · {sibling.className} · 아이템
                          Lv. {number(sibling.itemLevel)}
                        </p>
                      </div>
                      {!characterNameError(sibling.characterName) && (
                        <Link
                          prefetch={false}
                          href={`/character/${encodeURIComponent(normalizeCharacterName(sibling.characterName))}`}
                          aria-label={`${sibling.characterName} 관측하기`}
                        >
                          <ArrowRight size={18} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty state={data.coverage.siblings} />
              )}
            </Section>
            <p className={styles.disclaimer}>
              이 화면은 관측값과 확인 근거를 제공합니다. Kraken Score·DPS·레이드
              적합성·성장 비용은 아직 계산하지 않습니다.
            </p>
          </>
        )}
      </main>
      <footer className={styles.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트
      </footer>
    </div>
  );
}

export function CharacterView(props: {
  name: string;
  initialError?: QueryFailure;
  renderedAt: number;
}) {
  return (
    <LandingMotion>
      <CharacterContent {...props} />
    </LandingMotion>
  );
}
