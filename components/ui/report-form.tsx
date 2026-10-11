"use client"

import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { TickCircle, Warning, InfoCircle } from "@/components/ui/icons"

// An anonymous report in two steps (PM 총괄 10-12 04:58 ④ — the wandering
// merchant K38: server · region · item). Step 1 picks, step 2 shows what will
// be sent with the bot check (Turnstile, the caller's widget) and sends; the
// answer is one of four states. No account, nothing typed: every value is a
// choice from the official lists, so nothing personal can slip in.
//
// The caller owns the data and the network:
//   fields   the choices in order; a field's options may depend on the ones
//            before it (region by server, item by region)
//   check    the bot-check widget for step 2, and `verified` once it passed
//   onSubmit sends and answers ok · duplicate · limited · error

type Option = { value: string; label: string }
type Values = Record<string, string>

type ReportField = {
  id: string
  label: string
  /** Options, or a function of the values chosen so far. */
  options: Option[] | ((values: Values) => Option[])
  /** Shown before a choice is made, e.g. "서버를 고르세요". */
  placeholder: string
}

type ReportResult =
  | { status: "ok" }
  | { status: "duplicate" }
  | { status: "limited"; retryInSeconds: number }
  | { status: "error"; message?: string }

type ReportFormProps = {
  title: string
  fields: ReportField[]
  /** The bot-check widget (Turnstile) shown in step 2. */
  check?: React.ReactNode
  /** Whether the bot check has passed (enables 제보하기). */
  verified?: boolean
  onSubmit: (values: Values) => Promise<ReportResult>
  /** One line under the form: what happens to a report, e.g. "같은 내용이 2건 이상이면 확인됨으로 표시돼요". */
  note?: React.ReactNode
  className?: string
}

const optionsOf = (field: ReportField, values: Values) =>
  typeof field.options === "function" ? field.options(values) : field.options

function ReportForm({ title, fields, check, verified = true, onSubmit, note, className }: ReportFormProps) {
  const id = React.useId()
  const [values, setValues] = React.useState<Values>({})
  const [step, setStep] = React.useState<"pick" | "confirm" | "done">("pick")
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState<ReportResult | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)

  const complete = fields.every((f) => values[f.id])
  const labelOf = (f: ReportField) => optionsOf(f, values).find((o) => o.value === values[f.id])?.label ?? ""

  // A choice clears the ones after it (their options depend on it).
  const choose = (index: number, value: string) => {
    setValues((current) => {
      const next: Values = {}
      fields.forEach((f, i) => {
        if (i < index && current[f.id]) next[f.id] = current[f.id]
      })
      next[fields[index].id] = value
      return next
    })
  }

  // Moving to another step puts focus on its heading, so a screen reader hears
  // where it is — not on first render (that would take focus on page load).
  const firstStep = React.useRef(true)
  React.useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    heading.current?.focus()
  }, [step])

  async function send() {
    setSending(true)
    try {
      setResult(await onSubmit(values))
    } catch {
      setResult({ status: "error" })
    } finally {
      setSending(false)
      setStep("done")
    }
  }

  return (
    <section
      data-slot="report-form"
      aria-labelledby={`${id}-h`}
      className={cn("grid gap-4 rounded-(--radius-xl) bg-(--card) p-5", className)}
    >
      <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="text-(length:--text-body) font-semibold outline-none">
        {step === "pick" ? title : step === "confirm" ? "이대로 제보할까요?" : "제보 결과"}
      </h2>

      {step === "pick" && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (complete) setStep("confirm")
          }}
        >
          {fields.map((field, index) => {
            const options = optionsOf(field, values)
            const ready = index === 0 || Boolean(values[fields[index - 1].id])
            return (
              <div key={field.id} className="grid gap-1.5">
                <label htmlFor={`${id}-${field.id}`} className="text-(length:--text-caption) text-muted-foreground">
                  {field.label}
                </label>
                <Select
                  id={`${id}-${field.id}`}
                  value={values[field.id] ?? ""}
                  onValueChange={(v) => v && choose(index, v)}
                  disabled={!ready || options.length === 0}
                  items={[{ value: "", label: field.placeholder, disabled: true }, ...options]}
                />
              </div>
            )
          })}
          <Button type="submit" disabled={!complete} className="justify-self-start">
            다음
          </Button>
        </form>
      )}

      {step === "confirm" && (
        <div className="grid gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-(length:--text-body)">
            {fields.map((f) => (
              <React.Fragment key={f.id}>
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd>{labelOf(f)}</dd>
              </React.Fragment>
            ))}
          </dl>
          {check && <div className="min-h-[65px]">{check}</div>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={send} loading={sending} disabled={!verified}>
              제보하기
            </Button>
            <Button variant="outline" onClick={() => setStep("pick")} disabled={sending}>
              고치기
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && <Outcome result={result} onAgain={() => { setValues({}); setResult(null); setStep("pick") }} />}

      {note && <p className="text-(length:--text-caption) text-muted-foreground">{note}</p>}
    </section>
  )
}

function Outcome({ result, onAgain }: { result: ReportResult; onAgain: () => void }) {
  const view =
    result.status === "ok"
      ? { icon: TickCircle, tone: "text-(--success)", title: "제보했어요", text: "같은 내용이 더 모이면 확인됨으로 바뀌어요." }
      : result.status === "duplicate"
        ? { icon: InfoCircle, tone: "text-(--link)", title: "이미 같은 제보가 있어요", text: "같은 서버·지역·품목 제보에 한 표로 더했어요." }
        : result.status === "limited"
          ? {
              icon: Warning,
              tone: "text-(--accent-warm)",
              title: "잠시 뒤에 다시 제보해 주세요",
              text: `너무 많은 제보가 이어져서 ${Math.max(1, Math.ceil(result.retryInSeconds / 60))}분 뒤에 받을 수 있어요.`,
            }
          : { icon: Warning, tone: "text-(--destructive)", title: "보내지 못했어요", text: result.message ?? "연결을 확인하고 다시 시도해 주세요." }
  const Icon = view.icon
  return (
    <div role={result.status === "ok" || result.status === "duplicate" ? "status" : "alert"} className="grid gap-3">
      <p className="flex items-start gap-2">
        <Icon size={20} aria-hidden className={cn("mt-px shrink-0", view.tone)} />
        <span className="grid gap-0.5">
          <strong className="font-semibold">{view.title}</strong>
          <span className="text-muted-foreground">{view.text}</span>
        </span>
      </p>
      <Button variant="outline" onClick={onAgain} className="justify-self-start">
        다른 제보하기
      </Button>
    </div>
  )
}

export { ReportForm }
export type { ReportField, ReportResult, ReportFormProps }
