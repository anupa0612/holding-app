import type { ReconciliationListItem } from './api'

export type ReconLabelSource = Pick<
  ReconciliationListItem,
  'name' | 'type' | 'brokerName' | 'accountName' | 'valueDate'
>

export function defaultReconDisplayName(r: ReconLabelSource): string {
  const parts = [r.brokerName, r.accountName].filter(Boolean)
  const left = parts.join(' / ')
  const right = [r.type, r.valueDate].filter(Boolean).join(' • ')
  return [left, right].filter(Boolean).join(' — ') || r.type || 'Reconciliation'
}

export function formatReconDisplayName(r: ReconLabelSource): string {
  const custom = (r.name ?? '').trim()
  if (custom) return custom
  return defaultReconDisplayName(r)
}

export function reconDownloadBasename(r: ReconLabelSource, id: string): string {
  const label = formatReconDisplayName(r)
  const safe = label
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '_')
    .slice(0, 80)
  return safe || `reconciliation_${id}`
}
