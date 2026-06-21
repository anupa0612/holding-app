import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Stepper } from '../../components/Stepper'
import { buildReconciliation, getReconciliation, me, type ReconType, type ReconciliationListItem } from '../../lib/api'
import { formatReconDisplayName } from '../../lib/recon'

export function ReconBuildPage() {
  const nav = useNavigate()
  const { reconId } = useParams<{ reconId: string }>()

  const [busy, setBusy] = useState(true)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [reconType, setReconType] = useState<ReconType>('position')
  const [hasFiles, setHasFiles] = useState(false)
  const [meta, setMeta] = useState<ReconciliationListItem | null>(null)

  useEffect(() => {
    if (!reconId) return
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
        const reconRes = await getReconciliation(reconId)
        if (cancelled) return
        setMeta(reconRes.reconciliation)
        if (reconRes.reconciliation.type) {
          setReconType(reconRes.reconciliation.type as ReconType)
        }
        setHasFiles(Boolean(reconRes.reconciliation.ourFileName && reconRes.reconciliation.cpFileName))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load reconciliation')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reconId])

  if (!reconId) {
    return <div className="text-sm text-slate-600">Missing reconciliation id.</div>
  }

  const displayName = meta ? formatReconDisplayName(meta) : reconId

  if (blocked) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Build' }]} />
        <PageHeader title="Build" subtitle="Not authorized." actions={<Button variant="secondary" onClick={() => nav('/')}>Back</Button>} />
        <Card title="Operations access">
          <div className="text-sm text-shellSub">Operations users cannot build reconciliations. You can view reviewed reconciliations and add comments.</div>
        </Card>
      </div>
    )
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
        title={meta?.name ? displayName : 'Build reconciliation'}
        subtitle={`Run the ${reconType} comparison on uploaded files.`}
        actions={
          <Button variant="secondary" type="button" onClick={() => nav(`/reconciliations/${reconId}/upload`)}>
            Back
          </Button>
        }
      />

      <Card title="Workflow" subtitle={displayName}>
        <Stepper
          activeIndex={2}
          steps={[
            { title: 'Choose type', done: true },
            { title: 'Upload files', done: hasFiles },
            { title: 'Build' },
            { title: 'Results' },
          ]}
        />
      </Card>

      {error ? (
        <Card title="Unable to continue">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      {busy ? (
        <Card title="Loading…">
          <div className="text-sm text-shellSub">Checking uploaded files.</div>
        </Card>
      ) : (
        <Card title="Build" subtitle="Compute matched rows and breaks from your uploaded files." right={<Badge variant="info">Step 3 of 4</Badge>}>
          {!hasFiles ? (
            <div className="text-sm text-shellSub">Upload internal and counterparty files before building.</div>
          ) : (
            <div className="text-sm text-slate-200">
              {reconType === 'position'
                ? 'Build the reconciliation to compute matched/breaks using ISIN (position/holdings template).'
                : `Build is only available when a backend template exists for ${reconType} reconciliation.`}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Button
              disabled={building || busy || !hasFiles || Boolean(error)}
              onClick={async () => {
                setBuilding(true)
                setError(null)
                try {
                  await buildReconciliation(reconId)
                  nav(`/reconciliations/${reconId}/results`)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Build failed')
                } finally {
                  setBuilding(false)
                }
              }}
            >
              {building ? 'Building…' : 'Build reconciliation'}
            </Button>
            <Button variant="secondary" onClick={() => nav(`/reconciliations/${reconId}/upload`)}>
              Re-upload
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
