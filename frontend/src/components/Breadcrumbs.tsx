import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
      {items.map((it, idx) => (
        <div key={`${it.label}-${idx}`} className="flex items-center gap-1">
          {idx > 0 ? <ChevronRight size={14} className="text-slate-300" /> : null}
          {it.to ? (
            <Link className="font-semibold text-slate-600 hover:underline" to={it.to}>
              {it.label}
            </Link>
          ) : (
            <span className="font-semibold text-slate-600">{it.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

