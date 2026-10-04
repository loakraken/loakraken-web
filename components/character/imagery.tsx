"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { m, useMotionTemplate, useSpring } from "motion/react";
import { ThinkingOrb } from "thinking-orbs";
import { useLandingMotion } from "@/components/landing/motion";
import { gradeKey, safeGameImage } from "@/lib/character/model";
import styles from "./imagery.module.css";

type Phase = "server" | "loading" | "loaded" | "failed";

// SSR renders images visible so the page works without JavaScript. React does
// not replay load/error events that fired before hydration, so the element's
// own state is read on mount instead of relying on onLoad/onError alone.
function useImagePhase(src: string | null) {
  const [phase, setPhase] = useState<Phase>("server");
  // Callback ref: runs when the element mounts (after hydration) and when src changes.
  const ref = useCallback(
    (image: HTMLImageElement | null) => {
      if (!src || !image) return;
      if (image.complete)
        setPhase(image.naturalWidth > 0 ? "loaded" : "failed");
      else setPhase("loading");
    },
    [src],
  );
  const onLoad = useCallback(() => setPhase("loaded"), []);
  const onError = useCallback(() => setPhase("failed"), []);
  return [phase, { ref, onLoad, onError }] as const;
}

export function GameIcon({
  src,
  grade,
  size = 44,
  inactive = false,
}: {
  src: string | null | undefined;
  grade?: string | null;
  size?: number;
  inactive?: boolean;
}) {
  const safe = safeGameImage(src);
  const [phase, bind] = useImagePhase(safe);
  const failed = phase === "failed";
  const grading = gradeKey(grade);
  // Without an image or a grade the tile would be an empty placeholder; omit it.
  if ((!safe || failed) && grading === "unknown") return null;
  return (
    <span
      className={styles.icon}
      data-grade={grading}
      data-inactive={inactive || undefined}
      style={{ "--icon-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {safe && !failed && (
        // Official CDN asset at a fixed size; the Next optimizer would proxy a third-party host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...bind}
          src={safe}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </span>
  );
}

export function CardArt({
  src,
  name,
  grade,
  awakeCount,
  awakeTotal,
}: {
  src: string | null;
  name: string;
  grade: string | null;
  awakeCount: number | null;
  awakeTotal: number | null;
}) {
  const safe = safeGameImage(src);
  const [phase, bind] = useImagePhase(safe);
  const known = awakeCount != null && awakeCount >= 0;
  const total =
    awakeTotal != null && awakeTotal > 0 ? Math.min(awakeTotal, 10) : 5;
  return (
    <figure className={styles.card} data-grade={gradeKey(grade)}>
      <div className={styles.cardFrame}>
        {safe && phase !== "failed" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...bind}
            src={safe}
            alt=""
            width={248}
            height={362}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.cardFallback} aria-hidden="true">
            {name.slice(0, 1)}
          </span>
        )}
        <span
          className={styles.awake}
          role="img"
          aria-label={known ? `${awakeCount}각성` : "각성 미확인"}
        >
          {Array.from({ length: total }, (_, i) => (
            <i key={i} data-on={known && i < (awakeCount ?? 0)} />
          ))}
        </span>
      </div>
      <figcaption>
        <strong>{name}</strong>
        <small>{known ? `${awakeCount}각성` : "각성 미확인"}</small>
      </figcaption>
    </figure>
  );
}

export function PortraitStage({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const safe = safeGameImage(url);
  const { enabled } = useLandingMotion();
  const [phase, bind] = useImagePhase(safe);
  const rotateX = useSpring(0, { stiffness: 100, damping: 20 });
  const rotateY = useSpring(0, { stiffness: 100, damping: 20 });
  const transform = useMotionTemplate`perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  const visible = phase === "server" || phase === "loaded";

  return (
    <m.div
      className={styles.stage}
      data-phase={phase}
      style={{ transform: enabled ? transform : "none" }}
      onPointerMove={(event) => {
        if (
          !enabled ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        rotateX.set((0.5 - (event.clientY - box.top) / box.height) * 6);
        rotateY.set(((event.clientX - box.left) / box.width - 0.5) * 6);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      {safe && phase !== "failed" ? (
        <m.div
          className={styles.stageImage}
          initial={false}
          animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 1.04 }}
          transition={
            enabled && phase !== "server"
              ? { type: "spring", bounce: 0, duration: 0.7 }
              : { duration: 0 }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...bind}
            src={safe}
            alt={`${name} 캐릭터 전신`}
            width={612}
            height={708}
            decoding="async"
            fetchPriority="high"
            referrerPolicy="no-referrer"
          />
        </m.div>
      ) : (
        <span className={styles.stageFallback} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      {phase === "loading" && (
        <span
          className={styles.stageOrb}
          role="status"
          aria-label="캐릭터 이미지를 불러오는 중"
        >
          <ThinkingOrb
            state="searching"
            size={64}
            theme="dark"
            color="#8ab8ff"
            paused={!enabled}
          />
        </span>
      )}
      <span className={styles.stageSheen} aria-hidden="true" />
    </m.div>
  );
}
