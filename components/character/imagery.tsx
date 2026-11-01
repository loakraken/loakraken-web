"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ThinkingOrb } from "thinking-orbs";
import { COLLECTIBLE_SPRITE, COLLECTIBLE_SPRITE_SIZE, collectibleSpriteIcon } from "@/lib/character/collectible-sprite";
import { useLandingMotion } from "@/components/landing/motion";
import { gradeKey, safeGameImage } from "@/lib/character/model";
import { bannerBackdrop, cutoutPortrait, glowTint } from "@/lib/character/portrait-cutout";
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
  tone,
}: {
  src: string | null | undefined;
  grade?: string | null;
  size?: number;
  inactive?: boolean;
  /** "official": the official armory's own grade background (equipment tab, user 11-02). */
  tone?: "official";
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
      data-tone={tone}
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

// The official sprite is checked once per page: until it has failed, rows
// draw from it; if it cannot load, every row falls back to the API badge.
let spriteState: "loading" | "ok" | "failed" = "loading";
const spriteListeners = new Set<() => void>();
function subscribeSprite(listener: () => void) {
  spriteListeners.add(listener);
  if (spriteState === "loading" && spriteListeners.size === 1 && COLLECTIBLE_SPRITE) {
    const probe = new Image();
    probe.decoding = "async";
    probe.referrerPolicy = "no-referrer";
    const settle = (state: "ok" | "failed") => {
      spriteState = state;
      spriteListeners.forEach((call) => call());
    };
    probe.onload = () => settle("ok");
    probe.onerror = () => settle("failed");
    probe.src = COLLECTIBLE_SPRITE;
  }
  return () => spriteListeners.delete(listener);
}

/**
 * A 수집품 type's icon (feedback #17): the official armory's own small icon
 * from its sprite, at its native size (as the official page draws it, so it
 * stays crisp), centred in the same 32px box as before; the API badge when
 * the type is not mapped or the sprite cannot load. Decorative.
 */
export function CollectibleIcon({ type, badge, size = 32 }: { type: string | null; badge: string | null; size?: number }) {
  const state = useSyncExternalStore(subscribeSprite, () => spriteState, () => "loading" as const);
  const icon = collectibleSpriteIcon(type);
  if (!icon || !COLLECTIBLE_SPRITE || state === "failed") return <GameIcon src={badge} size={size} />;
  return (
    <span
      className={styles.collectibleIcon}
      style={{ "--icon-size": `${size}px` } as CSSProperties}
      data-sprite-type={type ?? undefined}
      aria-hidden="true"
    >
      <span
        style={{
          width: icon.width,
          height: icon.height,
          backgroundImage: `url(${COLLECTIBLE_SPRITE})`,
          backgroundSize: `${COLLECTIBLE_SPRITE_SIZE.width}px ${COLLECTIBLE_SPRITE_SIZE.height}px`,
          backgroundPosition: `${icon.x}px ${icon.y}px`,
        }}
      />
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
      </div>
      {/* Under the picture, not over it: the art's own bottom (name plate,
          awakening frame) stays whole (#1101). */}
      <span
        className={styles.awake}
        role="img"
        aria-label={known ? `${awakeCount}각성` : "각성 미확인"}
      >
        {Array.from({ length: total }, (_, i) => (
          <i key={i} data-on={known && i < (awakeCount ?? 0)} />
        ))}
      </span>
      <figcaption>
        <strong>{name}</strong>
        <small>{known ? `${awakeCount}각성` : "각성 미확인"}</small>
      </figcaption>
    </figure>
  );
}

type Tones = { ambient: string | null; backdrop: string | null };
const NO_TONES: Tones = { ambient: null, backdrop: null };

// The band takes the render's own backdrop colour (capped dark enough for the
// banner text) and the glow its effect colour. A separate anonymous-CORS
// request feeds the canvas, so the visible original never depends on CORS;
// any failure keeps the default --banner band and no glow.
function usePortraitTones(src: string | null): Tones {
  const [tones, setTones] = useState<Tones>(NO_TONES);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setTones(NO_TONES);
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
        // Only the tones are read; the processed pixels are discarded.
        const result = cutoutPortrait(pixels.data, width, height);
        if (!result) return fail();
        // Soft glow behind the figure takes the effect colour, normalised.
        const ambient = result.ambient
          ? glowTint(result.ambient).join(" ")
          : null;
        const backdrop = bannerBackdrop(result.backdrop).join(" ");
        if (!cancelled) setTones({ ambient, backdrop });
      } catch {
        fail();
      }
    };
    probe.src = src;
    return () => {
      cancelled = true;
      setTones(NO_TONES);
    };
  }, [src]);
  return tones;
}

// Character banner: identity on
// the left, the render in the middle cropped head-to-waist (about the top 6-61%
// of the render, enlarged to ~1.8x the band), extra facts on the right.
// The band is dark in every theme and shows the original render.
export function CharacterBanner({
  url,
  name,
  identity,
  facts,
}: {
  url: string | null;
  name: string;
  identity: ReactNode;
  facts: ReactNode;
}) {
  const safe = safeGameImage(url);
  const { enabled } = useLandingMotion();
  const [phase, bind] = useImagePhase(safe);
  const tones = usePortraitTones(safe);
  const waiting = phase === "loading";

  return (
    <section
      className={styles.banner}
      data-phase={phase}
      aria-label={`${name} 캐릭터 요약`}
      style={
        tones.backdrop || tones.ambient
          ? ({
              ...(tones.backdrop && { "--backdrop": tones.backdrop }),
              ...(tones.ambient && { "--ambient": tones.ambient }),
            } as CSSProperties)
          : undefined
      }
    >
      <div className={styles.bannerInner}>
        <div className={styles.bannerIdentity}>{identity}</div>
        <span
          className={styles.bannerGlow}
          data-ready={(tones.ambient && phase !== "failed") || undefined}
          aria-hidden="true"
        />
        <div className={styles.bannerFigure}>
          {safe && phase !== "failed" && (
            <>
              {/* Original render. Official CDN, not proxied. */}
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
            </>
          )}
          {waiting && (
            <span
              className={styles.bannerOrb}
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
        <div className={styles.bannerFacts}>{facts}</div>
      </div>
    </section>
  );
}
