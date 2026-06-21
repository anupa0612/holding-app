import { getAccessToken } from './auth'
import type { Jurisdiction } from './auth'

// Use Vite proxy in dev (empty base) or explicit VITE_API_BASE_URL in production.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function parseResponseBody(text: string, status: number): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        `API returned HTML instead of JSON (${status}). Is the backend running on port 5000 with the latest code?`,
      )
    }
    throw new Error(`API returned a non-JSON response (${status}).`)
  }
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await res.text()
  const data = parseResponseBody(text, res.status)
  if (!res.ok) {
    const msg =
      (data as any)?.error || (data as any)?.message || (data as any)?.msg || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export type ReconType = 'trade' | 'position' | 'fi'
export type ReconStatus =
  | 'draft'
  | 'uploaded'
  | 'mapped'
  | 'processing'
  | 'completed' // built
  | 'submitted' // submitted for review
  | 'reviewed' // reviewed by reviewer
  | 'declined' // declined by reviewer (editable again)
  | 'failed'

export type Broker = {
  id: string
  name: string
  jurisdiction?: string
  templateKey?: string | null
  templateKeys?: Partial<Record<ReconType, string>>
  supportedReconTypes?: ReconType[]
}
export type Account = { id: string; name: string; number?: string | null }
export type User = {
  id: string
  fullName?: string
  email: string
  role?: 'admin' | 'user' | string
  team?: 'Reconciliations' | 'Operations' | string
  jurisdiction?: Jurisdiction | string
  jurisdictions?: (Jurisdiction | string)[]
}

export type ReconciliationListItem = {
  id: string
  type: ReconType
  status: ReconStatus
  jurisdiction?: string | null
  valueDate?: string | null
  recDate?: string | null
  performerName?: string | null
  reviewerId?: string | null
  reviewerName?: string | null
  brokerName?: string | null
  accountName?: string | null
  declineReason?: string | null
  createdAt: string | null
  updatedAt: string | null
  ourFileName?: string
  cpFileName?: string
  name?: string | null
  dashboardComment?: string | null
  opsCommentAllowed?: boolean | null
}

export function reconDashboardCommentRowKey(reconId: string) {
  return `RECON|${reconId}`
}

export async function login(email: string, password: string, jurisdiction: Jurisdiction) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, jurisdiction }),
  }) as Promise<{
    accessToken: string
    user: {
      id: string
      email: string
      role: string
      fullName?: string
      jurisdiction?: Jurisdiction | string
      jurisdictions?: (Jurisdiction | string)[]
    }
  }>
}

type MeResponse = {
  user: {
    id: string
    email: string
    role: string
    fullName?: string
    team?: string
    jurisdiction?: Jurisdiction | string
    jurisdictions?: (Jurisdiction | string)[]
  }
}

let meCache: { at: number; data: MeResponse } | null = null
const ME_CACHE_MS = 60_000

export function clearMeCache() {
  meCache = null
}

export async function me() {
  if (meCache && Date.now() - meCache.at < ME_CACHE_MS) {
    return meCache.data
  }
  const data = (await apiFetch('/api/auth/me')) as MeResponse
  meCache = { at: Date.now(), data }
  return data
}

export async function listUsers() {
  return apiFetch('/api/users') as Promise<{ items: User[] }>
}

export async function listReviewerCandidates() {
  return apiFetch('/api/users/reviewer-candidates') as Promise<{
    items: Pick<User, 'id' | 'fullName' | 'email' | 'team'>[]
  }>
}

export async function createUser(input: {
  fullName: string
  email: string
  password: string
  role: 'admin' | 'user'
  team: 'Reconciliations' | 'Operations'
  jurisdictions: Jurisdiction[]
}) {
  return apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<{ user: User }>
}

export async function updateUser(
  userId: string,
  input: Partial<{
    fullName: string
    role: 'admin' | 'user'
    team: 'Reconciliations' | 'Operations'
    jurisdictions: Jurisdiction[]
    password: string
  }>,
) {
  return apiFetch(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }) as Promise<{ user: User }>
}

export async function deleteUser(userId: string) {
  return apiFetch(`/api/users/${userId}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export async function createReconciliation(
  type: ReconType,
  brokerId: string,
  accountId: string,
  valueDate: string,
  reviewerId: string,
) {
  return apiFetch('/api/reconciliations', {
    method: 'POST',
    body: JSON.stringify({ type, brokerId, accountId, valueDate, reviewerId }),
  }) as Promise<{ id: string; status: string; type: ReconType }>
}

export async function uploadReconciliationFiles(reconId: string, ourFile: File, cpFile: File) {
  const body = new FormData()
  body.append('ourFile', ourFile)
  body.append('cpFile', cpFile)
  return apiFetch(`/api/reconciliations/${reconId}/upload`, { method: 'POST', body })
}

export async function previewReconciliationFile(reconId: string, side: 'our' | 'cp') {
  return apiFetch(`/api/reconciliations/${reconId}/preview?side=${side}`) as Promise<{
    fileName: string
    columns: string[]
    rows: Record<string, unknown>[]
  }>
}

export async function getReconciliationStats(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}/stats`) as Promise<{
    stats: {
      ourLineCount: number
      cpLineCount: number
      ourHoldingTotal: number
      cpHoldingTotal: number
      breakValue: number
      breakValueRaw: number
    }
  }>
}

export async function buildReconciliation(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}/build`, { method: 'POST' }) as Promise<{
    ok: boolean
    summary: Record<string, unknown>
  }>
}

export async function getReconciliationResults(
  reconId: string,
  section: 'all' | 'breaks' | 'matched' = 'all',
) {
  const qs = section === 'all' ? '' : `?section=${section}`
  return apiFetch(`/api/reconciliations/${reconId}/results${qs}`) as Promise<{
    summary: Record<string, unknown>
    matched?: Record<string, unknown>[]
    breaks?: Record<string, unknown>[]
    comments: Record<string, any>
  }>
}

export type BreakCommentPayload = {
  breakType: 'Static Issue' | 'Timing Difference' | 'Genuine Break'
  priority: 'High' | 'Medium' | 'Low'
  owner: 'Operations' | 'App Support'
  description: string
  mailSubject?: string
  queryRaisedDate?: string // YYYY-MM-DD
}

export type BreakCommentHistoryItem = {
  break?: BreakCommentPayload
  comment: string
  createdAt?: string | null
  updatedBy?: string | null
  updatedByName?: string | null
  difference?: number | null
  archivedReason?: string | null
}

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  meta?: Record<string, unknown>
  createdAt?: string | null
  readAt?: string | null
}

export async function listNotifications(limit = 30, unreadOnly = false) {
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  if (unreadOnly) qs.set('unread', 'true')
  return apiFetch(`/api/notifications?${qs.toString()}`) as Promise<{
    items: NotificationItem[]
    unreadCount: number
  }>
}

export async function markNotificationsRead(ids: string[]) {
  return apiFetch('/api/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }) as Promise<{ ok: boolean; unreadCount: number }>
}

export async function saveReconComment(
  reconId: string,
  rowKey: string,
  payload: { comment: string } | { break: BreakCommentPayload },
) {
  return apiFetch(`/api/reconciliations/${reconId}/comments`, {
    method: 'PUT',
    body: JSON.stringify({ rowKey, ...(payload as any) }),
  }) as Promise<{ ok: boolean }>
}

export async function listReconciliations(
  limit = 20,
  opts?: { scope?: 'jurisdiction' | 'drafts'; status?: string; days?: number },
) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (opts?.scope) qs.set('scope', opts.scope)
  if (opts?.status) qs.set('status', opts.status)
  if (opts?.days) qs.set('days', String(opts.days))
  return apiFetch(`/api/reconciliations?${qs.toString()}`) as Promise<{ items: ReconciliationListItem[] }>
}

export async function listDashboardReviewed(limit = 100, days?: number) {
  return listReconciliations(limit, { scope: 'jurisdiction', status: 'reviewed', days })
}

export async function listMyCompleted(limit = 50) {
  return apiFetch(`/api/reconciliations?limit=${limit}&status=submitted,reviewed,declined`) as Promise<{
    items: ReconciliationListItem[]
  }>
}

export async function listReviewed(limit = 50, days?: number) {
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  qs.set('status', 'reviewed')
  if (days) qs.set('days', String(days))
  return apiFetch(`/api/reconciliations?${qs.toString()}`) as Promise<{
    items: ReconciliationListItem[]
  }>
}

export async function getReconciliation(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}`) as Promise<{ reconciliation: ReconciliationListItem }>
}

export async function listMyDrafts(limit = 50) {
  return listReconciliations(limit, { scope: 'drafts' })
}

export async function deleteReconciliation(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export async function submitReconciliation(reconId: string, opts?: { name?: string }) {
  return apiFetch(`/api/reconciliations/${reconId}/submit`, {
    method: 'POST',
    body: JSON.stringify(opts?.name ? { name: opts.name } : {}),
  }) as Promise<{
    ok: boolean
    reconciliation: ReconciliationListItem
  }>
}

export async function updateReconciliationReviewer(reconId: string, reviewerId: string) {
  return apiFetch(`/api/reconciliations/${reconId}/reviewer`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewerId }),
  }) as Promise<{
    ok: boolean
    reconciliation: ReconciliationListItem
  }>
}

export async function listReviewQueue(limit = 50) {
  return apiFetch(`/api/reconciliations/review-queue?limit=${limit}`) as Promise<{ items: ReconciliationListItem[] }>
}

export async function reviewReconciliation(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}/review`, { method: 'POST' }) as Promise<{
    ok: boolean
    reconciliation: ReconciliationListItem
  }>
}

export async function declineReconciliation(reconId: string, reason: string) {
  return apiFetch(`/api/reconciliations/${reconId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }) as Promise<{ ok: boolean; reconciliation: ReconciliationListItem }>
}

export async function redoReconciliation(reconId: string) {
  return apiFetch(`/api/reconciliations/${reconId}/redo`, { method: 'POST' }) as Promise<{ ok: boolean; id: string }>
}

export async function downloadReconciliationXlsx(reconId: string) {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/api/reconciliations/${reconId}/export.xlsx`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    try {
      const data = text ? (JSON.parse(text) as any) : null
      throw new Error(data?.error || data?.message || `Request failed (${res.status})`)
    } catch {
      throw new Error(text || `Request failed (${res.status})`)
    }
  }
  return res.blob()
}

export async function listBrokers() {
  return apiFetch('/api/brokers') as Promise<{ items: Broker[] }>
}

export async function listRegisteredReconTypes() {
  return apiFetch('/api/brokers/recon-types') as Promise<{
    items: { type: ReconType; templateKey: string }[]
  }>
}

export async function listBrokerTemplates() {
  return apiFetch('/api/brokers/templates') as Promise<{
    items: { templateKey: string; reconType: ReconType }[]
  }>
}

export async function createBroker(input: {
  name: string
  jurisdiction: string
  positionTemplateKey?: string
}) {
  return apiFetch('/api/brokers', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<{ broker: Broker }>
}

export async function deleteBroker(brokerId: string) {
  return apiFetch(`/api/brokers/${brokerId}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export async function listAccounts(brokerId: string) {
  return apiFetch(`/api/brokers/${brokerId}/accounts`) as Promise<{ items: Account[] }>
}

export async function createAccount(brokerId: string, name: string, number?: string) {
  return apiFetch(`/api/brokers/${brokerId}/accounts`, {
    method: 'POST',
    body: JSON.stringify({ name, number }),
  }) as Promise<{ account: Account }>
}

