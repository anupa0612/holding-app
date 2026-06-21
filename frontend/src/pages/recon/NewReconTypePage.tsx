import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { Input } from '../../components/Input'
import { PageHeader } from '../../components/PageHeader'
import { Select } from '../../components/Select'
import { Stepper } from '../../components/Stepper'
import { createAccount, createReconciliation, listAccounts, listBrokers, listReviewerCandidates, me, type Account, type Broker, type ReconType, type User } from '../../lib/api'
import { brokerSupportedReconTypes } from '../../lib/brokers'

function normalizeType(value: string | null): ReconType {
  const v = (value ?? '').toLowerCase()
  if (v === 'position') return 'position'
  if (v === 'fi') return 'fi'
  return 'trade'
}

export function NewReconTypePage() {
  const nav = useNavigate()
  const [params] = useSearchParams()

  const initialType = useMemo(() => normalizeType(params.get('type')), [params])
  const [type, setType] = useState<ReconType>(initialType)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [brokerId, setBrokerId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')

  const selectedBroker = useMemo(() => brokers.find((b) => b.id === brokerId), [brokers, brokerId])
  const supportedTypes = useMemo(
    () => brokerSupportedReconTypes(selectedBroker),
    [selectedBroker],
  )
  const typeSupported = supportedTypes.includes(type)

  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [valueDate, setValueDate] = useState<string>(today)

  const [performer, setPerformer] = useState<string>('')
  const [myUserId, setMyUserId] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [reviewerId, setReviewerId] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meRes = await me()
        if (meRes.user.team === 'Operations') {
          if (!cancelled) setError('Operations users cannot create reconciliations.')
          return
        }
        if (!cancelled) setPerformer(meRes.user.fullName || meRes.user.email)
        if (!cancelled) setMyUserId(meRes.user.id)

        const usersRes = await listReviewerCandidates()
        if (!cancelled) {
          setUsers(usersRes.items)
          setReviewerId(usersRes.items[0]?.id ?? '')
        }

        const res = await listBrokers()
        if (cancelled) return
        setBrokers(res.items)
        if (!brokerId && res.items.length) setBrokerId(res.items[0].id)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load brokers')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!brokerId) {
      setAccounts([])
      setAccountId('')
      return
    }
    ;(async () => {
      try {
        const res = await listAccounts(brokerId)
        if (cancelled) return
        setAccounts(res.items)
        setAccountId(res.items[0]?.id ?? '')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load accounts')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [brokerId])

  useEffect(() => {
    if (!brokerId || supportedTypes.length === 0) return
    if (!supportedTypes.includes(type)) {
      setType(supportedTypes[0])
    }
  }, [brokerId, supportedTypes, type])

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'New reconciliation' }]} />
      <PageHeader
        title="New reconciliation"
        subtitle="Step 1: choose reconciliation type."
        actions={
          <Button variant="secondary" type="button" onClick={() => nav('/')}>
            Back
          </Button>
        }
      />

      {error === 'Operations users cannot create reconciliations.' ? (
        <Card title="Not authorized" subtitle="Operations access is read-only for reviewed reconciliations.">
          <div className="flex items-center justify-end">
            <Button variant="secondary" type="button" onClick={() => nav('/reconciliations/completed')}>
              Go to reviewed reconciliations
            </Button>
          </div>
        </Card>
      ) : null}

      {error === 'Operations users cannot create reconciliations.' ? null : (
      <Card title="Workflow" subtitle="You will complete these steps in order.">
        <Stepper
          activeIndex={0}
          steps={[
            { title: 'Choose type', done: true },
            { title: 'Upload files' },
            { title: 'Preview' },
          ]}
        />
      </Card>
      )}

      {error === 'Operations users cannot create reconciliations.' ? null : (
      <Card title="Step 1" subtitle="Select type, broker and account to continue.">
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              { id: 'trade', label: 'Trade' },
              { id: 'position', label: 'Position' },
              { id: 'fi', label: 'FI' },
            ] as const
          ).map((t) => {
            const enabled = supportedTypes.includes(t.id)
            return (
            <button
              key={t.id}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setType(t.id)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition',
                !enabled
                  ? 'cursor-not-allowed border-slate-800/40 bg-slate-950/10 opacity-60'
                  : t.id === type
                    ? 'border-softblue bg-softblue/10 shadow-chrome'
                    : 'border-slate-800/70 bg-slate-950/20 hover:bg-slate-800/25',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className={t.id === type ? 'text-softblue' : 'text-slate-300'} />
                <div className="text-sm font-semibold text-ink">{t.label} reconciliation</div>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {enabled
                  ? `Start a ${t.label.toLowerCase()} workflow.`
                  : `No backend template for ${selectedBroker?.name ?? 'this broker'} yet.`}
              </div>
            </button>
          )})}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Value Date" required hint="User must select. Used for the reconciliation run.">
            <Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
          </Field>

          <Field label="Rec Date" hint="Auto-picked as today (system date).">
            <Input type="date" value={today} disabled />
          </Field>

          <Field label="Performer" hint="Auto-picked from the logged-in user.">
            <Input value={performer} disabled />
          </Field>

          <Field label="Reviewer" required hint="Select who will review this reconciliation.">
            <Select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} disabled={users.length === 0}>
              {users.filter((u) => u.id !== myUserId && u.team !== 'Operations').length === 0 ? (
                <option value="">No other users available (add another user)</option>
              ) : (
                <option value="">Select reviewer…</option>
              )}
              {users
                .filter((u) => u.id !== myUserId && u.team !== 'Operations')
                .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName?.trim() || u.email}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Broker" required>
            <Select
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              disabled={brokers.length === 0}
            >
              {brokers.length === 0 ? <option value="">No brokers found</option> : null}
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Account"
            required
            hint={accounts.length === 0 ? 'No accounts under this broker. Create one below.' : undefined}
          >
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={!brokerId}>
              {accounts.length === 0 ? <option value="">No accounts</option> : null}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.number ? ` (${a.number})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/20 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Create account</div>
              <div className="mt-1 text-xs text-shellSub">
                Add a new account under the selected broker.
              </div>
            </div>
            <Button
              variant="secondary"
              type="button"
              disabled={!brokerId}
              onClick={() => setCreatingAccount((v) => !v)}
            >
              {creatingAccount ? 'Close' : 'New account'}
            </Button>
          </div>

          {creatingAccount ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Account name" required>
                <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
              </Field>
              <Field label="Account number">
                <Input value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)} />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={!brokerId || !newAccountName.trim() || busy}
                  onClick={async () => {
                    if (!brokerId) return
                    setBusy(true)
                    setError(null)
                    try {
                      const res = await createAccount(brokerId, newAccountName.trim(), newAccountNumber.trim() || undefined)
                      setAccounts((prev) => [res.account, ...prev])
                      setAccountId(res.account.id)
                      setNewAccountName('')
                      setNewAccountNumber('')
                      setCreatingAccount(false)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to create account')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end">
          <Button
            disabled={busy || !brokerId || !accountId || !valueDate || !reviewerId || !typeSupported}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                const created = await createReconciliation(type, brokerId, accountId, valueDate, reviewerId)
                nav(`/reconciliations/${created.id}/upload`)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create reconciliation')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Creating…' : 'Continue'}
          </Button>
        </div>
      </Card>
      )}
    </div>
  )
}

