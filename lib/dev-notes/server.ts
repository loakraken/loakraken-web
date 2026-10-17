// LOAKraken 개발자 노트 for the pages: the files (./files) with one read per
// request render.
import "server-only";
import { cache } from "react";
import { devNoteList, readDevNotes } from "./files";

/** Every note, newest first; a missing folder is no notes. */
export const getDevNotes = cache(readDevNotes);

/** The list without bodies (what the /news tab needs). */
export const getDevNoteList = cache(devNoteList);

export const getDevNote = (slug: string) => getDevNotes().find((note) => note.slug === slug) ?? null;
