"use client";

import { memo, useContext, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RefreshArrow, SearchNormal } from "@/components/ui/icons";
import { LandingMotion } from "@/components/landing/motion";
import { InlineOrb } from "@/components/landing/orb";
import { CharacterQueryError, fetchCharacter } from "@/lib/character/client";
import { positionOf } from "@/lib/character/detail";
import {
  characterNameError,
  failureCopy,
  normalizeCharacterName,
  type Character,
  type QueryFailure,
} from "@/lib/character/model";
import { SiteHeader } from "@/components/site/site-header";
import { recordRecent } from "@/lib/character/recent";
import { CharacterBanner } from "./imagery";
import { Entrance } from "./entrance";
import { kstTime, level, number, text } from "./parts";
import { SettingCheckEnabled, SimulatorEnabled, TabBar, TabPanel, tabOf, useTabTop } from "./tabs";
import { ArmoryPageEnabled } from "./use-armory-page";
import { ReceiptEnabled } from "./receipt-panel";
import styles from "./character.module.css";
import { RATE_LIMITED } from "@/lib/api/rate-limit";
import { RateLimitNote } from "@/components/site/rate-limit-note";

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
        <SearchNormal size={17} aria-hidden="true" />
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

/** Banner and facts: re-rendered only when the character data changes (not on clock ticks). */
const Banner = memo(function Banner({ data }: { data: Character }) {
  const position = positionOf(data);
  return (
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
                {/* Final value at once, no count-up (user, 23:17: the number "moved"). */}
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
          <dt>마지막 갱신</dt>
          <dd>
            <time dateTime={data.fetchedAt}>
              {kstTime(data.fetchedAt)}
            </time>
          </dd>
        </dl>
      }
    />
  );
});

function CharacterContent({
  name,
  initialError,
  renderedAt,
}: {
  name: string;
  initialError?: QueryFailure;
  renderedAt: number;
}) {
  const tab = tabOf(
    useSearchParams().get("tab"),
    useContext(SettingCheckEnabled),
    useContext(SimulatorEnabled),
  );
  useTabTop(tab);
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
  const limited = error?.code === RATE_LIMITED;
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
  // Remember successful searches for the home page's recent list (browser only).
  const seen = data
    ? {
        name: data.characterName,
        server: data.serverName,
        className: data.className,
        itemLevel: data.itemLevel,
        combatPower: data.combatPower,
      }
    : null;
  useEffect(() => {
    if (seen) recordRecent(seen);
    // Record once per character and refresh, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen?.name, seen?.itemLevel, seen?.combatPower]);

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#character-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader>
        <SearchBox name={name} />
      </SiteHeader>
      <main id="character-main">
        {data && envelope ? (
          <>
            <Banner data={data} />
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
              <div className={styles.bandNotice}>
                <div role="alert">
                  <strong>{copy.title}</strong>
                  <p>{copy.text} 마지막으로 조회한 정보를 표시하고 있어요.</p>
                </div>
                {limited && <RateLimitNote seconds={rateLimitSeconds} />}
              </div>
            )}
            <Entrance tab={tab}>
              <TabPanel tab={tab} data={data} envelope={envelope} />
            </Entrance>
          </>
        ) : (
          <div className={styles.main}>
            <Link href="/" className={styles.back}>
              <ArrowLeft size={14} /> 캐릭터 검색으로
            </Link>
            <div className={styles.hero} data-empty="">
              <div className={styles.identity}>
                <p className={styles.eyebrow}>캐릭터 정보</p>
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
                  {query.isFetching ? <InlineOrb /> : <RefreshArrow size={15} />}
                  {query.isFetching
                    ? "조회 중"
                    : rateLimitSeconds > 0
                      ? `${rateLimitSeconds}초 뒤 다시 조회`
                      : "다시 시도"}
                </button>
              )}
            </div>
            <div aria-live="polite" className={styles.queryStatus}>
              {query.isFetching ? "캐릭터 정보를 조회하고 있어요." : ""}
            </div>
            {copy && (
              <div className={styles.error}>
                <div role="alert">
                  <h2>{copy.title}</h2>
                  <p>{copy.text}</p>
                </div>
                {limited && <RateLimitNote seconds={rateLimitSeconds} />}
              </div>
            )}
            <div className={styles.noData}>
              <p>조회가 완료되면 장비와 세팅, 근거 데이터를 함께 볼 수 있어요.</p>
              <Link href="/about#preview">
                예시 화면 살펴보기 <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </main>
      <footer className={styles.footer}>
        공식 전투정보실 데이터 기반
      </footer>
    </div>
  );
}

export function CharacterView({
  receipt = true,
  settingCheck = true,
  simulator = true,
  armoryPage = true,
  ...props
}: {
  name: string;
  initialError?: QueryFailure;
  renderedAt: number;
  /** RECEIPT_TOOL on this deployment (server flag). */
  receipt?: boolean;
  /** SETTING_CHECK_TAB on this deployment (server flag). */
  settingCheck?: boolean;
  /** COMBAT_POWER_SIM on this deployment (server flag). */
  simulator?: boolean;
  /** ARMORY_PAGE on this deployment (server flag). */
  armoryPage?: boolean;
}) {
  return (
    <ReceiptEnabled.Provider value={receipt}>
      <SettingCheckEnabled.Provider value={settingCheck}>
        <SimulatorEnabled.Provider value={simulator}>
          <ArmoryPageEnabled.Provider value={armoryPage}>
            <LandingMotion>
              <CharacterContent {...props} />
            </LandingMotion>
          </ArmoryPageEnabled.Provider>
        </SimulatorEnabled.Provider>
      </SettingCheckEnabled.Provider>
    </ReceiptEnabled.Provider>
  );
}
