import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { declineReconciliation, listReviewQueue, me, reviewReconciliation, type ReconciliationListItem } from '../../lib/api'
import { formatDateMDY } from '../../lib/dates'
import { formatReconDisplayName } from '../../lib/recon'
import { Field } from '../../components/Field'
import { Modal } from '../../components/Modal'

export function ReviewQueuePage() {
  const nav = useNavigate()
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(true)
  const [items, setItems] = useState<ReconciliationListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineId, setDeclineId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  async function refresh() {
    const res = await listReviewQueue(100)
    setItems(res.items)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const meRes = await me()
        if (meRes.user.team === 'Operations') {
          if (!cancelled) setBlocked(true)
          return
        }
        const res = await listReviewQueue(100)
        if (!cancelled) setItems(res.items)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load review queue')
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
    return `${items.length} reconciliation(s) awaiting your review.`
  }, [busy, items.length])

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Review queue' }]} />
      <PageHeader
        title="Review queue"
        subtitle={subtitle}
        actions={
          <Button variant="secondary" type="button" onClick={() => nav('/')}>
            Back
          </Button>
        }
      />

      {blocked ? (
        <Card title="Not authorized" subtitle="Operations users do not have access to the review queue.">
          <div className="flex justify-end">
            <Button variant="secondary" type="button" onClick={() => nav('/reconciliations/completed')}>
              Go to reviewed reconciliations
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card title="Error">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      {blocked ? null : (
        <Card title="Awaiting review" subtitle="Mark a reconciliation as reviewed once checks are complete.">
          {busy ? (
            <div className="text-sm text-shellSub">Loading…</div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No reconciliations to review"
              subtitle="When performers submit reconciliations for review, they will appear here."
              ctaLabel="Go to dashboard"
              onCta={() => nav('/')}
            />
          ) : (
            <div className="overflow-auto rounded-xl border border-white/6 bg-black/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/20">
                  <tr className="text-xs font-semibold text-slate-200">
                    <th className="px-3 py-2 border-b border-white/6">Reconciliation</th>
                    <th className="px-3 py-2 border-b border-white/6">Value Date</th>
                    <th className="px-3 py-2 border-b border-white/6">Performer</th>
                    <th className="px-3 py-2 border-b border-white/6">Status</th>
                    <th className="px-3 py-2 border-b border-white/6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-white/6 text-slate-200 hover:bg-white/5">
                      <td className="px-3 py-2 font-semibold text-slate-100">{formatReconDisplayName(r)}</td>
                      <td className="px-3 py-2 text-shellSub">{r.valueDate ? formatDateMDY(r.valueDate) : '—'}</td>
                      <td className="px-3 py-2 text-shellSub">{r.performerName ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge variant="info">{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" type="button" onClick={() => nav(`/reconciliations/${r.id}/results`)}>
                            Open
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={marking === r.id}
                            onClick={() => {
                              setDeclineId(r.id)
                              setDeclineReason('')
                              setDeclineOpen(true)
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            type="button"
                            disabled={marking === r.id}
                            onClick={async () => {
                              setMarking(r.id)
                              setError(null)
                              try {
                                await reviewReconciliation(r.id)
                                await refresh()
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Failed to mark reviewed')
                              } finally {
                                setMarking(null)
                              }
                            }}
                          >
                            {marking === r.id ? 'Marking…' : 'Mark reviewed'}
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
      )}

      <Modal
        open={declineOpen}
        title="Decline reconciliation"
        onClose={() => setDeclineOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-shellSub">A reason is required.</div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setDeclineOpen(false)} disabled={Boolean(marking)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={!declineId || !declineReason.trim() || Boolean(marking)}
                onClick={async () => {
                  if (!declineId) return
                  setMarking(declineId)
                  setError(null)
                  try {
                    await declineReconciliation(declineId, declineReason.trim())
                    setDeclineOpen(false)
                    await refresh()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to decline')
                  } finally {
                    setMarking(null)
                  }
                }}
              >
                {marking === declineId ? 'Declining…' : 'Decline'}
              </Button>
            </div>
          </div>
        }
        className="max-w-[860px]"
      >
        <Field label="Reason" required>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"
            placeholder="Explain why this reconciliation is declined…"
          />
        </Field>
      </Modal>
    </div>
  )
}

