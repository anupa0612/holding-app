import { CheckCircle2 } from 'lucide-react'

export function Stepper({
  steps,
  activeIndex,
}: {
  steps: { title: string; subtitle?: string; done?: boolean }[]
  activeIndex: number
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((s, i) => {
        const active = i === activeIndex
        const done = Boolean(s.done)
        return (
          <div
            key={s.title}
            className={[
              'rounded-xl border px-4 py-3',
              active ? 'border-softblue bg-softblue/5' : 'border-border bg-muted',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600">Step {i + 1}</div>
              {done ? <CheckCircle2 size={16} className="text-success" /> : null}
            </div>
            <div className="mt-1 font-semibold text-ink">{s.title}</div>
            {s.subtitle ? <div className="mt-1 text-xs text-slate-600">{s.subtitle}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

