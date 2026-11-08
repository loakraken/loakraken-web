import type { CSSProperties } from "react";
import { engravingIcon } from "@/lib/character/engraving-icons";

/**
 * An engraving's icon (user 11-08, the user's game files under /engravings) in
 * a fixed square box: the box is there before the image loads and also when we
 * have no icon for the name, so a row never moves (A7). Decorative: the name is
 * always written beside it.
 */
export function EngravingIcon({
  name,
  size = 24,
  className = "",
  style,
  grade,
}: {
  name: string | null | undefined;
  /** The grade key (gradeKey) for a ring in its colour; the caller styles it. */
  grade?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const src = engravingIcon(name);
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-[6px] bg-muted align-middle ${className}`}
      style={{ width: size, height: size, ...style }}
      data-engraving-icon={src ? "" : "none"}
      data-grade={grade}
      aria-hidden="true"
    >
      {src && (
        // A small static file of our own: next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} decoding="async" loading="lazy" className="block size-full" />
      )}
    </span>
  );
}
