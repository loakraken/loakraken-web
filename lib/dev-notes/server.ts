// LOAKraken 개발자 노트 files on the server. Read per request (a handful of
// small files): the image ships them beside the server (next.config
// outputFileTracingIncludes), and tests point DEV_NOTES_DIR at their own.
import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { byNewest, NOTE_FILE, readNote, type DevNote, type DevNoteMeta } from "./model";

export const devNotesDir = (env: Record<string, string | undefined> = process.env) =>
  env.DEV_NOTES_DIR?.trim() || path.join(process.cwd(), "content", "dev-notes");

/** Every note, newest first; a missing folder is no notes. */
export const getDevNotes = cache((): DevNote[] => {
  const dir = devNotesDir();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((file) => NOTE_FILE.test(file))
    .map((file) => readNote(file, readFileSync(path.join(dir, file), "utf8")))
    .filter((note): note is DevNote => note != null)
    .sort(byNewest);
});

/** The list without bodies (what the /news tab needs). */
export const getDevNoteList = (): DevNoteMeta[] =>
  getDevNotes().map(({ slug, title, date, summary }) => ({ slug, title, date, summary }));

export const getDevNote = (slug: string) => getDevNotes().find((note) => note.slug === slug) ?? null;
