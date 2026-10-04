"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { m, useSpring } from "motion/react";
import { ThinkingOrb } from "thinking-orbs";
import { useLandingMotion } from "@/components/landing/motion";
import { gradeKey, safeGameImage } from "@/lib/character/model";
import { cutoutPortrait } from "@/lib/character/portrait-cutout";
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

type Cutout = {
  status: "none" | "pending" | "ready" | "failed";
  url: string | null;
  ambient: string | null;
  backdrop: string | null;
};

// Light surfaces need the render without its baked-in dark backdrop. A separate
// anonymous-CORS request feeds the canvas, so the visible original never
// depends on CORS; any failure falls back to the dark band with the original.
function usePortraitCutout(src: string | null): Cutout {
  const [cutout, setCutout] = useState<Cutout>({
    status: src ? "pending" : "none",
    url: null,
    ambient: null,
    backdrop: null,
  });
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const fail = () => {
      if (!cancelled)
        setCutout({
          status: "failed",
          url: null,
          ambient: null,
          backdrop: null,
        });
    };
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.referrerPolicy = "no-referrer";
    probe.onerror = fail;
    probe.onload = () => {
      try {
        const width = probe.naturalWidth;
        const height = probe.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return fail();
        context.drawImage(probe, 0, 0);
        const pixels = context.getImageData(0, 0, width, height);
        const result = cutoutPortrait(pixels.data, width, height);
        if (!result) return fail();
        context.putImageData(pixels, 0, 0);
        const ambient = result.ambient ? result.ambient.join(" ") : null;
        const backdrop = result.backdrop.map((v) => Math.round(v)).join(" ");
        canvas.toBlob((blob) => {
          if (cancelled) return;
          if (!blob) return fail();
          objectUrl = URL.createObjectURL(blob);
          setCutout({ status: "ready", url: objectUrl, ambient, backdrop });
        }, "image/png");
      } catch {
        fail();
      }
    };
    probe.src = src;
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return cutout;
}

// LOAKraken "observation stage": the full, uncropped render stands on a soft
// floor shadow inside the brand's orbit rings (the landing orb motif), with a
// halo tinted from the render. Light surfaces use the locally generated
// backdrop-free cutout; dark surfaces (and cutout failures) use the original
// on a dark rounded surface. The tone switches in CSS, so nothing flashes.
export function CharacterStage({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const safe = safeGameImage(url);
  const { enabled } = useLandingMotion();
  const [phase, bind] = useImagePhase(safe);
  const cutout = usePortraitCutout(safe);
  const shiftX = useSpring(0, { stiffness: 90, damping: 22 });
  const waiting = phase === "loading" || cutout.status === "pending";

  return (
    <div
      className={styles.stage}
      data-phase={phase}
      data-cutout={cutout.status}
      data-motion={enabled ? "on" : "off"}
      style={
        {
          ...(cutout.ambient && { "--ambient": cutout.ambient }),
          ...(cutout.backdrop && { "--backdrop": cutout.backdrop }),
        } as CSSProperties
      }
      onPointerMove={(event) => {
        if (
          !enabled ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        shiftX.set(((event.clientX - box.left) / box.width - 0.5) * 10);
      }}
      onPointerLeave={() => shiftX.set(0)}
    >
      <span className={styles.stageHalo} aria-hidden="true" />
      <span className={styles.stageOrbits} aria-hidden="true">
        <i className={styles.stageOrbitOuter}>
          <b />
        </i>
        <i className={styles.stageOrbitInner}>
          <b />
        </i>
      </span>
      <span className={styles.stageFloor} aria-hidden="true" />
      {safe && phase !== "failed" && (
        <m.div
          className={styles.stageFigure}
          style={enabled ? { x: shiftX } : undefined}
        >
          {/* Original render (dark surfaces). Official CDN, not proxied. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...bind}
            className={styles.figureOriginal}
            src={safe}
            alt={`${name} 캐릭터 전신`}
            width={612}
            height={708}
            decoding="async"
            fetchPriority="high"
            referrerPolicy="no-referrer"
          />
          {cutout.url && (
            // Backdrop-removed render (light surfaces), generated locally.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.figureCutout}
              src={cutout.url}
              alt=""
              aria-hidden="true"
              width={612}
              height={708}
            />
          )}
        </m.div>
      )}
      {(!safe || phase === "failed") && (
        <span className={styles.stageFallback} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      {waiting && (
        <span
          className={styles.stageOrb}
          role="status"
          aria-label="캐릭터 이미지를 준비하는 중"
        >
          <span className={styles.orbLight}>
            <ThinkingOrb
              state="searching"
              size={64}
              theme="light"
              color="#0066cc"
              paused={!enabled}
            />
          </span>
          <span className={styles.orbDark}>
            <ThinkingOrb
              state="searching"
              size={64}
              theme="dark"
              color="#8ab8ff"
              paused={!enabled}
            />
          </span>
        </span>
      )}
    </div>
  );
}
