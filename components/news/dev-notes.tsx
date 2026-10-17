// LOAKraken 개발자 노트 list for the /news tab: newest first, title · summary ·
// date, each opening the note on this site. The list comes from the
// server with the page (lib/dev-notes/server), so it is there in the first HTML.
import Link from "next/link";
import type { DevNoteMeta } from "@/lib/dev-notes/model";
import home from "@/components/home/home.module.css";
import styles from "./dev-notes.module.css";

/** "2026.10.19" from "2026-10-19" — no clock, so the server and the page agree. */
export const noteDate = (date: string) => date.replaceAll("-", ".");

export function DevNotes({ notes }: { notes: readonly DevNoteMeta[] }) {
  if (notes.length === 0)
    return <p className={home.muted}>아직 올라온 개발자 노트가 없어요. 업데이트 소식과 바뀐 점을 곧 여기에 올릴게요.</p>;
  return (
    <ul className={styles.list} aria-label="LOAKraken 개발자 노트 목록">
      {notes.map((note) => (
        <li key={note.slug}>
          {/* The title leads; the date closes the block as plain metadata. */}
          <Link href={`/news/dev-notes/${note.slug}`}>
            <strong>{note.title}</strong>
            {note.summary && <span>{note.summary}</span>}
            <time dateTime={note.date}>{noteDate(note.date)}</time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
