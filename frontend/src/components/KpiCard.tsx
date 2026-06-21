import { Card } from './Card'
import { Skeleton } from './Skeleton'

export function KpiCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value?: string | number
  sub?: string
  loading?: boolean
}) {
  return (
    <Card
      title={label}
      subtitle={sub}
      right={<div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,0.5)]" />}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
      ) : (
        <div className="dashboard-accent-card rounded-[22px] px-5 py-5">
          <div className="text-4xl font-semibold tracking-tight text-slate-50">{value ?? '—'}</div>
          <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/75">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
            Live snapshot
          </div>
        </div>
      )}
    </Card>
  )
}

