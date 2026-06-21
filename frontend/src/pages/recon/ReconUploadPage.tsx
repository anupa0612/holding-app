import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { Dropzone } from '../../components/Dropzone'
import { PageHeader } from '../../components/PageHeader'
import { Stepper } from '../../components/Stepper'
import { getReconciliation, me, uploadReconciliationFiles, type ReconciliationListItem } from '../../lib/api'
import { formatReconDisplayName } from '../../lib/recon'

export function ReconUploadPage() {
  const nav = useNavigate()
  const { reconId } = useParams<{ reconId: string }>()

  const [ourFile, setOurFile] = useState<File | null>(null)
  const [cpFile, setCpFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [meta, setMeta] = useState<ReconciliationListItem | null>(null)

  useEffect(() => {
    if (!reconId) return
    let cancelled = false
    ;(async () => {
      try {
        const [meRes, reconRes] = await Promise.all([me(), getReconciliation(reconId)])
        if (cancelled) return
        if (meRes.user.team === 'Operations') setBlocked(true)
        setMeta(reconRes.reconciliation)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [reconId])

  if (!reconId) {
    return (
      <div className="text-sm text-slate-600">
        Missing reconciliation id. Start from the dashboard.
      </div>
    )
  }

  const displayName = meta ? formatReconDisplayName(meta) : reconId

  if (blocked) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Upload files' }]} />
        <PageHeader title="Upload files" subtitle="Not authorized." actions={<Button variant="secondary" onClick={() => nav('/')}>Back</Button>} />
        <Card title="Operations access">
          <div className="text-sm text-shellSub">Operations users cannot upload/build reconciliations. You can view reviewed reconciliations and add comments.</div>
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
        title={meta?.name ? displayName : 'Upload files'}
        subtitle={meta?.name ? 'Upload internal and counterparty files.' : 'Step 2: upload internal and counterparty files.'}
        actions={
          <Button variant="secondary" type="button" onClick={() => nav('/reconciliations/new')}>
            Back
          </Button>
        }
      />

      <Card title="Workflow" subtitle={displayName}>
        <Stepper
          activeIndex={1}
          steps={[
            { title: 'Choose type', done: true },
            { title: 'Upload files', done: Boolean(ourFile && cpFile) },
            { title: 'Build' },
            { title: 'Results' },
          ]}
        />
      </Card>

      <Card
        title="Files"
        subtitle="Drag & drop or browse. CSV/XLSX supported."
        right={<Badge variant="info">Step 2 of 4</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Dropzone
            label="Our File (internal)"
            accept=".csv,.xlsx,.xls"
            file={ourFile}
            onFile={setOurFile}
            hint="Example: internal holdings export"
          />
          <Dropzone
            label="Counterparty / Broker File"
            accept=".csv,.xlsx,.xls"
            file={cpFile}
            onFile={setCpFile}
            hint="Example: broker statement / confirmation"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Upload requirements</div>
            <div className="mt-1 text-sm text-slate-700">
              - CSV / XLSX only<br />
              - First row should contain headers<br />
              - Use consistent formats for dates and numbers
            </div>
          </div>
          <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">What happens next</div>
            <div className="mt-1 text-sm text-slate-700">
              After upload, build the reconciliation to compute breaks and view results.
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setOurFile(null)
              setCpFile(null)
              setError(null)
            }}
          >
            Reset
          </Button>

          <Button
            disabled={busy || !ourFile || !cpFile}
            onClick={async () => {
              if (!ourFile || !cpFile) return
              setBusy(true)
              setError(null)
              try {
                await uploadReconciliationFiles(reconId, ourFile, cpFile)
                nav(`/reconciliations/${reconId}/build`)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Upload failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Uploading…' : 'Continue to build'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

