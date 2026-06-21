import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/Badge'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ResultsTable, type ResultRow } from '../../components/ResultsTable'
import { downloadReconciliationXlsx, getReconciliation, getReconciliationResults, redoReconciliation, submitReconciliation, me } from '../../lib/api'
import { matchesDifferenceFilter, splitRowsByDifference, type DifferenceOperator } from '../../lib/difference'
import { defaultReconDisplayName, formatReconDisplayName, reconDownloadBasename } from '../../lib/recon'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

type Results = Awaited<ReturnType<typeof getReconciliationResults>>

function usernameOnly(value?: string | null) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.includes('@') ? s.split('@')[0] : s
}

function isSamePersonLabel(reconPerformer: unknown, me: { email: string; fullName?: string | null }) {
  const performer = String(reconPerformer ?? '').trim().toLowerCase()
  if (!performer) return false

  const email = (me.email || '').trim()
  const fullName = (me.fullName || '').trim()

  const candidates = new Set(
    [fullName, usernameOnly(fullName), email, usernameOnly(email)]
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  )

  return candidates.has(performer)
}

export function ReconResultsPage() {
  const nav = useNavigate()
  const { reconId } = useParams<{ reconId: string }>()

  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<Results | null>(null)
  const [meta, setMeta] = useState<any>(null)
  const [meUser, setMeUser] = useState<{ email: string; fullName?: string | null; team?: string | null }>({ email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [submitName, setSubmitName] = useState('')
  const [redoing, setRedoing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [tab, setTab] = useState<'breaks' | 'matched'>('breaks')
  const [comments, setComments] = useState<Record<string, any>>({})
  const [filterBrokerIsin, setFilterBrokerIsin] = useState('')
  const [filterAtIsin, setFilterAtIsin] = useState('')
  const [filterDiffOp, setFilterDiffOp] = useState<DifferenceOperator>('none')
  const [filterDiffValue, setFilterDiffValue] = useState('')
  const [needsBuild, setNeedsBuild] = useState(false)
  const [needsUpload, setNeedsUpload] = useState(false)
  useEffect(() => {
    if (!reconId) return
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      setNeedsBuild(false)
      setNeedsUpload(false)
      setRes(null)
      try {
        const [meRes, m] = await Promise.all([me(), getReconciliation(reconId)])
        if (cancelled) return
        setMeUser({ email: meRes.user.email, fullName: meRes.user.fullName, team: meRes.user.team })
        setMeta(m.reconciliation)
        const hasFiles = Boolean(m.reconciliation.ourFileName && m.reconciliation.cpFileName)
        if (m.reconciliation.status === 'draft' || !hasFiles) {
          setNeedsUpload(true)
          return
        }
        if (m.reconciliation.status === 'uploaded') {
          setNeedsBuild(true)
          return
        }
        const r = await getReconciliationResults(reconId, 'all')
        if (cancelled) return
        setRes({
          summary: r.summary,
          matched: r.matched ?? [],
          breaks: r.breaks ?? [],
          comments: r.comments ?? {},
        })
        setComments(r.comments ?? {})
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load results'
        if (msg.toLowerCase().includes('build reconciliation')) {
          setNeedsBuild(true)
          setError(null)
        } else {
          setError(msg)
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reconId])

  const { matched: matchedRows, breaks: breakRows } = useMemo(() => {
    if (!res) return { matched: [], breaks: [] }
    const combined = [...(res.matched ?? []), ...(res.breaks ?? [])] as ResultRow[]
    const unique = new Map<string, ResultRow>()
    for (const row of combined) {
      unique.set(row.rowKey, row)
    }
    return splitRowsByDifference([...unique.values()])
  }, [res])

  const rows = useMemo(() => {
    if (tab === 'matched') return matchedRows
    return breakRows
  }, [tab, matchedRows, breakRows])
  const typedRows = rows as unknown as ResultRow[]

  const debouncedBrokerIsin = useDebouncedValue(filterBrokerIsin, 250)
  const debouncedAtIsin = useDebouncedValue(filterAtIsin, 250)
  const debouncedDiffValue = useDebouncedValue(filterDiffValue, 250)

  const effectiveDiffOp = useMemo((): DifferenceOperator => {
    if (filterDiffOp !== 'none') return filterDiffOp
    return debouncedDiffValue.trim() ? 'eq' : 'none'
  }, [filterDiffOp, debouncedDiffValue])

  const filteredRows = useMemo(() => {
    const b = debouncedBrokerIsin.trim().toUpperCase()
    const a = debouncedAtIsin.trim().toUpperCase()
    return typedRows.filter((r) => {
      const brokerIsin = String(r['Broker ISIN'] ?? '').toUpperCase()
      const atIsin = String(r['AT - ISIN'] ?? '').toUpperCase()
      const okB = !b || brokerIsin.includes(b)
      const okA = !a || atIsin.includes(a)
      const okD = matchesDifferenceFilter(r.Difference, effectiveDiffOp, debouncedDiffValue)
      return okB && okA && okD
    })
  }, [typedRows, debouncedBrokerIsin, debouncedAtIsin, effectiveDiffOp, debouncedDiffValue])

  const hasActiveFilters =
    Boolean(filterBrokerIsin.trim() || filterAtIsin.trim() || filterDiffValue.trim())

  const handleCommentsUpdated = useCallback((rowKey: string, comment: any) => {
    setComments((prev) => ({ ...prev, [rowKey]: comment }))
  }, [])

  if (!reconId) return <div className="text-sm text-shellSub">Missing reconciliation id.</div>

  const canSubmit =
    (meta?.status === 'completed' || meta?.status === 'declined') &&
    isSamePersonLabel(meta?.performerName, meUser)
  const isReviewed = meta?.status === 'reviewed'
  const opsReadOnly =
    meUser.team === 'Operations' && isReviewed && meta?.opsCommentAllowed === false
  const locked =
    ((meta?.status === 'submitted' || isReviewed) && meUser.team !== 'Operations') || opsReadOnly
  const isDeclined = meta?.status === 'declined'

  const displayName = meta ? formatReconDisplayName(meta) : 'Results'

  function defaultSubmitName() {
    if (!meta) return ''
    if (meta.name) return String(meta.name)
    return defaultReconDisplayName(meta)
  }

  async function confirmSubmit() {
    if (!reconId) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await submitReconciliation(reconId, { name: submitName.trim() || undefined })
      setMeta(r.reconciliation)
      setSubmitModalOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit for review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'New reconciliation', to: '/reconciliations/new' },
          { label: displayName },
        ]}
      />

      <PageHeader
        title={displayName}
        subtitle={meta?.name ? `${meta.type ?? 'reconciliation'} results` : 'CACEIS holdings reconciliation (match by ISIN).'}
        actions={
          <div className="flex gap-2">
            {isDeclined ? (
              <>
                <Button variant="secondary" type="button" onClick={() => nav(`/reconciliations/${reconId}/upload`)}>
                  Edit reconciliation
                </Button>
                <Button
                  type="button"
                  disabled={redoing}
                  onClick={async () => {
                    setRedoing(true)
                    setError(null)
                    try {
                      const r = await redoReconciliation(reconId)
                      nav(`/reconciliations/${r.id}/upload`)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to redo reconciliation')
                    } finally {
                      setRedoing(false)
                    }
                  }}
                >
                  {redoing ? 'Redoing…' : 'Redo reconciliation'}
                </Button>
              </>
            ) : null}
            {canSubmit ? (
              <Button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setSubmitName(defaultSubmitName())
                  setSubmitModalOpen(true)
                }}
              >
                Mark completed (send to reviewer)
              </Button>
            ) : null}
            {isReviewed ? (
              <Button
                variant="secondary"
                type="button"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true)
                  setError(null)
                  try {
                    const blob = await downloadReconciliationXlsx(reconId)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${reconDownloadBasename(meta ?? { type: 'reconciliation' }, reconId)}.xlsx`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Download failed')
                  } finally {
                    setDownloading(false)
                  }
                }}
              >
                {downloading ? 'Preparing…' : 'Download XLSX'}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => nav('/')}>
              Back
            </Button>
          </div>
        }
      />

      {opsReadOnly ? (
        <Card title="Read-only">
          <div className="text-sm text-shellSub">
            This is not the latest reviewed reconciliation for this account. Break comments carry forward to the newest
            reviewed run — you can view history here but cannot edit comments on this record.
          </div>
        </Card>
      ) : null}

      <Card
        title="Summary"
        right={<Badge variant={meta?.status === 'reviewed' ? 'success' : meta?.status === 'submitted' ? 'info' : 'neutral'}>{meta?.status ?? '—'}</Badge>}
      >
        {busy ? (
          <div className="text-sm text-shellSub">Loading…</div>
        ) : needsUpload ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-shellSub">Upload internal and counterparty files before viewing results.</div>
            {meUser.team !== 'Operations' ? (
              <Button type="button" onClick={() => nav(`/reconciliations/${reconId}/upload`)}>
                Upload files
              </Button>
            ) : null}
          </div>
        ) : needsBuild ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-shellSub">Files are uploaded. Build the reconciliation to see matched rows and breaks.</div>
            {meUser.team !== 'Operations' ? (
              <Button type="button" onClick={() => nav(`/reconciliations/${reconId}/build`)}>
                Build reconciliation
              </Button>
            ) : null}
          </div>
        ) : error ? (
          <div className="text-sm text-danger">{error}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {['matched', 'breaks', 'totalIsins'].map((k) => (
              <div key={k} className="rounded-xl border border-slate-800/70 bg-slate-950/20 px-4 py-3">
                <div className="text-xs font-semibold text-shellSub">{k}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">
                  {String((res?.summary as any)?.[k] ?? '—')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={submitModalOpen}
        title="Submit for review"
        onClose={() => {
          if (!submitting) setSubmitModalOpen(false)
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" disabled={submitting} onClick={() => setSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={confirmSubmit}>
              {submitting ? 'Submitting…' : 'Submit to reviewer'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-shellSub">
            Optionally rename this reconciliation before sending it to the reviewer. The name appears on the dashboard.
          </p>
          <Field label="Reconciliation name" hint="Leave blank to keep the default label.">
            <Input
              value={submitName}
              onChange={(e) => setSubmitName(e.target.value)}
              placeholder={defaultSubmitName()}
              maxLength={120}
            />
          </Field>
        </div>
      </Modal>

      <Card title="Details">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'breaks', label: 'Breaks' },
              { id: 'matched', label: 'Matched' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'rounded-lg px-3 py-2 text-xs font-semibold',
                tab === t.id
                  ? 'bg-softblue/15 text-slate-100 border border-softblue/40'
                  : 'bg-slate-950/25 text-slate-200 border border-slate-800/70 hover:bg-slate-800/25',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
          </div>
          <div className="text-xs text-shellSub">
            Showing <span className="font-semibold text-slate-100">{filteredRows.length}</span> / {typedRows.length}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/20 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Filter by Broker ISIN">
              <Input
                value={filterBrokerIsin}
                onChange={(e) => setFilterBrokerIsin(e.target.value)}
                placeholder="e.g. DE0006289390"
              />
            </Field>
            <Field label="Filter by AT ISIN">
              <Input
                value={filterAtIsin}
                onChange={(e) => setFilterAtIsin(e.target.value)}
                placeholder="e.g. DE0006289390"
              />
            </Field>
            <div className="flex items-end justify-end">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setFilterBrokerIsin('')
                  setFilterAtIsin('')
                  setFilterDiffOp('none')
                  setFilterDiffValue('')
                }}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
            <Field label="Difference compare">
              <Select
                value={filterDiffOp}
                onChange={(e) => setFilterDiffOp(e.target.value as DifferenceOperator)}
              >
                <option value="none">Any difference</option>
                <option value="eq">Equal to</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
              </Select>
            </Field>
            <Field
              label="Difference amount"
              hint={filterDiffOp === 'none' ? 'Enter an amount (defaults to equal to).' : undefined}
            >
              <Input
                value={filterDiffValue}
                onChange={(e) => setFilterDiffValue(e.target.value)}
                placeholder="e.g. 0 or 100.5"
                inputMode="decimal"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4">
          {busy ? (
            <div className="text-sm text-shellSub">Loading…</div>
          ) : needsUpload || needsBuild ? (
            <div className="text-sm text-shellSub">Results will appear here after the reconciliation is built.</div>
          ) : error ? (
            <div className="text-sm text-danger">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="text-sm text-shellSub">No rows in this section.</div>
          ) : (
            <ResultsTable
              reconId={reconId}
              rows={filteredRows}
              comments={comments}
              mode={tab}
              locked={locked}
              onCommentsUpdated={handleCommentsUpdated}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

