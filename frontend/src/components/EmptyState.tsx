import { Button } from './Button'

export function EmptyState({
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  title: string
  subtitle: string
  ctaLabel?: string
  onCta?: () => void
}) {
  const showCta = Boolean(ctaLabel && onCta)
  return (
    <div className={showCta ? 'grid gap-6 md:grid-cols-[1fr_240px] md:items-center' : 'grid gap-6'}>
      <div>
        <div className="text-base font-semibold text-slate-100">{title}</div>
        <div className="mt-1 text-sm leading-6 text-shellSub">{subtitle}</div>
        {showCta ? (
          <div className="mt-4">
            <Button onClick={onCta}>{ctaLabel}</Button>
          </div>
        ) : null}
      </div>

      {showCta ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/25 p-4">
          <div className="text-xs font-semibold text-shellSub">Getting started</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-softblue" />
              Upload internal + broker files
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-softblue" />
              Build reconciliation
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-softblue" />
              Map columns (next)
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}

