import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { deleteReconciliation, listMyDrafts, me, type ReconciliationListItem } from '../../lib/api'
import { formatDateMDY } from '../../lib/dates'
import { defaultReconDisplayName } from '../../lib/recon'

function statusBadge(s: ReconciliationListItem['status']) {
  if (s === 'completed') return <Badge variant="success">Built</Badge>
  if (s === 'uploaded') return <Badge variant="warn">Uploaded</Badge>
  return <Badge variant="neutral">Draft</Badge>
}

function continuePath(r: ReconciliationListItem) {
  if (r.status === 'uploaded') return `/reconciliations/${r.id}/build`
  if (r.status === 'completed') return `/reconciliations/${r.id}/results`
  return `/reconciliations/${r.id}/upload`
}

export function DraftsPage() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(true)
  const [items, setItems] = useState<ReconciliationListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isOperations, setIsOperations] = useState(false)

  const refresh = useCallback(async () => {
    const res = await listMyDrafts(80)
    setItems(res.items)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const meRes = await me()
        const ops = meRes.user.team === 'Operations'
        if (!cancelled) setIsOperations(ops)
        if (!ops) {
          const res = await listMyDrafts(80)
          if (!cancelled) setItems(res.items)
        } else if (!cancelled) {
          setItems([])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load drafts')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const subtitle = useMemo(() => {
    if (busy) return 'Loading…'
    if (isOperations) return 'Operations users do not create draft reconciliations.'
    return `${items.length} in-progress reconciliation(s) not yet submitted.`
  }, [busy, items.length, isOperations])

  async function removeDraft(id: string) {
    if (!window.confirm('Delete this draft reconciliation? This cannot be undone.')) return
    setDeletingId(id)
    setError(null)
    try {
      await deleteReconciliation(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete draft')
    } finally {
      setDeletingId((current) => (current === id ? null : current))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Drafts' }]} />
      <PageHeader
        title="Drafts"
        subtitle={subtitle}
        actions={
          <Button variant="secondary" type="button" onClick={() => nav('/')}>
            Back
          </Button>
        }
      />

      {error ? (
        <Card title="Error">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      <Card
        title="My drafts"
        subtitle="Only you can see these. Continue where you left off or delete drafts you no longer need."
      >
        {busy ? (
          <div className="text-sm text-shellSub">Loading…</div>
        ) : isOperations ? (
          <EmptyState
            title="No drafts for Operations users"
            subtitle="Draft reconciliations are created by the Reconciliations team before submission."
            ctaLabel="Go to dashboard"
            onCta={() => nav('/')}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No draft reconciliations"
            subtitle="Start a new reconciliation and it will appear here until you submit it for review."
            ctaLabel="New reconciliation"
            onCta={() => nav('/reconciliations/new')}
          />
        ) : (
          <div className="overflow-auto rounded-xl border border-white/6 bg-black/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20">
                <tr className="text-xs font-semibold text-slate-200">
                  <th className="px-3 py-2 border-b border-white/6">Reconciliation</th>
                  <th className="px-3 py-2 border-b border-white/6">Type</th>
                  <th className="px-3 py-2 border-b border-white/6">Value date</th>
                  <th className="px-3 py-2 border-b border-white/6">Reviewer</th>
                  <th className="px-3 py-2 border-b border-white/6">Status</th>
                  <th className="px-3 py-2 border-b border-white/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-white/6 text-slate-200 hover:bg-white/5">
                    <td className="px-3 py-2 font-semibold text-slate-100">{defaultReconDisplayName(r)}</td>
                    <td className="px-3 py-2 text-shellSub">{r.type}</td>
                    <td className="px-3 py-2 text-shellSub">{r.valueDate ? formatDateMDY(r.valueDate) : '—'}</td>
                    <td className="px-3 py-2 text-shellSub">{r.reviewerName ?? '—'}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" type="button" onClick={() => nav(continuePath(r))}>
                          Continue
                        </Button>
                        <Button
                          variant="danger"
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => removeDraft(r.id)}
                        >
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!isOperations ? (
        <div className="flex justify-end">
          <Button variant="secondary" type="button" onClick={refresh} disabled={busy}>
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  )
}
