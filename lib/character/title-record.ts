// 칭호 기록 (character 통계 tab, user 10-31): this roster's titles with how
// rare each is by our records. The rate is api #697's observedPercent: of the
// rosters we have seen, how many were ever seen wearing the title. The official
// profile shows only the worn title, so it is a lower bound of who owns it; the
// screen says "장착 기록 비율", never 보유율. One list, rarest first; a title
// whose sample is not ready (or without a rate yet) goes last as "모으는 중".

export type TitleRecordInput = { title: string; firstObservedDate: string };
export type TitleRate = {
  title: string;
  observedPercent?: number | null;
  observedCharacters?: number | null;
  sampleReady?: boolean | null;
};
export type TitleRecordRow = {
  title: string;
  firstObservedDate: string;
  /** Null while the sample is not ready or the backend gives no rate. */
  percent: number | null;
  /** The sample behind a not-ready rate ("표본 N명 — 모으는 중"), when known. */
  sample: number | null;
};

const ready = (rate: TitleRate | undefined) => rate?.sampleReady === true && rate.observedPercent != null;

/** Rated titles rarest first (ties: the earlier first record), then the rest in record order. */
export function titleRecordRows(titles: TitleRecordInput[], rates: TitleRate[]): TitleRecordRow[] {
  const byTitle = new Map(rates.map((rate) => [rate.title, rate]));
  const rows = titles.map((title, index) => {
    const rate = byTitle.get(title.title);
    return {
      index,
      row: {
        title: title.title,
        firstObservedDate: title.firstObservedDate,
        percent: ready(rate) ? (rate!.observedPercent as number) : null,
        sample: ready(rate) ? null : rate?.observedCharacters ?? null,
      },
    };
  });
  return rows
    .sort((a, b) => {
      const pa = a.row.percent;
      const pb = b.row.percent;
      if (pa != null && pb != null) return pa - pb || a.row.firstObservedDate.localeCompare(b.row.firstObservedDate) || a.index - b.index;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/** The three summary cells: how many, the rarest rated one, the first record date. */
export function titleRecordSummary(rows: TitleRecordRow[]) {
  const rarest = rows.find((row) => row.percent != null) ?? null;
  const first = rows.reduce<string | null>((min, row) => (min == null || row.firstObservedDate < min ? row.firstObservedDate : min), null);
  return { count: rows.length, rarest, first };
}

/** "5.17%" */
export const titlePercent = (value: number) => `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
