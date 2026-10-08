"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { LandingMotion, useLandingMotion } from "@/components/landing/motion";
import { InlineOrb } from "@/components/landing/orb";
import { CharacterQueryError, fetchCharacter } from "@/lib/character/client";
import { positionOf } from "@/lib/character/detail";
import {
  characterNameError,
  failureCopy,
  normalizeCharacterName,
  type QueryFailure,
} from "@/lib/character/model";
import { CharacterBanner } from "./imagery";
import { kstTime, level, number, text } from "./parts";
import { TabBar, TabPanel, tabOf } from "./tabs";
import styles from "./character.module.css";

function SearchBox({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const issue = characterNameError(value);
    setError(issue);
    setNotice("");
    if (issue) return;
    const normalized = normalizeCharacterName(value);
    if (normalized === name) {
      setNotice(
        "지금 보고 있는 캐릭터예요. 최신 정보는 '갱신'으로 확인해 주세요.",
      );
      return;
    }
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
            setNotice("");
          }}
          maxLength={65}
          placeholder="캐릭터 검색"
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
      <p className={styles.inputNotice} role="status">
        {notice}
      </p>
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
  const tab = tabOf(useSearchParams().get("tab"));
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
  const rateLimitSeconds = error?.retryAt
    ? Math.max(0, Math.ceil((error.retryAt - now) / 1000))
    : 0;
  const invalidName = !!characterNameError(name);
  // Tick every second while any countdown is visible (refresh cooldown or 429).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function refresh() {
    if (query.isFetching || rateLimitSeconds > 0 || invalidName) return;
    await query.refetch();
    setRefreshed(true);
    setNow(Date.now());
  }
  const position = data ? positionOf(data) : null;

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
        <nav className={styles.headerNav} aria-label="주요 메뉴">
          <Link href="/market">시세</Link>
          <Link href="/tools/material-quote">재료 견적</Link>
          <Link href="/tools/refining">재련 비용</Link>
          <Link href="/tools/crit-speed">치적·음돌</Link>
        </nav>
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
      <main id="character-main">
        {data && envelope ? (
          <>
            <CharacterBanner
              url={data.imageUrl}
              name={data.characterName}
              identity={
                <>
                  <p className={styles.bannerKicker}>
                    {data.serverName} · {data.className}
                  </p>
                  <h1 className={styles.bannerName}>{data.characterName}</h1>
                  {data.title && (
                    <p className={styles.bannerTitle}>{data.title}</p>
                  )}
                  <dl className={styles.bannerMetrics}>
                    <div>
                      <dt>아이템</dt>
                      <dd>{number(data.itemLevel)}</dd>
                    </div>
                    <div>
                      <dt>전투력</dt>
                      <dd data-position={position ?? undefined}>
                        {number(data.combatPower)}
                      </dd>
                    </div>
                    <div>
                      <dt>전투</dt>
                      <dd>{level(data.characterLevel)}</dd>
                    </div>
                    <div>
                      <dt>원정대</dt>
                      <dd>{level(data.expeditionLevel)}</dd>
                    </div>
                  </dl>
                </>
              }
              facts={
                <dl className={styles.bannerFacts}>
                  {position && (
                    <>
                      <dt>포지션</dt>
                      <dd data-position={position}>
                        {position === "SUPPORT" ? "서포터" : "딜러"}
                        {data.analysis.positionEvidence && (
                          <small className={styles.evidenceNote}>
                            {data.analysis.positionEvidence}
                          </small>
                        )}
                      </dd>
                    </>
                  )}
                  <dt>길드</dt>
                  <dd>
                    {text(data.guildName)}
                    {data.guildName && data.guildMemberGrade && (
                      <small className={styles.evidenceNote}>
                        {data.guildMemberGrade}
                      </small>
                    )}
                  </dd>
                  {data.townName && (
                    <>
                      <dt>영지</dt>
                      <dd>
                        {data.townName}
                        {data.townLevel != null && (
                          <small className={styles.evidenceNote}>
                            Lv.{data.townLevel}
                          </small>
                        )}
                      </dd>
                    </>
                  )}
                  {data.honorPoint != null && (
                    <>
                      <dt>명예</dt>
                      <dd>{number(data.honorPoint)}</dd>
                    </>
                  )}
                  <dt>칭호</dt>
                  <dd>{text(data.title)}</dd>
                  <dt>수집</dt>
                  <dd>
                    <time dateTime={data.fetchedAt}>
                      {kstTime(data.fetchedAt)}
                    </time>
                  </dd>
                </dl>
              }
            />
            <TabBar
              name={name}
              tab={tab}
              data={data}
              now={now}
              fetching={query.isFetching}
              rateLimitSeconds={rateLimitSeconds}
              onRefresh={refresh}
            />
            <div aria-live="polite" className={styles.queryStatus}>
              {query.isFetching
                ? "캐릭터 정보를 갱신하고 있어요. 기존 정보는 그대로 유지돼요."
                : refreshed && !error
                  ? "갱신이 완료됐어요."
                  : ""}
            </div>
            {copy && (
              <div className={styles.bandNotice} role="alert">
                <strong>{copy.title}</strong>
                <p>{copy.text} 마지막으로 조회한 정보를 표시하고 있어요.</p>
              </div>
            )}
            <TabPanel tab={tab} data={data} envelope={envelope} />
          </>
        ) : (
          <div className={styles.main}>
            <Link href="/#intro" className={styles.back}>
              <ArrowLeft size={14} /> 캐릭터 검색으로
            </Link>
            <div className={styles.hero} data-empty="">
              <div className={styles.identity}>
                <p className={styles.eyebrow}>CHARACTER OBSERVATION</p>
                <h1>{name || "캐릭터 조회"}</h1>
                <p>현재 상태부터, 다음 선택까지.</p>
              </div>
              {!invalidName && (
                <button
                  type="button"
                  className={styles.refresh}
                  onClick={refresh}
                  disabled={query.isFetching || rateLimitSeconds > 0}
                >
                  {query.isFetching ? <InlineOrb /> : <RefreshCw size={15} />}
                  {query.isFetching
                    ? "조회 중"
                    : rateLimitSeconds > 0
                      ? `${rateLimitSeconds}초 후 재조회`
                      : "다시 시도"}
                </button>
              )}
            </div>
            <div aria-live="polite" className={styles.queryStatus}>
              {query.isFetching ? "캐릭터 정보를 조회하고 있어요." : ""}
            </div>
            {copy && (
              <div className={styles.error} role="alert">
                <h2>{copy.title}</h2>
                <p>{copy.text}</p>
              </div>
            )}
            <div className={styles.noData}>
              <p>조회가 완료되면 장비와 세팅, 관측 근거를 함께 볼 수 있어요.</p>
              <Link href="/#preview">
                예시 화면 살펴보기 <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </main>
      <footer className={styles.footer}>
        LOAKraken · 로스트아크 비공식 팬 프로젝트 · 공식 전투정보실 데이터 기반
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
