"use client";

// (ours, X6) 블루 크리스탈 on the 시세 screen, through the official path only (No RMT): the official shop's royal
// crystals per 100 blue crystals, with its source and check date, and the in-game exchange rate as the user's own
// value (no official feed of it exists) — the same browser-only value the 로아샵 효율 계산기 uses. With a rate typed,
// one royal crystal in gold. Every line is drawn from the first paint, so the stored value landing moves nothing.
import { useId } from "react";
import Link from "next/link";
import { useCrystalRate } from "@/components/tools/crystal-rate-store";
import { goldPerRoyal } from "@/lib/tools/crystal-rate";
import styles from "./crystal-card.module.css";

export type CrystalShopRate = {
  /** Royal crystals for 100 blue crystals at the official shop. */
  royalPer100: number;
  /** The official shop page the rate was read from, and the day it was checked. */
  source: { url: string; date: string };
};

const whole = new Intl.NumberFormat("ko-KR");
const fraction = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

export function CrystalCard({ royalPer100, source }: CrystalShopRate) {
  const { text, change, rate } = useCrystalRate();
  const rateId = useId();
  const hintId = useId();
  return (
    <section className={styles.card} aria-labelledby="crystal-heading">
      <h2 id="crystal-heading">블루 크리스탈</h2>
      <dl className={styles.facts}>
        <div>
          <dt>공식 상점</dt>
          <dd>
            <span className={styles.value}>
              100개 = 로열 크리스탈 <span className={styles.nowrap}>{whole.format(royalPer100)}개</span>
            </span>
            <span className={styles.sub}>
              <a href={source.url} target="_blank" rel="noreferrer">
                공식 상점
              </a>{" "}
              판매가 기준 · 확인 {source.date}
            </span>
          </dd>
        </div>
        <div>
          <dt>로열 크리스탈 1개</dt>
          <dd>
            <span className={styles.value}>
              {rate == null ? "—" : `약 ${fraction.format(goldPerRoyal(rate, royalPer100))}골드`}
            </span>
            <span className={styles.sub}>{rate == null ? "교환소 시세를 넣으면 계산해요" : "내가 넣은 교환소 시세 기준"}</span>
          </dd>
        </div>
      </dl>
      <label className={styles.field} htmlFor={rateId}>
        <span>게임 안 교환소 시세 · 블루 크리스탈 100개당 골드(내가 본 값)</span>
        <input
          id={rateId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="비워 두면 계산하지 않아요"
          aria-describedby={hintId}
          value={text}
          onChange={(event) => change(event.target.value)}
        />
      </label>
      <p id={hintId} className={styles.hint}>
        교환소 시세는 공식으로 받아 올 곳이 없어 직접 넣는 값이에요. 이 브라우저에만 저장하고 서버로 보내지 않아요.
        로아샵 효율 계산기와 같은 값을 써요.
      </p>
      <Link className={styles.link} href="/tools/loa-shop">
        로아샵 효율 계산기에서 패키지 이득 보기
      </Link>
    </section>
  );
}
