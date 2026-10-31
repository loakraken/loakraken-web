"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_KEY_LENGTH, REMEMBER_DAYS, normalizeUserKey, type UserKeyStatus } from "@/lib/byok/key";
import styles from "./api-key-panel.module.css";

const until = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Register or clear the user's own official API key (BYOK). The key goes to
 * our server once, in the body of a same-site POST, and is never shown again:
 * the page keeps only the hint (last four characters). The field is emptied
 * right after sending, so the key does not stay in the page (보안 R1).
 */
export function ApiKeyPanel({ initial, portal }: { initial: UserKeyStatus; portal: string }) {
  const [status, setStatus] = useState(initial);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("key") as HTMLInputElement;
    const key = normalizeUserKey(input.value);
    if (!key) {
      setError("키 형식이 맞지 않아요. 공식 개발자 포털에서 받은 키 전체를 붙여 넣어 주세요.");
      input.focus();
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, remember }),
      });
      const body: { ok?: boolean; data?: UserKeyStatus; error?: { code?: string } } = await response.json();
      if (!response.ok || !body.ok || !body.data) {
        setError(
          body.error?.code === "USER_KEY_MALFORMED"
            ? "키 형식이 맞지 않아요. 공식 개발자 포털에서 받은 키 전체를 붙여 넣어 주세요."
            : "키를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
        );
        return;
      }
      setStatus(body.data);
      setNote("키를 등록했어요. 다음 캐릭터 검색부터 내 키로 조회해요.");
    } catch {
      setError("키를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      input.value = "";
      setBusy(null);
    }
  }

  async function clear() {
    setBusy("clear");
    setError("");
    try {
      const response = await fetch("/api/byok", { method: "DELETE" });
      if (!response.ok) throw new Error("clear");
      setStatus({ set: false, hint: null, expiresAt: null });
      setNote("키를 지웠어요. 이제 사이트 공용 키로 조회해요.");
    } catch {
      setError("키를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`${fieldId}-title`}>
      <h2 id={`${fieldId}-title`}>등록한 키</h2>
      {/* One line, always there: registering or clearing changes its words, not the layout. */}
      <p className={styles.current}>
        {status.set && status.hint ? (
          <>
            <b>{status.hint}</b>
            {status.expiresAt && <span> · {until.format(new Date(status.expiresAt))}까지</span>}
          </>
        ) : (
          <span>없음 (사이트 공용 키로 조회해요)</span>
        )}
      </p>
      {status.set && (
        <Button type="button" variant="outline" size="sm" onClick={clear} loading={busy === "clear"}>
          키 지우기
        </Button>
      )}

      <form className={styles.form} onSubmit={save} noValidate>
        <label htmlFor={fieldId}>{status.set ? "다른 키로 바꾸기" : "API 키"}</label>
        <Input
          id={fieldId}
          name="key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_KEY_LENGTH}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          이 브라우저에서 {REMEMBER_DAYS}일 동안 기억
        </label>
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
        <Button type="submit" loading={busy === "save"}>
          키 등록
        </Button>
      </form>
      <p className={styles.note} role="status">
        {note}
      </p>

      <h2>알아 두세요</h2>
      <ul className={styles.facts}>
        <li>키는 캐릭터 검색·원정대 조회 요청마다 우리 서버를 거쳐 공식 API로 보내지고, 그 요청에만 쓰여요.</li>
        <li>서버에 저장하지 않아요. 이 브라우저의 쿠키(페이지에서 읽을 수 없는 쿠키)에 암호화해 두고, 화면에는 끝 네 글자만 보여요.</li>
        <li>내 키의 한도를 쓰고, 한도에 걸려도 사이트 공용 키로 바꿔 부르지 않아요.</li>
        <li>
          여기서 지워도 키가 공식적으로 폐기되지는 않아요. 키를 더 쓰지 않으려면{" "}
          <a href={portal} target="_blank" rel="noopener noreferrer">
            공식 개발자 포털<span className="sr-only"> (새 창)</span>
          </a>
          에서 폐기해 주세요.
        </li>
      </ul>
    </section>
  );
}
