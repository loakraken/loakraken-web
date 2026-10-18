// Notice rows and the running-event list, shared by the home cards and /news.

import { dDay, kstDate, periodText, type HomeEvent } from "@/lib/home/model";
import { safeGameImage } from "@/lib/character/model";
import styles from "@/components/home/home.module.css";

/** "10.9" in KST. */
export function shortDate(iso: string) {
  const [, m, d] = kstDate(Date.parse(iso)).split("-");
  return `${Number(m)}.${Number(d)}`;
}

/** One official notice: kind tag, title (ellipsis, full text on hover), date. */
export function NoticeItem({
  title,
  url,
  publishedAt,
  tag,
  category,
}: {
  title: string;
  url: string | null;
  publishedAt: string;
  tag: string;
  category?: string;
}) {
  return (
    <li>
      <a href={url ?? undefined} target="_blank" rel="noreferrer">
        <i data-category={category}>{tag}</i>
        <span title={title}>{title}</span>
        <time dateTime={publishedAt}>{shortDate(publishedAt)}</time>
      </a>
    </li>
  );
}

/** Running events, ending soonest first, with the days left. */
export function EventItems({ events, now }: { events: HomeEvent[]; now: number | null }) {
  return (
    <ul className={styles.events}>
      {events.map((event) => {
        const left = now !== null ? dDay(event.endAt, now) : null;
        const thumbnail = safeGameImage(event.thumbnail);
        return (
          <li key={`${event.startAt}${event.title}`}>
            <a href={event.url ?? undefined} target="_blank" rel="noreferrer">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- official event banner
                <img
                  src={thumbnail}
                  alt=""
                  width={64}
                  height={36}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <span className={styles.eventText}>
                <strong>{event.title}</strong>
                <small>{periodText(event.startAt, event.endAt)}</small>
              </span>
              {left && (
                <b data-soon={left === "D-day" || /^D-[1-3]$/.test(left) || undefined}>
                  {left}
                </b>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
