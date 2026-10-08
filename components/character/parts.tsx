"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  emptyObservation,
  evidenceAt,
  type CharacterEnvelope,
  type CoverageState,
} from "@/lib/character/model";
import { parseSourceText, sourcePlainText } from "@/lib/character/source-text";
import styles from "./character.module.css";

// Missing values read as "-" (as the other sites show them).
export const number = (value: number | null | undefined) =>
  value == null
    ? "-"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
export const level = (value: number | null | undefined) =>
  value == null ? "-" : `Lv.${number(value)}`;
export const text = (value: string | null | undefined) =>
  sourcePlainText(value) || "-";
// Stats arrive as strings; group digits only when the whole value is a plain number.
export const numeric = (value: string | null | undefined) =>
  value && /^-?\d+(\.\d+)?$/.test(value) ? number(Number(value)) : text(value);

export const kstTime = (value: string | number, withDate = true) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(withDate && { month: "long", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function SourceText({ value }: { value: string | null | undefined }) {
  const segments = parseSourceText(value);
  if (!segments.length) return <>-</>;
  return (
    <span className={styles.sourceText}>
      {segments.map((segment, i) =>
        segment.tone ? (
          <span key={i} data-tone={segment.tone}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </span>
  );
}

export function Empty({ state }: { state: CoverageState | null | undefined }) {
  return (
    <p className={styles.empty}>
      {state ? emptyObservation(state) : "이 요청에서는 조회하지 않았습니다."}
    </p>
  );
}

export function Evidence({
  envelope,
  path,
}: {
  envelope: CharacterEnvelope;
  path: string;
}) {
  const evidence = evidenceAt(envelope, path);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const content = JSON.stringify(
    { path, found: evidence.found, value: evidence.value },
    null,
    2,
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setFailed(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <details className={styles.evidence}>
      <summary>원본 데이터 보기</summary>
      <code>{path}</code>
      <pre>
        {evidence.found
          ? JSON.stringify(evidence.value, null, 2)
          : "현재 응답에서 해당 근거를 찾지 못했습니다."}
      </pre>
      <button type="button" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "복사됨" : "근거 복사"}
      </button>
      <span role="status" className={styles.copyStatus}>
        {failed ? "복사하지 못했어요. 근거를 직접 선택해 주세요." : ""}
      </span>
    </details>
  );
}
