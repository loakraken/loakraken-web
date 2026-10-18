import { countdownText } from "@/lib/api/rate-limit";

const hidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;

/**
 * The seconds left after a 429, shown next to the fixed alert sentence. The
 * ticking number stays out of every live region (a screen reader would read
 * it again each second); reaching zero is announced once, politely.
 */
export function RateLimitNote({
  seconds,
  className,
  buttonCounts = false,
}: {
  seconds: number;
  className?: string;
  /** A button next to it already says the seconds ('N초 뒤 다시 조회'): one
      count on screen, not two (PM-프론트 10-18 (c)); zero is still announced. */
  buttonCounts?: boolean;
}) {
  return (
    <>
      <span aria-hidden="true" className={className} hidden={buttonCounts}>
        {seconds > 0 ? `남은 시간 ${seconds}초` : countdownText(0)}
      </span>
      <span style={hidden} aria-live="polite">
        {seconds > 0 ? "" : countdownText(0)}
      </span>
    </>
  );
}
