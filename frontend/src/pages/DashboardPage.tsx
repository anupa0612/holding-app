import { useCallback, useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Badge } from '../components/Badge'

import { Button } from '../components/Button'

import { Card } from '../components/Card'

import { EmptyState } from '../components/EmptyState'

import { KpiCard } from '../components/KpiCard'

import { PageHeader } from '../components/PageHeader'

import { ArrowRightLeft, Landmark, Layers, Clock, Eye } from 'lucide-react'

import {

  listAccounts,

  listBrokers,

  listDashboardReviewed,

  listRegisteredReconTypes,

  listTodayReconciliations,

  me,

  reconDashboardCommentRowKey,

  saveReconComment,

  type Account,

  type Broker,

  type ReconStatus,

  type ReconType,

  type ReconciliationListItem,

} from '../lib/api'

import { getJurisdiction } from '../lib/auth'

import { formatDateMDY } from '../lib/dates'
import { formatReconDisplayName } from '../lib/recon'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'



function reconStatusBadge(status: ReconStatus | 'none') {
  if (status === 'none') return <Badge variant="neutral">Not started</Badge>
  if (status === 'reviewed') return <Badge variant="success">Reviewed</Badge>
  if (status === 'submitted') return <Badge variant="info">Submitted</Badge>
  if (status === 'declined') return <Badge variant="danger">Declined</Badge>
  if (status === 'completed') return <Badge variant="warn">Built</Badge>
  if (status === 'uploaded') return <Badge variant="info">Uploaded</Badge>
  return <Badge variant="neutral">{status}</Badge>
}

function reconTargetPath(recon: ReconciliationListItem) {
  if (recon.status === 'draft' || recon.status === 'uploaded') {
    return `/reconciliations/${recon.id}/upload`
  }
  if (recon.status === 'completed' || recon.status === 'declined') {
    return `/reconciliations/${recon.id}/build`
  }
  return `/reconciliations/${recon.id}/results`
}


function ReconCard({

  title,

  subtitle,

  icon,

  onClick,

  disabled = false,

}: {

  title: string

  subtitle: string

  icon: React.ReactNode

  onClick: () => void

  disabled?: boolean

}) {

  return (

    <button

      type="button"

      disabled={disabled}

      onClick={onClick}

      className={[

        'group relative overflow-hidden rounded-[26px] border p-5 text-left shadow-[0_22px_44px_rgba(0,0,0,0.30)] transition duration-200',

        disabled

          ? 'cursor-not-allowed border-white/4 bg-black/20 opacity-60'

          : 'border-white/6 bg-[linear-gradient(180deg,rgba(34,37,48,0.96),rgba(23,25,34,0.98))] hover:-translate-y-1 hover:border-violet-400/25',

      ].join(' ')}

    >

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent" />

      <div className="flex items-start justify-between gap-3">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/12 text-violet-300 shadow-[0_12px_26px_rgba(168,85,247,0.16)]">

            {icon}

          </div>

          <div>

            <div className="text-sm font-semibold text-slate-100">{title}</div>

            <div className="mt-1 text-sm text-shellSub">{subtitle}</div>

          </div>

        </div>

        <div className="mt-1 text-slate-500/70 transition group-hover:text-violet-300">→</div>

      </div>

    </button>

  )

}



export function DashboardPage() {

  const nav = useNavigate()

  const [loading, setLoading] = useState(true)

  const [items, setItems] = useState<ReconciliationListItem[]>([])

  const [chartItems, setChartItems] = useState<ReconciliationListItem[]>([])

  const [brokers, setBrokers] = useState<Broker[]>([])

  const [accountsByBroker, setAccountsByBroker] = useState<Record<string, Account[]>>({})

  const [todayRecs, setTodayRecs] = useState<ReconciliationListItem[]>([])

  const [error, setError] = useState<string | null>(null)

  const [registeredTypes, setRegisteredTypes] = useState<ReconType[]>([])

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)

  const [isOperations, setIsOperations] = useState(false)

  const jurisdiction = getJurisdiction() ?? 'ALL'

  const jurisdictionSubtitle =
    jurisdiction === 'ALL'
      ? 'Reviewed reconciliations today across every jurisdiction.'
      : `${jurisdiction} reconciliations reviewed today.`



  const refresh = useCallback(async () => {

    setLoading(true)

    setError(null)

    try {

      const [res, chartRes, typesRes, brokersRes, todayRes] = await Promise.all([

        listDashboardReviewed(100),

        listDashboardReviewed(200, 7),

        listRegisteredReconTypes(),

        listBrokers(),

        listTodayReconciliations(),

      ])

      const reviewedOnly = (rows: ReconciliationListItem[]) =>
        rows.filter((r) => r.status === 'reviewed')

      setItems(reviewedOnly(res.items))

      setChartItems(reviewedOnly(chartRes.items))

      setRegisteredTypes(typesRes.items.map((x) => x.type))

      setBrokers(brokersRes.items)

      setTodayRecs(todayRes.items)

      const accountResults = await Promise.all(brokersRes.items.map((b) => listAccounts(b.id)))

      const nextAccounts: Record<string, Account[]> = {}

      brokersRes.items.forEach((b, i) => {
        nextAccounts[b.id] = accountResults[i]?.items ?? []
      })

      setAccountsByBroker(nextAccounts)

      const drafts: Record<string, string> = {}

      for (const r of res.items) {

        drafts[r.id] = r.dashboardComment ?? ''

      }

      setCommentDrafts(drafts)

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Failed to load reconciliations')

    } finally {

      setLoading(false)

    }

  }, [])



  useEffect(() => {

    let cancelled = false

    ;(async () => {

      await refresh()

      if (cancelled) return

    })()

    return () => {

      cancelled = true

    }

  }, [refresh])



  useEffect(() => {

    let cancelled = false

    ;(async () => {

      try {

        const r = await me()

        if (!cancelled) setIsOperations(r.user.team === 'Operations')

      } catch {

        if (!cancelled) setIsOperations(false)

      }

    })()

    return () => {

      cancelled = true

    }

  }, [])



  const typeEnabled = (t: ReconType) => registeredTypes.includes(t)



  const kpis = useMemo(() => {
    const reviewedToday = items.length
    return { reviewedToday }
  }, [items])



  const last7 = useMemo(() => {

    const days: { key: string; label: string; count: number }[] = []

    const now = new Date()

    for (let i = 6; i >= 0; i--) {

      const d = new Date(now)

      d.setDate(now.getDate() - i)

      const key = d.toISOString().slice(0, 10)

      const label = d.toLocaleDateString(undefined, { weekday: 'short' })

      days.push({ key, label, count: 0 })

    }

    for (const it of chartItems) {

      const when = it.reviewedAt || it.updatedAt || it.createdAt

      if (!when) continue

      const key = new Date(when).toISOString().slice(0, 10)

      const row = days.find((x) => x.key === key)

      if (row) row.count += it.breakCount ?? 0

    }

    return days

  }, [chartItems])



  const brokerOverview = useMemo(() => {
    const recByAccount = new Map<string, ReconciliationListItem>()
    for (const r of todayRecs) {
      if (!r.accountId) continue
      const existing = recByAccount.get(r.accountId)
      if (!existing || (r.updatedAt || '') > (existing.updatedAt || '')) {
        recByAccount.set(r.accountId, r)
      }
    }

    const rows: {
      brokerId: string
      brokerName: string
      accountId: string
      accountName: string
      accountNumber?: string | null
      recon: ReconciliationListItem | null
    }[] = []

    for (const broker of brokers) {
      const accounts = accountsByBroker[broker.id] ?? []
      if (accounts.length === 0) {
        rows.push({
          brokerId: broker.id,
          brokerName: broker.name,
          accountId: '',
          accountName: '—',
          recon: null,
        })
        continue
      }
      for (const account of accounts) {
        rows.push({
          brokerId: broker.id,
          brokerName: broker.name,
          accountId: account.id,
          accountName: account.name,
          accountNumber: account.number,
          recon: recByAccount.get(account.id) ?? null,
        })
      }
    }

    return rows
  }, [brokers, accountsByBroker, todayRecs])



  function statusBadge() {
    return <Badge variant="success">Reviewed</Badge>
  }



  async function saveDashboardComment(reconId: string) {

    const text = (commentDrafts[reconId] ?? '').trim()

    const stored = (items.find((x) => x.id === reconId)?.dashboardComment ?? '').trim()

    if (text === stored) return

    setSavingCommentId(reconId)

    setError(null)

    try {

      await saveReconComment(reconId, reconDashboardCommentRowKey(reconId), { comment: text })

      setItems((prev) =>

        prev.map((r) => (r.id === reconId ? { ...r, dashboardComment: text } : r)),

      )

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Failed to save comment')

    } finally {

      setSavingCommentId((id) => (id === reconId ? null : id))

    }

  }



  return (

    <div className="flex flex-col gap-6">

      <PageHeader

        title="Dashboard"

        subtitle={jurisdictionSubtitle}

      />



      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        <KpiCard
          label="Reviewed today"
          value={kpis.reviewedToday}
          loading={loading}
          sub={jurisdiction === 'ALL' ? 'All jurisdictions' : `${jurisdiction} jurisdiction`}
        />

      </div>



      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">

        <Card

          title="Operations overview"

          subtitle="A quick visual pulse of the platform and where you can act next."

          right={<Badge variant="success">Live</Badge>}

        >

          <div className="grid gap-4 md:grid-cols-3">

            <div className="rounded-[22px] border border-violet-400/15 bg-violet-500/8 px-4 py-4">

              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">Flow</div>

              <div className="mt-2 text-lg font-semibold text-slate-50">{isOperations ? 'Review breaks' : 'Create to review'}</div>

              <div className="mt-2 text-sm leading-6 text-shellSub">{isOperations ? 'Open reviewed reconciliations, inspect breaks, and add the required commentary.' : 'Start new runs, upload files, build reconciliations, and send clean outputs for review.'}</div>

            </div>

            <div className="rounded-[22px] border border-fuchsia-400/15 bg-fuchsia-500/8 px-4 py-4">

              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/90">Breaks</div>

              <div className="mt-2 text-lg font-semibold text-slate-50">Structured tracking</div>

              <div className="mt-2 text-sm leading-6 text-shellSub">Capture break type, owner, priority, and query context inside the reconciliation table.</div>

            </div>

            <div className="rounded-[22px] border border-white/6 bg-black/12 px-4 py-4">

              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shellSub">Visibility</div>

              <div className="mt-2 text-lg font-semibold text-slate-50">Jurisdiction-wide</div>

              <div className="mt-2 text-sm leading-6 text-shellSub">See performer and reviewer for every reconciliation in your jurisdiction.</div>

            </div>

          </div>

        </Card>



        <Card title="Quick summary" subtitle="Current operational snapshot." right={<Badge variant="info">{jurisdiction}</Badge>}>

          <div className="space-y-4">

            <div className="flex items-center justify-between rounded-[22px] border border-white/6 bg-black/12 px-4 py-3">

              <div>

                <div className="text-xs font-semibold text-shellSub">Reviewed today</div>

                <div className="mt-1 text-lg font-semibold text-slate-50">{kpis.reviewedToday}</div>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-300">

                <ArrowRightLeft size={18} />

              </div>

            </div>

            <div className="flex items-center justify-between rounded-[22px] border border-white/6 bg-black/12 px-4 py-3">

              <div>

                <div className="text-xs font-semibold text-shellSub">Jurisdiction</div>

                <div className="mt-1 text-lg font-semibold text-slate-50">{jurisdiction}</div>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-500/12 text-fuchsia-300">

                <Clock size={18} />

              </div>

            </div>

          </div>

        </Card>

      </div>



      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">

        <Card

          title="Activity (last 7 days)"

          subtitle="Total breaks in reviewed reconciliations, day by day (all brokers)."

          right={<Badge variant="info">Auto</Badge>}

        >

          <div className="h-48 w-full">

            <ResponsiveContainer width="100%" height="100%">

              <AreaChart data={last7} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>

                <defs>

                  <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">

                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.38} />

                    <stop offset="100%" stopColor="#EC4899" stopOpacity={0.08} />

                  </linearGradient>

                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.10)" />

                <XAxis dataKey="label" tickLine={false} axisLine={false} />

                <YAxis allowDecimals={false} width={26} tickLine={false} axisLine={false} />

                <Tooltip

                  contentStyle={{

                    borderRadius: 12,

                    borderColor: 'rgba(255,255,255,0.12)',

                    background: 'rgba(2,6,23,0.85)',

                    color: '#E5E7EB',

                  }}

                  labelStyle={{ fontWeight: 700, color: '#E5E7EB' }}

                  formatter={(value: number) => [`${value}`, 'Breaks']}

                />

                <Area type="monotone" dataKey="count" name="Breaks" stroke="#A855F7" fill="url(#fillBlue)" strokeWidth={2.5} />

              </AreaChart>

            </ResponsiveContainer>

          </div>

        </Card>



        <Card
          title="Today's reconciliations"
          subtitle="Brokers, accounts, and rec status for today (rec date)."
          right={<Badge variant="info">{jurisdiction}</Badge>}
        >
          <div className="max-h-52 overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
                <tr className="text-xs font-semibold text-slate-400">
                  <th className="px-3 py-2">Broker</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-shellSub" colSpan={3}>
                      Loading…
                    </td>
                  </tr>
                ) : brokerOverview.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-shellSub" colSpan={3}>
                      No brokers configured for this jurisdiction.
                    </td>
                  </tr>
                ) : (
                  brokerOverview.map((row, idx) => (
                    <tr
                      key={`${row.brokerId}-${row.accountId || idx}`}
                      className={[
                        'border-t border-slate-800/70 text-slate-200',
                        row.recon ? 'cursor-pointer hover:bg-slate-800/25' : '',
                      ].join(' ')}
                      onClick={() => {
                        if (row.recon) nav(reconTargetPath(row.recon))
                      }}
                    >
                      <td className="px-3 py-2 font-medium text-slate-100">{row.brokerName}</td>
                      <td className="px-3 py-2 text-shellSub">
                        {row.accountName}
                        {row.accountNumber ? ` (${row.accountNumber})` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {reconStatusBadge(row.recon?.status ?? 'none')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>



      {!isOperations ? (
      <div className="grid gap-4 md:grid-cols-3">

        <ReconCard

          title="Trade Reconciliation"

          subtitle={typeEnabled('trade') ? 'Compare trades between internal and broker files.' : 'Backend template not available yet.'}

          icon={<ArrowRightLeft size={18} />}

          disabled={!typeEnabled('trade')}

          onClick={() => nav('/reconciliations/new?type=trade')}

        />

        <ReconCard

          title="Position Reconciliation"

          subtitle="Compare holdings/positions and identify breaks."

          icon={<Layers size={18} />}

          disabled={!typeEnabled('position')}

          onClick={() => nav('/reconciliations/new?type=position')}

        />

        <ReconCard

          title="FI Reconciliation"

          subtitle={typeEnabled('fi') ? 'Fixed income-focused comparison and breaks.' : 'Backend template not available yet.'}

          icon={<Landmark size={18} />}

          disabled={!typeEnabled('fi')}

          onClick={() => nav('/reconciliations/new?type=fi')}

        />

      </div>
      ) : null}



      <Card

        title="Reviewed reconciliations"

        subtitle={`${jurisdictionSubtitle} Add dashboard notes per reconciliation.`}

      >

        {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}



        <div className="mt-2 overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20">

          <table className="min-w-full text-left text-sm">

            <thead className="bg-slate-950/40">

              <tr className="text-xs font-semibold text-slate-700">

                <th className="px-3 py-2 text-slate-200">Name</th>

                <th className="px-3 py-2 text-slate-200">Type</th>

                <th className="px-3 py-2 text-slate-200">Status</th>

                <th className="px-3 py-2 text-slate-200">Performer</th>

                <th className="px-3 py-2 text-slate-200">Reviewer</th>

                <th className="px-3 py-2 text-slate-200">Value date</th>

                <th className="px-3 py-2 text-slate-200">Broker / Account</th>

                <th className="px-3 py-2 text-slate-200 min-w-[220px]">Comment</th>

                <th className="px-3 py-2 text-right text-slate-200">Actions</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td className="px-3 py-3 text-shellSub" colSpan={9}>

                    Loading…

                  </td>

                </tr>

              ) : items.length === 0 ? (

                <tr>

                  <td className="px-3 py-6 text-shellSub" colSpan={9}>

                    <EmptyState

                      title="No reviewed reconciliations today"

                      subtitle={
                        jurisdiction === 'ALL'
                          ? 'Reconciliations reviewed today will appear here.'
                          : `${jurisdiction} reconciliations reviewed today will appear here.`
                      }

                      ctaLabel={isOperations ? undefined : 'Create reconciliation'}

                      onCta={isOperations ? undefined : () => nav('/reconciliations/new')}

                    />

                  </td>

                </tr>

              ) : (

                items.map((r) => (

                  <tr key={r.id} className="border-t border-slate-800/70 text-slate-200 hover:bg-slate-800/25 align-top">

                    <td className="px-3 py-2 font-semibold text-slate-100">{formatReconDisplayName(r)}</td>

                    <td className="px-3 py-2 font-semibold text-slate-100">{r.type}</td>

                    <td className="px-3 py-2">

                      {statusBadge()}

                    </td>

                    <td className="px-3 py-2 text-shellSub whitespace-nowrap">{r.performerName ?? '—'}</td>

                    <td className="px-3 py-2 text-shellSub whitespace-nowrap">{r.reviewerName ?? '—'}</td>

                    <td className="px-3 py-2 text-xs text-shellSub whitespace-nowrap">

                      {r.valueDate ? formatDateMDY(r.valueDate) : '—'}

                    </td>

                    <td className="px-3 py-2 text-xs text-shellSub">

                      <div>{r.brokerName ?? '—'}</div>

                      <div className="text-shellSub">{r.accountName ?? '—'}</div>

                    </td>

                    <td className="px-3 py-2">

                      <textarea

                        value={commentDrafts[r.id] ?? ''}

                        onChange={(e) =>

                          setCommentDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))

                        }

                        onBlur={() => saveDashboardComment(r.id)}

                        placeholder="Add dashboard note…"

                        rows={2}

                        className="w-full min-w-[200px] resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"

                      />

                      {savingCommentId === r.id ? (

                        <div className="mt-1 text-[11px] text-shellSub">Saving…</div>

                      ) : null}

                    </td>

                    <td className="px-3 py-2">

                      <div className="flex justify-end">

                        <Button variant="secondary" type="button" onClick={() => nav(`/reconciliations/${r.id}/results`)}>

                          <span className="inline-flex items-center gap-1.5">

                            <Eye size={14} />

                            Results

                          </span>

                        </Button>

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </Card>

    </div>

  )

}


