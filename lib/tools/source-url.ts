/**
 * A data source's address: https, or null for a community page whose address is
 * kept in the internal record, outside this public repository (#1470). `_note`
 * says so, and the data checks require it. Official sources keep their address.
 */
export type SourceUrl = { url: string | null; _note?: string };

export const sourceUrlOk = (source: SourceUrl) =>
  source.url === null ? /내부 기록/.test(source._note ?? "") : /^https:\/\//.test(source.url);
