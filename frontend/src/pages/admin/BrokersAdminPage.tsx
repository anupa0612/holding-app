import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { Input } from '../../components/Input'
import { PageHeader } from '../../components/PageHeader'
import { Select } from '../../components/Select'
import { createAccount, createBroker, deleteAccount, deleteBroker, listAccounts, listBrokerTemplates, listBrokers, me, type Account, type Broker } from '../../lib/api'
import { brokerSupportedReconTypes } from '../../lib/brokers'
import type { Jurisdiction } from '../../lib/auth'

const BROKER_JURIS: Exclude<Jurisdiction, 'ALL'>[] = ['EU', 'US', 'ME', 'ASIA', 'HK']

export function BrokersAdminPage() {
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [accountsByBroker, setAccountsByBroker] = useState<Record<string, Account[]>>({})

  const [name, setName] = useState('')
  const [jurisdiction, setJurisdiction] = useState<Exclude<Jurisdiction, 'ALL'>>('EU')
  const [positionTemplateKey, setPositionTemplateKey] = useState('eu_settled_holdings')
  const [templateOptions, setTemplateOptions] = useState<{ templateKey: string; reconType: string }[]>([])

  const [selectedBrokerId, setSelectedBrokerId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [deletingBrokerId, setDeletingBrokerId] = useState<string | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

  async function refreshBrokers() {
    const res = await listBrokers()
    setBrokers(res.items)
    const accountResults = await Promise.all(res.items.map((b) => listAccounts(b.id)))
    const next: Record<string, Account[]> = {}
    res.items.forEach((b, i) => {
      next[b.id] = accountResults[i]?.items ?? []
    })
    setAccountsByBroker(next)
    if (!selectedBrokerId && res.items.length) setSelectedBrokerId(res.items[0].id)
    else if (selectedBrokerId && !res.items.some((b) => b.id === selectedBrokerId)) {
      setSelectedBrokerId(res.items[0]?.id ?? '')
    }
  }

  async function removeBroker(broker: Broker) {
    const accountCount = (accountsByBroker[broker.id] ?? []).length
    const msg =
      accountCount > 0
        ? `Delete broker "${broker.name}" and its ${accountCount} account(s)? This cannot be undone.`
        : `Delete broker "${broker.name}"? This cannot be undone.`
    if (!window.confirm(msg)) return

    setDeletingBrokerId(broker.id)
    setError(null)
    try {
      await deleteBroker(broker.id)
      await refreshBrokers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete broker')
    } finally {
      setDeletingBrokerId(null)
    }
  }

  async function removeAccount(broker: Broker, account: Account) {
    const label = account.number ? `${account.name} (${account.number})` : account.name
    if (
      !window.confirm(
        `Delete account "${label}" under ${broker.name}? All reconciliations, results, comments, break history, and uploaded files for this account will be permanently removed. This cannot be undone.`,
      )
    )
      return

    setDeletingAccountId(account.id)
    setError(null)
    try {
      await deleteAccount(broker.id, account.id)
      await refreshBrokers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account')
    } finally {
      setDeletingAccountId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      try {
        const meRes = await me()
        const admin = meRes.user.role === 'admin'
        if (cancelled) return
        setIsAdmin(admin)
        if (!admin) return
        const [, templatesRes] = await Promise.all([refreshBrokers(), listBrokerTemplates()])
        if (!cancelled) {
          const positionTemplates = templatesRes.items.filter((t) => t.reconType === 'position')
          setTemplateOptions(positionTemplates)
          if (positionTemplates.some((t) => t.templateKey === 'eu_settled_holdings')) {
            setPositionTemplateKey('eu_settled_holdings')
          } else if (positionTemplates[0]) {
            setPositionTemplateKey(positionTemplates[0].templateKey)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load brokers')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const canCreateBroker = useMemo(() => name.trim().length > 0, [name])
  const canCreateAccount = useMemo(
    () => selectedBrokerId && accountName.trim().length > 0,
    [selectedBrokerId, accountName],
  )

  if (!isAdmin && !busy) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Brokers" subtitle="Admin-only broker onboarding." />
        <Card title="Not authorized" right={<Badge variant="danger">Admin only</Badge>}>
          <div className="text-sm text-shellSub">Only admins can add brokers and accounts.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brokers"
        subtitle="Register brokers and accounts in the app. Reconciliation file templates are configured in backend code. EU brokers (e.g. CACEIS, Clear Street) appear when logged in with the EU or ALL portal."
        actions={<Badge variant="info">Admin</Badge>}
      />

      <Card title="About broker templates" subtitle="Backend engineering work — not managed in this UI">
        <div className="space-y-2 text-sm text-shellSub">
          <p>Each broker needs a reconciliation template (file parsing + matching logic) implemented in the backend.</p>
          <p>
            After adding a broker here, set <span className="font-mono text-shellText">templateKey</span> on the broker
            document in MongoDB and register the matching builder in{' '}
            <span className="font-mono text-shellText">backend/src/utils/broker_templates.py</span>.
          </p>
          <p>
            Example: add broker name <span className="font-mono text-shellText">Clear Street</span> (not the template key{' '}
            <span className="font-mono text-shellText">clearstreet_holdings</span>). Templates are wired automatically for
            known broker names after a backend restart.
          </p>
        </div>
      </Card>

      {error ? (
        <Card title="Error">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      <Card title="Step 1 — Add broker" subtitle="Brokers appear in the new reconciliation flow for matching jurisdictions.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Broker name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Your EU custodian" />
          </Field>
          <Field label="Jurisdiction">
            <Select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as Exclude<Jurisdiction, 'ALL'>)}>
              {BROKER_JURIS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Position template" hint="File layout for position reconciliations.">
            <Select
              value={positionTemplateKey}
              onChange={(e) => setPositionTemplateKey(e.target.value)}
              disabled={templateOptions.length === 0}
            >
              {templateOptions.length === 0 ? (
                <option value="">No templates registered</option>
              ) : (
                templateOptions.map((t) => (
                  <option key={t.templateKey} value={t.templateKey}>
                    {t.templateKey}
                  </option>
                ))
              )}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              disabled={!canCreateBroker || saving || !positionTemplateKey}
              onClick={async () => {
                setSaving(true)
                setError(null)
                try {
                  await createBroker({
                    name: name.trim(),
                    jurisdiction,
                    positionTemplateKey,
                  })
                  setName('')
                  await refreshBrokers()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to create broker')
                } finally {
                  setSaving(false)
                }
              }}
            >
              Add broker
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Step 2 — Add account" subtitle="Accounts are linked to a broker and used when starting a reconciliation.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Broker">
            <Select value={selectedBrokerId} onChange={(e) => setSelectedBrokerId(e.target.value)}>
              {brokers.length === 0 ? <option value="">No brokers yet</option> : null}
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account name">
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Default Account" />
          </Field>
          <Field label="Account number (optional)">
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. 0001" />
          </Field>
          <div className="flex items-end">
            <Button
              disabled={!canCreateAccount || saving}
              onClick={async () => {
                setSaving(true)
                setError(null)
                try {
                  await createAccount(selectedBrokerId, accountName.trim(), accountNumber.trim() || undefined)
                  setAccountName('')
                  setAccountNumber('')
                  await refreshBrokers()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to create account')
                } finally {
                  setSaving(false)
                }
              }}
            >
              Add account
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Current brokers" subtitle={busy ? 'Loading…' : `${brokers.length} broker(s)`}>
        {brokers.length === 0 ? (
          <div className="text-sm text-shellSub">No brokers yet. Add your first broker above.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {brokers.map((b) => (
              <div key={b.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-shellText">{b.name}</div>
                    {b.jurisdiction ? <Badge variant="info">{b.jurisdiction}</Badge> : null}
                    {brokerSupportedReconTypes(b).length ? (
                      <Badge variant="success">{brokerSupportedReconTypes(b).join(', ')}</Badge>
                    ) : (
                      <Badge variant="warn">no templates</Badge>
                    )}
                  </div>
                  <Button
                    variant="danger"
                    type="button"
                    disabled={saving || deletingBrokerId === b.id}
                    onClick={() => removeBroker(b)}
                  >
                    {deletingBrokerId === b.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
                <div className="mt-2 text-sm text-shellSub">
                  {(accountsByBroker[b.id] ?? []).length === 0 ? (
                    'No accounts yet'
                  ) : (
                    <div className="flex flex-col gap-2">
                      {(accountsByBroker[b.id] ?? []).map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/15 px-3 py-2">
                          <div>
                            {a.name}
                            {a.number ? ` (${a.number})` : ''}
                          </div>
                          <Button
                            variant="danger"
                            type="button"
                            disabled={saving || deletingAccountId === a.id}
                            onClick={() => removeAccount(b, a)}
                          >
                            {deletingAccountId === a.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
