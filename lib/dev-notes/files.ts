// LOAKraken 개발자 노트 files, read once per process (a handful of small files
// that change only with a deploy): the image ships them beside the server
// (next.config outputFileTracingIncludes), and tests point DEV_NOTES_DIR at
// their own. Node only (node:fs), without "server-only" so the sitemap — and
// the unit tests that load it — can use it too.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { byNewest, NOTE_FILE, readNote, type DevNote, type DevNoteMeta } from "./model";

export const devNotesDir = (env: Record<string, string | undefined> = process.env) =>
  env.DEV_NOTES_DIR?.trim() || path.join(process.cwd(), "content", "dev-notes");

function readAll(dir: string): DevNote[] {
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
}

const read = new Map<string, DevNote[]>();

/** Every note, newest first; a missing folder is no notes. */
export function readDevNotes(): DevNote[] {
  const dir = devNotesDir();
  let notes = read.get(dir);
  if (!notes) read.set(dir, (notes = readAll(dir)));
  return notes;
}

/** The list without bodies (the /news tab and the sitemap). */
export const devNoteList = (): DevNoteMeta[] =>
  readDevNotes().map(({ slug, title, date, summary }) => ({ slug, title, date, summary }));
