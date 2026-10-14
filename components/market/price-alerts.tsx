"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/site-header";
import { Notification } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { useTallest } from "@/components/ui/use-tallest";
import {
  AlertQueryError,
  addCondition,
  deleteCondition,
  fetchAlertItems,
  fetchConditions,
  forget,
  pushSupported,
  readOwned,
  turnOff,
  turnOn,
  type Owned,
} from "@/lib/alerts/client";
import { MAX_CONDITIONS, alertErrorText, conditionText, type AlertCondition, type Comparator } from "@/lib/alerts/model";
import quote from "@/components/tools/material-quote.module.css";
import stats from "@/components/stats/stats.module.css";
import styles from "./price-alerts.module.css";

const gold = (value: number | null | undefined) =>
  value == null ? "매물 없음" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}G`;
const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const codeOf = (error: unknown) => (error instanceof AlertQueryError ? error.info.code : undefined);

type Stage = "checking" | "unsupported" | "off" | "on";

/**
 * 시세 알림 (M33): pick an item the board refreshes every minute, a line
 * (at or below / at or above) and a price; this browser gets a notification
 * when the lowest listing crosses it. No login: the subscription and its
 * manage token live in this browser only. The page reads the same before and
 * after the browser check (the status box keeps one height), so nothing moves
 * (A6·A7).
 */
export function PriceAlertsView() {
  const [stage, setStage] = useState<Stage>("checking");
  const [own, setOwn] = useState<Owned | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Browser-only facts: read after the first paint, into a box of fixed height.
    const stored = readOwned();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwn(stored);
    setStage(!pushSupported() ? "unsupported" : stored ? "on" : "off");
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    const result = await turnOn();
    setBusy(false);
    if (result.ok) {
      setOwn(result.own);
      setStage("on");
    } else if (result.reason === "denied")
      setMessage("알림 권한이 꺼져 있어요. 사이트 설정에서 알림을 허용해 주세요.");
    else if (result.reason === "unsupported") setStage("unsupported");
    else setMessage(alertErrorText(result.code));
  }

  async function disable() {
    if (!own) return;
    setBusy(true);
    setMessage(null);
    try {
      await turnOff(own);
      setOwn(null);
      setStage("off");
      setMessage("알림을 껐어요. 구독과 알림 조건을 모두 지웠어요.");
    } catch (error) {
      setMessage(alertErrorText(codeOf(error)));
    } finally {
      setBusy(false);
    }
  }

  /** The backend no longer knows this browser's subscription (cleaned up after a day without alerts, or turned off elsewhere). */
  function expired() {
    forget();
    setOwn(null);
    setStage("off");
    setMessage("알림 구독이 만료됐어요. 알림을 다시 켜 주세요.");
  }

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#alerts-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="alerts-main" className={stats.main}>
        <section className={quote.hero} aria-labelledby="alerts-heading">
          <span className={quote.heroIcon} aria-hidden="true">
            <Notification size={18} />
          </span>
          <p className={quote.heroKicker}>거래소</p>
          <h1 id="alerts-heading">시세 알림</h1>
          <p className={quote.heroCopy}>
            품목의 판매 최저가가 정한 가격 이하나 이상이 되면 이 브라우저로 알림을 보내요. 로그인은 필요 없어요.
          </p>
        </section>

        <section className={styles.status} aria-labelledby="alerts-status" aria-busy={stage === "checking" || undefined}>
          <h2 id="alerts-status" className={stats.srOnly}>
            알림 상태
          </h2>
          {/* Every stage: a lead of two lines at most, a 44px row, the message line — one height (A6). */}
          {stage === "unsupported" ? (
            <>
              <p className={styles.lead}>이 브라우저는 알림을 받을 수 없어요. 아이폰은 홈 화면에 추가한 앱에서 켜 주세요.</p>
              <span className={styles.buttonRoom} aria-hidden="true" />
            </>
          ) : stage === "on" ? (
            <>
              <p className={styles.lead}>
                <b>이 브라우저로 알림을 받고 있어요.</b> 다른 브라우저는 따로 켜 주세요.
              </p>
              <button type="button" className={styles.secondary} onClick={disable} disabled={busy}>
                알림 끄기
              </button>
            </>
          ) : (
            <>
              <p className={styles.lead}>켜면 브라우저가 알림 권한을 묻고, 확인 알림이 한 번 와요.</p>
              <button type="button" className={styles.primary} onClick={enable} disabled={busy || stage === "checking"} aria-busy={busy || undefined}>
                이 브라우저에서 알림 켜기
              </button>
            </>
          )}
          <p className={styles.message} role="status">
            {message ?? " "}
          </p>
        </section>

        {/* There from the first paint, on or off: turning alerts on fills them in place. */}
        {/* Keyed by the subscription: removed rows belong to the one they were removed from. */}
        <Conditions key={stage === "on" ? own?.subscriptionId : "off"} own={stage === "on" ? own : null} onExpired={expired} />

        <p className={styles.privacy}>
          알림을 켜면 이 브라우저의 푸시 구독 정보와 알림 조건만 보관해요. 이름·이메일·계정은 받지 않고, 접속 IP 주소도 이
          기능을 위해 저장하지 않아요. 알림을 끄면 바로 지우고, 90일 동안 쓰지 않으면 자동으로 지워요. 알림은 브라우저 회사의
          푸시 서비스를 거쳐 암호화된 채 전달돼요.{" "}
          <Link href="/privacy">개인정보 처리방침</Link>
        </p>
      </main>
    </div>
  );
}

function Conditions({ own, onExpired }: { own: Owned | null; onExpired: () => void }) {
  const client = useQueryClient();
  const key = ["alerts", "conditions", own?.subscriptionId ?? null];
  const conditions = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchConditions(own!, signal),
    enabled: own != null,
    retry: false,
    refetchInterval: 60_000,
  });
  const items = useQuery({
    queryKey: ["alerts", "items"],
    queryFn: ({ signal }) => fetchAlertItems(signal),
    staleTime: 60_000,
    retry: false,
  });
  const lost = codeOf(conditions.error) === "ALERT_SUBSCRIPTION_NOT_FOUND";
  useEffect(() => {
    if (lost) onExpired();
  }, [lost, onExpired]);
  const list = own ? (conditions.data?.data ?? []) : [];
  // A removed alert keeps its row (read as removed) until the page is opened
  // again, so the rows under it do not move up into its place (A7).
  const [gone, setGone] = useState<{ condition: AlertCondition; index: number }[]>([]);
  const remove = useMutation({
    mutationFn: (conditionId: string) => deleteCondition(own!, conditionId),
    onSuccess: (_, conditionId) => {
      const index = rows.findIndex((row) => row.condition.conditionId === conditionId);
      const condition = rows[index]?.condition;
      if (condition) setGone((before) => [...before, { condition, index }]);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  const live = new Set(list.map((condition) => condition.conditionId));
  const rows: { condition: AlertCondition; gone: boolean }[] = list.map((condition) => ({ condition, gone: false }));
  for (const ghost of [...gone].sort((a, b) => a.index - b.index))
    if (!live.has(ghost.condition.conditionId)) rows.splice(Math.min(ghost.index, rows.length), 0, { condition: ghost.condition, gone: true });
  // The list keeps its tallest height: removing one does not pull up what is under it (A7).
  const [listRef, listHeight] = useTallest();

  return (
    <>
      <AddCondition
        own={own}
        items={items.data?.data ?? null}
        itemsFailed={items.isError}
        full={list.length >= MAX_CONDITIONS}
        onAdded={() => client.invalidateQueries({ queryKey: key })}
        onExpired={onExpired}
      />
      <section className={styles.list} aria-labelledby="alerts-list">
        <h2 id="alerts-list">
          내 알림 <small>{own && conditions.data ? `${list.length} / ${MAX_CONDITIONS}` : " "}</small>
        </h2>
        <div ref={listRef} className={styles.listBody} style={listHeight ? { minHeight: listHeight } : undefined}>
          {!own ? (
            <p className={styles.muted}>알림을 켜면 건 알림이 여기에 보여요.</p>
          ) : conditions.isPending ? (
            <p className={styles.muted}>알림을 불러오고 있어요…</p>
          ) : conditions.isError && !lost ? (
            <p className={styles.muted}>{alertErrorText(codeOf(conditions.error))}</p>
          ) : rows.length === 0 ? (
            <p className={styles.muted}>아직 건 알림이 없어요. 위에서 품목과 가격을 골라 추가해 주세요.</p>
          ) : (
            <ul className={styles.conditions}>
              {rows.map(({ condition, gone: removed }) => (
                <ConditionRow
                  key={condition.conditionId}
                  condition={condition}
                  removed={removed}
                  removing={remove.isPending && remove.variables === condition.conditionId}
                  onRemove={() => remove.mutate(condition.conditionId)}
                />
              ))}
            </ul>
          )}
        </div>
        <p className={styles.message} role="status">
          {remove.isError ? alertErrorText(codeOf(remove.error)) : " "}
        </p>
        <p className={styles.note}>
          가격이 기준을 넘는 순간 한 번 알려요. 걸 때 이미 맞는 알림(지금 맞음)은 벗어났다가 다시 맞을 때 보내고, 같은 알림은
          6시간 안에 다시 보내지 않아요.
        </p>
      </section>
    </>
  );
}

function ConditionRow({
  condition,
  removed,
  removing,
  onRemove,
}: {
  condition: AlertCondition;
  removed: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  if (removed)
    return (
      <li data-removed>
        <div className={styles.rowMain}>
          <strong>{condition.itemName}</strong>
          <span className={styles.line}>{conditionText(condition.comparator, condition.price)}</span>
        </div>
        <p className={styles.rowFacts}>지운 알림이에요. 더 보내지 않아요.</p>
        <span className={styles.removedTag}>지움</span>
      </li>
    );
  return (
    <li>
      <div className={styles.rowMain}>
        <strong>{condition.itemName}</strong>
        <span className={styles.line}>{conditionText(condition.comparator, condition.price)}</span>
      </div>
      <p className={styles.rowFacts}>
        지금 {gold(condition.currentMinPrice)}
        {" · "}
        {condition.matchedNow ? "지금 맞음" : "기다리는 중"}
        {condition.lastSentAt && ` · 마지막 알림 ${kst.format(new Date(condition.lastSentAt))}`}
      </p>
      <button
        type="button"
        className={`${styles.remove} hit-44`}
        onClick={onRemove}
        disabled={removing}
        aria-label={`${condition.itemName} ${conditionText(condition.comparator, condition.price)} 알림 지우기`}
      >
        지우기
      </button>
    </li>
  );
}

function AddCondition({
  own,
  items,
  itemsFailed,
  full,
  onAdded,
  onExpired,
}: {
  own: Owned | null;
  items: { itemId: number; itemName: string; currentMinPrice?: number | null }[] | null;
  itemsFailed: boolean;
  full: boolean;
  onAdded: () => void;
  onExpired: () => void;
}) {
  const ids = { item: useId(), price: useId(), hint: useId() };
  const [itemId, setItemId] = useState<number | null>(null);
  const [comparator, setComparator] = useState<Comparator>("AT_OR_BELOW");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = items?.find((item) => item.itemId === itemId) ?? items?.[0] ?? null;
  const add = useMutation({
    mutationFn: (body: { itemId: number; comparator: Comparator; price: number }) => addCondition(own!, body),
    onSuccess: () => {
      setPrice("");
      setError(null);
      onAdded();
    },
    onError: (failure) => {
      if (codeOf(failure) === "ALERT_SUBSCRIPTION_NOT_FOUND") onExpired();
      else setError(alertErrorText(codeOf(failure)));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(price.replace(/,/g, ""));
    if (!chosen || !own) return;
    if (full) {
      setError(alertErrorText("ALERT_TOO_MANY_CONDITIONS"));
      return;
    }
    if (!Number.isFinite(value) || value < 0.01 || value > 999_999_999_999.99) {
      setError("가격은 0.01골드부터 넣을 수 있어요.");
      return;
    }
    add.mutate({ itemId: chosen.itemId, comparator, price: Math.round(value * 100) / 100 });
  }

  return (
    <section className={styles.add} aria-labelledby="alerts-add">
      <h2 id="alerts-add">알림 추가</h2>
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor={ids.item}>품목</label>
          {items && items.length > 0 ? (
            <Select
              id={ids.item}
              // 44px like the price field and the stub before the list arrives.
              size="lg"
              value={chosen?.itemId ?? items[0].itemId}
              onValueChange={(value) => setItemId(Number(value))}
              items={items.map((item) => ({ value: item.itemId, label: item.itemName }))}
            />
          ) : (
            // The select's own height while there is none, so the form keeps its size.
            <p className={styles.fieldStub} id={ids.item}>
              {itemsFailed ? "품목을 불러오지 못했어요." : items ? "지금 알림을 걸 수 있는 품목이 없어요." : "품목을 불러오고 있어요…"}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <span id={`${ids.price}-line`}>조건</span>
          <SegmentedControl
            aria-labelledby={`${ids.price}-line`}
            value={comparator}
            onValueChange={(value) => setComparator(value as Comparator)}
          >
            <SegmentedItem value="AT_OR_BELOW">이하가 되면</SegmentedItem>
            <SegmentedItem value="AT_OR_ABOVE">이상이 되면</SegmentedItem>
          </SegmentedControl>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.price}>기준 가격(골드)</label>
          <input
            id={ids.price}
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-describedby={ids.hint}
            aria-invalid={!!error || undefined}
            placeholder={chosen?.currentMinPrice != null ? String(chosen.currentMinPrice) : ""}
          />
          <small id={ids.hint} className={styles.fieldNote}>
            {chosen ? `지금 판매 최저가 ${gold(chosen.currentMinPrice)}` : " "}
          </small>
        </div>
        {/* One label throughout (its width never changes the form's columns). */}
        <button
          type="submit"
          className={styles.primary}
          disabled={!own || !chosen || add.isPending || !price.trim()}
          aria-busy={add.isPending || undefined}
        >
          알림 추가
        </button>
      </form>
      <p className={styles.message} role="status">
        {error ?? (own ? (full ? alertErrorText("ALERT_TOO_MANY_CONDITIONS") : " ") : "알림을 켠 뒤 추가할 수 있어요.")}
      </p>
    </section>
  );
}
