"use client";

// (ours, M49 phase 2, web #1969) 젬 가공 순위, behind GEM_RANKING (paired with the api's switch, order api → web): for
// each ark grid gem worn, the ways to process a new gem and swap it in, as the api ranks them (gem-ranking #1095).
// Computed on a press (a heavy server solve with seats: 429 GEM_RANKING_BUSY). The 초기화권 price and the gold of one
// 페온 are the viewer's own (no default: none on the market, PM 총괄 11-22); the gem price is the api's market cache.
import { createContext, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CombatPowerQueryError, postGemRanking } from "@/lib/combat-power/client";
import {
  GEM_GRADES,
  gainText,
  gemRankingFailureCopy,
  gemsText,
  goldText,
  groupByGem,
  missingText,
  pheonField,
  probabilityText,
  rankingRequest,
  resetTicketField,
  wayText,
  type GemGrade,
  type GemRankingRequest,
  type GemRankingRow,
} from "@/lib/combat-power/gem-processing";
import { retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import styles from "./gem-processing-ranking.module.css";

/** GEM_RANKING on this deployment (server flag), provided by the tool page and the character page. */
export const GemRankingEnabled = createContext(false);

const effectsText = (effects: readonly { name: string; level: number }[]) =>
  effects.map((e) => `${e.name} ${e.level}`).join(" · ");

function Way({ row }: { row: GemRankingRow }) {
  return (
    <div className={styles.way}>
      <p className={styles.wayHead}>
        <b>{row.gemType}</b> 젬으로 · {wayText(row)}
      </p>
      <dl className={styles.figures}>
        <div>
          <dt>성공 확률</dt>
          <dd>{probabilityText(row.successProbability)}</dd>
        </div>
        <div>
          <dt>기대 젬 수</dt>
          <dd>{gemsText(row.expectedGems)}개</dd>
        </div>
        <div>
          <dt>성공하면 전투력</dt>
          <dd>{gainText(row.expectedGainPct)}</dd>
        </div>
        <div>
          <dt>기대 비용</dt>
          <dd>{row.expectedCost ? goldText(row.expectedCost.total) : "—"}</dd>
        </div>
        <div>
          <dt>1%당 골드</dt>
          <dd>{row.goldPerPercent != null ? goldText(row.goldPerPercent) : "—"}</dd>
        </div>
      </dl>
      {row.expectedCost == null && row.missingPrices.length > 0 && (
        <p className={styles.missing}>비용 계산에 필요한 값: {missingText(row.missingPrices)}</p>
      )}
    </div>
  );
}

export function GemProcessingRanking({ name, fetchedAt }: { name: string; fetchedAt: string }) {
  const id = useId();
  const [grade, setGrade] = useState<GemGrade>("HERO");
  const [resetText, setResetText] = useState("");
  const [pheonText, setPheonText] = useState("");
  const reset = resetTicketField(resetText);
  const pheon = pheonField(pheonText);
  const invalid = reset.invalid || pheon.invalid;
  // The request asked for (null until the first press): a new press with the same inputs is the same answer.
  const [asked, setAsked] = useState<GemRankingRequest | null>(null);
  const query = useQuery({
    queryKey: ["gem-ranking", name, fetchedAt, asked],
    queryFn: ({ signal }) => postGemRanking(asked!, signal),
    enabled: asked != null,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const limit = useRateLimit(query.error);
  const busy = query.isFetching;
  const blocked = busy || limit.seconds > 0 || invalid;
  const failure =
    query.error instanceof CombatPowerQueryError ? query.error.info : query.error ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const data = query.data?.data;
  const groups = data?.status === "OK" ? groupByGem(data.rows) : [];

  function press() {
    if (blocked) return;
    const next = rankingRequest(name, grade, reset.value, pheon.value);
    if (JSON.stringify(next) === JSON.stringify(asked) && query.isError) void query.refetch();
    else setAsked(next);
  }

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`} aria-busy={busy || undefined}>
      <h2 id={`${id}-title`} className={styles.title}>
        젬 가공 순위
      </h2>
      <p className={styles.lead}>
        지금 낀 젬마다, 새 젬을 가공해 바꾸면 전투력이 오를 확률과 기대 비용이 적은 방법부터 보여 줘요.
      </p>
      <div className={styles.inputs}>
        <SegmentedControl
          className={styles.grade}
          aria-label="가공할 젬 등급"
          value={grade}
          onValueChange={(value) => setGrade(value as GemGrade)}
        >
          {GEM_GRADES.map((g) => (
            <SegmentedItem key={g.value} value={g.value}>
              {g.label}
            </SegmentedItem>
          ))}
        </SegmentedControl>
        <label className={styles.field}>
          <span>초기화권 가격(골드)</span>
          <input
            inputMode="numeric"
            placeholder="넣으면 초기화도 계산"
            value={resetText}
            aria-invalid={reset.invalid || undefined}
            onChange={(event) => setResetText(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>페온 1개 골드</span>
          <input
            inputMode="numeric"
            placeholder="넣으면 비용 계산"
            value={pheonText}
            aria-invalid={pheon.invalid || undefined}
            onChange={(event) => setPheonText(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={`${styles.press} hit-44`}
          aria-disabled={blocked || undefined}
          aria-busy={busy || undefined}
          onClick={press}
        >
          {busy ? "계산하는 중…" : retryLabel(limit.seconds, "순위 계산")}
        </button>
      </div>
      {/* One line, always there: what is wrong with the typed prices (A7). */}
      <p className={styles.hint} role="status">
        {invalid ? "초기화권은 1,000만, 페온은 10만 골드까지 숫자만 넣어 주세요." : ""}
      </p>
      {failure && (
        <div className={styles.failure} role="alert">
          <strong>{gemRankingFailureCopy(failure).title}</strong>
          <p>{gemRankingFailureCopy(failure).text}</p>
        </div>
      )}
      {data && data.status !== "OK" && <p className={styles.note}>{data.basis ?? "이 캐릭터는 젬 가공 순위를 계산하지 않아요."}</p>}
      {data?.status === "OK" && (
        <div data-stale={busy || undefined}>
          {groups.length === 0 ? (
            <p className={styles.note}>전투력이 오를 가공 방법을 찾지 못했어요.</p>
          ) : (
            <ol className={styles.groups} aria-label="젬마다 가장 좋은 가공 방법">
              {groups.map((group) => (
                <li key={group.key} className={styles.group}>
                  <p className={styles.gemHead}>
                    <b>
                      {group.coreName.replace(/^.*:\s*/, "")} 젬 {group.gemIndex + 1}
                    </b>
                    <small>
                      지금 {group.current.type} {group.current.point}P · {effectsText(group.current.effects)}
                    </small>
                  </p>
                  <Way row={group.best} />
                  {group.others.length > 0 && (
                    <details className={styles.others}>
                      <summary className="hit-44">다른 방법 {group.others.length}개</summary>
                      {group.others.map((row) => (
                        <Way key={`${row.gemType}-${row.policy}-${row.reset}`} row={row} />
                      ))}
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
          <ul className={styles.assumptions}>
            {data.assumptions.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
