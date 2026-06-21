import { useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Badge } from '../../components/Badge'

import { Breadcrumbs } from '../../components/Breadcrumbs'

import { Button } from '../../components/Button'

import { Card } from '../../components/Card'

import { EmptyState } from '../../components/EmptyState'

import { Field } from '../../components/Field'

import { Modal } from '../../components/Modal'

import { PageHeader } from '../../components/PageHeader'

import { Select } from '../../components/Select'

import {
  downloadReconciliationXlsx,
  listMyCompleted,
  listReviewed,
  listReviewerCandidates,
  me,
  updateReconciliationReviewer,
  type ReconciliationListItem,
  type User,
} from '../../lib/api'

import { formatDateMDY } from '../../lib/dates'

import { formatReconDisplayName, reconDownloadBasename } from '../../lib/recon'

function statusBadge(s: ReconciliationListItem['status']) {
  if (s === 'reviewed') return <Badge variant="success">Reviewed</Badge>
  if (s === 'submitted') return <Badge variant="info">Submitted</Badge>
  if (s === 'declined') return <Badge variant="danger">Declined</Badge>
  return <Badge variant="neutral">{s}</Badge>
}

function canChangeReviewer(r: ReconciliationListItem) {
  return r.status === 'submitted' || r.status === 'declined'
}

export function CompletedReconsPage() {
  const nav = useNavigate()

  const [busy, setBusy] = useState(true)
  const [items, setItems] = useState<ReconciliationListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [isOperations, setIsOperations] = useState(false)
  const [opsDays, setOpsDays] = useState<1 | 7>(1)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [reviewerCandidates, setReviewerCandidates] = useState<User[]>([])
  const [changeReviewerOpen, setChangeReviewerOpen] = useState(false)
  const [changeReviewerTarget, setChangeReviewerTarget] = useState<ReconciliationListItem | null>(null)
  const [selectedReviewerId, setSelectedReviewerId] = useState('')
  const [changeReviewerBusy, setChangeReviewerBusy] = useState(false)
  const [changeReviewerError, setChangeReviewerError] = useState<string | null>(null)

  async function refresh() {
    const res = isOperations ? await listReviewed(80, opsDays) : await listMyCompleted(80)
    setItems(res.items)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const meRes = await me()
        const ops = meRes.user.team === 'Operations'
        if (!cancelled) {
          setIsOperations(ops)
          setMyUserId(meRes.user.id)
        }

        const [res, usersRes] = await Promise.all([
          ops ? listReviewed(80, opsDays) : listMyCompleted(80),
          ops ? Promise.resolve({ items: [] as User[] }) : listReviewerCandidates(),
        ])

        if (!cancelled) {
          setItems(res.items)
          setReviewerCandidates(usersRes.items)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load completed reconciliations')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opsDays])

  const eligibleReviewers = useMemo(
    () => reviewerCandidates.filter((u) => u.id !== myUserId && u.team !== 'Operations'),
    [reviewerCandidates, myUserId],
  )

  const subtitle = useMemo(() => {
    if (busy) return 'Loading…'
    if (isOperations) return `${items.length} reviewed reconciliation(s).`
    const submitted = items.filter((i) => i.status === 'submitted').length
    const reviewed = items.filter((i) => i.status === 'reviewed').length
    return `${items.length} reconciliation(s) — ${submitted} submitted, ${reviewed} reviewed.`
  }, [busy, items, isOperations])

  function openChangeReviewer(r: ReconciliationListItem) {
    setChangeReviewerTarget(r)
    setSelectedReviewerId(r.reviewerId ?? '')
    setChangeReviewerError(null)
    setChangeReviewerOpen(true)
  }

  function closeChangeReviewer(force = false) {
    if (changeReviewerBusy && !force) return
    setChangeReviewerOpen(false)
    setChangeReviewerTarget(null)
    setSelectedReviewerId('')
    setChangeReviewerError(null)
  }

  async function saveChangeReviewer() {
    if (!changeReviewerTarget || !selectedReviewerId) return
    setChangeReviewerBusy(true)
    setChangeReviewerError(null)
    try {
      const res = await updateReconciliationReviewer(changeReviewerTarget.id, selectedReviewerId)
      setItems((prev) => prev.map((item) => (item.id === res.reconciliation.id ? res.reconciliation : item)))
      setChangeReviewerBusy(false)
      closeChangeReviewer(true)
    } catch (e) {
      setChangeReviewerError(e instanceof Error ? e.message : 'Failed to change reviewer')
      setChangeReviewerBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Completed' }]} />
      <PageHeader
        title="Completed"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {isOperations ? (
              <>
                <Button variant={opsDays === 1 ? 'secondary' : 'ghost'} type="button" onClick={() => setOpsDays(1)}>
                  Today
                </Button>
                <Button variant={opsDays === 7 ? 'secondary' : 'ghost'} type="button" onClick={() => setOpsDays(7)}>
                  Last 7 days
                </Button>
              </>
            ) : null}
            <Button variant="secondary" type="button" onClick={() => nav('/')}>
              Back
            </Button>
          </div>
        }
      />

      {error ? (
        <Card title="Error">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      <Card
        title={isOperations ? 'Reviewed reconciliations' : 'My completed reconciliations'}
        subtitle={
          isOperations
            ? 'Operations users can view reviewed reconciliations. Break comments can only be added on the latest reviewed run per account; older runs are read-only.'
            : 'Submitted items await reviewer approval. Download is available once status is Reviewed.'
        }
      >
        {busy ? (
          <div className="text-sm text-shellSub">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title={isOperations ? 'No reviewed reconciliations yet' : 'No completed reconciliations yet'}
            subtitle={
              isOperations
                ? 'Reconciliations reviewed by the Reconciliations team will appear here for you to check and add break comments.'
                : 'When you submit a reconciliation for review, it will appear here as Submitted until the reviewer approves it.'
            }
            ctaLabel={isOperations ? undefined : 'Start new reconciliation'}
            onCta={isOperations ? undefined : () => nav('/reconciliations/new')}
          />
        ) : (
          <div className="overflow-auto rounded-xl border border-white/6 bg-black/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/20">
                <tr className="text-xs font-semibold text-slate-200">
                  <th className="px-3 py-2 border-b border-white/6">Reconciliation</th>
                  <th className="px-3 py-2 border-b border-white/6">Value Date</th>
                  <th className="px-3 py-2 border-b border-white/6">Reviewer</th>
                  <th className="px-3 py-2 border-b border-white/6">Status</th>
                  <th className="px-3 py-2 border-b border-white/6">Decline reason</th>
                  <th className="px-3 py-2 border-b border-white/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-white/6 text-slate-200 hover:bg-white/5">
                    <td className="px-3 py-2 font-semibold text-slate-100">{formatReconDisplayName(r)}</td>
                    <td className="px-3 py-2 text-shellSub">{r.valueDate ? formatDateMDY(r.valueDate) : '—'}</td>
                    <td className="px-3 py-2 text-shellSub">{r.reviewerName ?? '—'}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2 text-shellSub">{r.status === 'declined' ? r.declineReason ?? '—' : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" type="button" onClick={() => nav(`/reconciliations/${r.id}/results`)}>
                          Open
                        </Button>
                        {!isOperations && canChangeReviewer(r) ? (
                          <Button variant="secondary" type="button" onClick={() => openChangeReviewer(r)}>
                            Change reviewer
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={r.status !== 'reviewed' || downloading === r.id}
                          title={r.status !== 'reviewed' ? 'Download available after reviewer approval' : undefined}
                          onClick={async () => {
                            setDownloading(r.id)
                            setError(null)
                            try {
                              const blob = await downloadReconciliationXlsx(r.id)
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${reconDownloadBasename(r, r.id)}.xlsx`
                              document.body.appendChild(a)
                              a.click()
                              a.remove()
                              URL.revokeObjectURL(url)
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Download failed')
                            } finally {
                              setDownloading(null)
                            }
                          }}
                        >
                          {downloading === r.id ? 'Preparing…' : 'Download XLSX'}
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

      <div className="flex justify-end">
        <Button variant="secondary" type="button" onClick={refresh} disabled={busy}>
          Refresh
        </Button>
      </div>

      <Modal
        open={changeReviewerOpen}
        title="Change reviewer"
        description={
          changeReviewerTarget?.status === 'submitted'
            ? 'The new reviewer will see this reconciliation in their review queue.'
            : 'The new reviewer will be assigned when you resubmit this reconciliation.'
        }
        onClose={closeChangeReviewer}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={closeChangeReviewer} disabled={changeReviewerBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={
                changeReviewerBusy ||
                !selectedReviewerId ||
                selectedReviewerId === changeReviewerTarget?.reviewerId
              }
              onClick={saveChangeReviewer}
            >
              {changeReviewerBusy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {changeReviewerError ? <div className="mb-4 text-sm text-danger">{changeReviewerError}</div> : null}
        <Field label="Reviewer" required hint="Select who will review this reconciliation.">
          <Select
            value={selectedReviewerId}
            onChange={(e) => setSelectedReviewerId(e.target.value)}
            disabled={eligibleReviewers.length === 0}
          >
            {eligibleReviewers.length === 0 ? (
              <option value="">No other users available</option>
            ) : (
              <option value="">Select reviewer…</option>
            )}
            {eligibleReviewers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName?.trim() || u.email}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>
    </div>
  )
}
