import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { ChevronLeft } from "@/components/ui/icons";
import { DevNoteBody } from "@/components/news/dev-note-body";
import { noteDate } from "@/components/news/dev-notes";
import home from "@/components/home/home.module.css";
import styles from "@/components/news/dev-notes.module.css";
import { getDevNote } from "@/lib/dev-notes/server";

// The notes ship with the image and are read per request (a few small files).
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const note = getDevNote((await params).slug);
  if (!note) return { title: "LOAKraken 개발자 노트" };
  const path = `/news/dev-notes/${note.slug}`;
  return {
    // "%s | LOAKraken" from the root layout completes it.
    title: `${note.title} · 개발자 노트`,
    ...(note.summary && { description: note.summary }),
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: note.title,
      url: path,
      publishedTime: note.date,
      ...(note.summary && { description: note.summary }),
    },
  };
}

export default async function DevNotePage({ params }: { params: Params }) {
  const note = getDevNote((await params).slug);
  if (!note) notFound();
  return (
    <div className={home.page}>
      <a className={home.skip} href="#dev-note">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="dev-note" className={`${home.main} ${styles.article}`}>
        <Link href="/news?tab=dev" className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          개발자 노트 목록
        </Link>
        <article aria-labelledby="dev-note-title">
          <header className={styles.head}>
            <h1 id="dev-note-title">{note.title}</h1>
            <time dateTime={note.date}>{noteDate(note.date)}</time>
          </header>
          <DevNoteBody body={note.body} />
        </article>
      </main>
    </div>
  );
}
