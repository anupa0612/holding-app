import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchReconciliations, type ReconciliationListItem } from '../lib/api'
import { formatDateMDY } from '../lib/dates'
import { formatReconDisplayName, reconOpenPath } from '../lib/recon'
import { Badge } from './Badge'

function statusBadgeVariant(s: ReconciliationListItem['status']) {
  if (s === 'reviewed') return 'success' as const
  if (s === 'submitted') return 'info' as const
  if (s === 'declined') return 'danger' as const
  if (s === 'completed') return 'success' as const
  if (s === 'uploaded') return 'warn' as const
  return 'neutral' as const
}

function statusLabel(s: ReconciliationListItem['status']) {
  if (s === 'completed') return 'Built'
  if (s === 'uploaded') return 'Uploaded'
  return s
}

export function ReconSearchBar({ className = '' }: { className?: string }) {
  const nav = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<ReconciliationListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setItems([])
      setBusy(false)
      setError(null)
      return
    }

    let cancelled = false
    setBusy(true)
    setError(null)
    const timer = window.setTimeout(() => {
      searchReconciliations(trimmed, 20)
        .then((res) => {
          if (!cancelled) {
            setItems(res.items)
            setOpen(true)
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setItems([])
            setError(e instanceof Error ? e.message : 'Search failed')
            setOpen(true)
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function openRecon(r: ReconciliationListItem) {
    setOpen(false)
    setQuery('')
    nav(reconOpenPath(r))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'Enter' && items.length > 0) {
      e.preventDefault()
      openRecon(items[0])
    }
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={rootRef} className={['relative', className].join(' ')}>
      <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-black/20 px-4 py-2.5 text-shellSub min-w-[280px] focus-within:border-violet-400/30 focus-within:bg-black/30">
        <Search size={16} className="shrink-0 text-violet-300" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length >= 2) setOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search reviewed reconciliations…"
          aria-label="Search reviewed reconciliations"
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-shellSub focus:outline-none"
        />
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(28,31,41,0.98),rgba(22,24,33,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/6 px-4 py-2.5 text-xs text-shellSub">
            {busy ? 'Searching…' : error ? error : `${items.length} reviewed reconciliation(s) found`}
          </div>
          <div className="max-h-[360px] overflow-auto p-2">
            {!busy && !error && items.length === 0 ? (
              <div className="px-3 py-4 text-sm text-shellSub">No reviewed reconciliations match your search.</div>
            ) : (
              <div className="space-y-1">
                {items.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-white/8 hover:bg-white/5"
                    onClick={() => openRecon(r)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{formatReconDisplayName(r)}</div>
                      <div className="mt-1 truncate text-xs text-shellSub">
                        {[r.brokerName, r.accountName, r.type, r.valueDate ? formatDateMDY(r.valueDate) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
