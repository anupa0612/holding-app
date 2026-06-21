import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Button } from './Button'
import { Field } from './Field'
import { Input } from './Input'
import { Modal } from './Modal'
import { Select } from './Select'
import { saveReconComment, type BreakCommentHistoryItem, type BreakCommentPayload } from '../lib/api'
import { differenceIsZero } from '../lib/difference'
import { formatDateMDY } from '../lib/dates'

export type ResultRow = {
  Date?: string | null
  'Customer No'?: string | null
  'Customer Name'?: string | null
  'AT - ISIN'?: string | null
  'AT Settled Quantity'?: number | string | null
  'Broker ISIN'?: string | null
  'Broker Settled Quantity'?: number | string | null
  Difference?: number | string | null
  rowKey: string
}

function fmt(v: any) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function isZero5dp(v: any) {
  return differenceIsZero(v)
}

function usernameOnly(v?: string | null) {
  if (!v) return ''
  const s = String(v).trim()
  if (!s) return ''
  return s.includes('@') ? s.split('@')[0] : s
}

export function ResultsTable({
  reconId,
  rows,
  comments,
  mode,
  locked = false,
  onCommentsUpdated,
}: {
  reconId: string
  rows: ResultRow[]
  comments: Record<string, any>
  mode: 'breaks' | 'matched'
  locked?: boolean
  onCommentsUpdated: (rowKey: string, comment: any) => void
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [viewKey, setViewKey] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [copiedMailKey, setCopiedMailKey] = useState<string | null>(null)
  const [matchedDrafts, setMatchedDrafts] = useState<Record<string, string>>({})
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkErr, setBulkErr] = useState<string | null>(null)
  const [bulkMatchedComment, setBulkMatchedComment] = useState('')

  useEffect(() => {
    setMatchedDrafts({})
    setSelectedKeys(new Set())
  }, [reconId, mode])

  const [breakType, setBreakType] = useState<BreakCommentPayload['breakType']>('Static Issue')
  const [priority, setPriority] = useState<BreakCommentPayload['priority']>('Medium')
  const [owner, setOwner] = useState<BreakCommentPayload['owner']>('Operations')
  const [description, setDescription] = useState<string>('')
  const [mailSubject, setMailSubject] = useState<string>('')
  const [queryRaisedDate, setQueryRaisedDate] = useState<string>('') // YYYY-MM-DD

  function openBreakModal(rowKey: string) {
    setFormErr(null)
    const v = comments[rowKey]
    const b: BreakCommentPayload | null =
      v && typeof v === 'object' && v.break ? (v.break as BreakCommentPayload) : null
    setBreakType(b?.breakType ?? 'Static Issue')
    setPriority(b?.priority ?? 'Medium')
    setOwner(b?.owner ?? 'Operations')
    setDescription(b?.description ?? (typeof v === 'string' ? v : '') ?? '')
    setMailSubject(b?.mailSubject ?? '')
    setQueryRaisedDate(b?.queryRaisedDate ?? '')
    setEditKey(rowKey)
  }

  function openBreakDetails(rowKey: string) {
    setViewKey(rowKey)
  }

  async function saveBreak() {
    if (!editKey) return
    if (locked) return
    setFormErr(null)
    const payload: BreakCommentPayload = {
      breakType,
      priority,
      owner,
      description: description.trim(),
      ...(mailSubject.trim() ? { mailSubject: mailSubject.trim() } : {}),
      ...(queryRaisedDate ? { queryRaisedDate } : {}),
    }

    if (!payload.description) {
      setFormErr('Description is required.')
      return
    }

    setSavingKey(editKey)
    try {
      await saveReconComment(reconId, editKey, { break: payload })
      const existing = comments[editKey]
      const existingHistory = existing && typeof existing === 'object' && Array.isArray(existing.history) ? existing.history : []
      const stored = {
        break: payload,
        comment: payload.description,
        history: [
          ...existingHistory,
          { break: payload, comment: payload.description, createdAt: new Date().toISOString(), updatedBy: null },
        ],
      }
      onCommentsUpdated(editKey, stored)
      setEditKey(null)
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save comment')
    } finally {
      setSavingKey((k) => (k === editKey ? null : k))
    }
  }

  const ordered = useMemo(() => {
    // Keep stable but group by Broker ISIN for merged cells
    return [...rows].sort((a, b) => {
      const ai = String(a['Broker ISIN'] ?? '')
      const bi = String(b['Broker ISIN'] ?? '')
      if (ai !== bi) return ai.localeCompare(bi)
      const ac = String(a['Customer No'] ?? '')
      const bc = String(b['Customer No'] ?? '')
      if (ac !== bc) return ac.localeCompare(bc)
      return String(a.rowKey).localeCompare(String(b.rowKey))
    })
  }, [rows])

  const groupMeta = useMemo(() => {
    // group by Broker ISIN (fallback to AT ISIN)
    const keyOf = (r: ResultRow) => String(r['Broker ISIN'] ?? r['AT - ISIN'] ?? '')
    const firstIndex = new Map<number, { span: number; key: string }>()
    const indexToFirst = new Map<number, number>()

    let i = 0
    while (i < ordered.length) {
      const k = keyOf(ordered[i])
      let j = i + 1
      while (j < ordered.length && keyOf(ordered[j]) === k) j++
      firstIndex.set(i, { span: j - i, key: k })
      for (let x = i; x < j; x++) indexToFirst.set(x, i)
      i = j
    }
    return { firstIndex, indexToFirst }
  }, [ordered])

  const keyOf = (r: ResultRow) => String(r['Broker ISIN'] ?? r['AT - ISIN'] ?? '')
  const commentKeyOf = (r: ResultRow) => {
    // Break comments are ISIN-level (one per broker ISIN group)
    if (mode === 'breaks') return `BREAK|${keyOf(r)}`
    return r.rowKey
  }

  const visibleCommentKeys = useMemo(() => {
    const keys: string[] = []
    const seen = new Set<string>()
    for (const r of rows) {
      const k = mode === 'breaks' ? `BREAK|${keyOf(r)}` : r.rowKey
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(k)
      }
    }
    return keys
  }, [rows, mode])

  const allVisibleSelected =
    visibleCommentKeys.length > 0 && visibleCommentKeys.every((k) => selectedKeys.has(k))

  function toggleKey(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function toggleSelectAll(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) setSelectedKeys(new Set(visibleCommentKeys))
    else setSelectedKeys(new Set())
  }

  function openBulkModal() {
    setBulkErr(null)
    setBulkMatchedComment('')
    setBreakType('Static Issue')
    setPriority('Medium')
    setOwner('Operations')
    setDescription('')
    setMailSubject('')
    setQueryRaisedDate('')
    setBulkOpen(true)
  }

  async function saveBulk() {
    if (locked || selectedKeys.size === 0) return
    setBulkErr(null)

    if (mode === 'matched') {
      const text = bulkMatchedComment.trim()
      if (!text) {
        setBulkErr('Comment is required.')
        return
      }
      setBulkSaving(true)
      try {
        for (const key of selectedKeys) {
          await saveReconComment(reconId, key, { comment: text })
          onCommentsUpdated(key, text)
        }
        setSelectedKeys(new Set())
        setBulkOpen(false)
      } catch (e) {
        setBulkErr(e instanceof Error ? e.message : 'Failed to save bulk comments')
      } finally {
        setBulkSaving(false)
      }
      return
    }

    const payload: BreakCommentPayload = {
      breakType,
      priority,
      owner,
      description: description.trim(),
      ...(mailSubject.trim() ? { mailSubject: mailSubject.trim() } : {}),
      ...(queryRaisedDate ? { queryRaisedDate } : {}),
    }
    if (!payload.description) {
      setBulkErr('Description is required.')
      return
    }

    setBulkSaving(true)
    try {
      for (const key of selectedKeys) {
        await saveReconComment(reconId, key, { break: payload })
        const existing = comments[key]
        const existingHistory =
          existing && typeof existing === 'object' && Array.isArray(existing.history) ? existing.history : []
        onCommentsUpdated(key, {
          break: payload,
          comment: payload.description,
          history: [
            ...existingHistory,
            { break: payload, comment: payload.description, createdAt: new Date().toISOString(), updatedBy: null },
          ],
        })
      }
      setSelectedKeys(new Set())
      setBulkOpen(false)
    } catch (e) {
      setBulkErr(e instanceof Error ? e.message : 'Failed to save bulk comments')
    } finally {
      setBulkSaving(false)
    }
  }

  async function copyText(key: string, value?: string | null) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedMailKey(key)
      window.setTimeout(() => {
        setCopiedMailKey((current) => (current === key ? null : current))
      }, 1600)
    } catch {
      // ignore clipboard failures silently
    }
  }

  return (
    <>
      {!locked ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/20 px-3 py-2.5">
          <div className="text-xs text-shellSub">
            <span className="font-semibold text-slate-100">{selectedKeys.size}</span> selected
            {visibleCommentKeys.length > 0 ? (
              <span> · {visibleCommentKeys.length} comment target(s) visible</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={visibleCommentKeys.length === 0}
              onClick={() => {
                if (allVisibleSelected) setSelectedKeys(new Set())
                else setSelectedKeys(new Set(visibleCommentKeys))
              }}
            >
              {allVisibleSelected ? 'Unselect all visible' : 'Select all visible'}
            </Button>
            <Button type="button" disabled={selectedKeys.size === 0} onClick={openBulkModal}>
              Bulk comment ({selectedKeys.size})
            </Button>
          </div>
        </div>
      ) : null}

      <div className="max-h-[70vh] overflow-auto overscroll-contain rounded-2xl border border-slate-800/70 bg-slate-950/20">
        <table className="min-w-[1400px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/60 backdrop-blur">
            <tr className="text-xs font-semibold text-slate-200">
              {!locked ? (
                <th className="w-10 px-2 py-3 border-b-2 border-slate-700/80 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    disabled={visibleCommentKeys.length === 0}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-softblue focus:ring-softblue/40"
                    aria-label="Select all visible rows"
                  />
                </th>
              ) : null}
              <th className="px-3 py-3 border-b-2 border-slate-700/80">Date</th>
              <th className="px-3 py-3 border-b-2 border-slate-700/80">Customer No</th>
              <th className="px-3 py-3 border-b-2 border-slate-700/80">Customer Name</th>
              <th className="px-3 py-3 border-b-2 border-slate-700/80">AT - ISIN</th>
              <th className="px-3 py-3 text-right border-b-2 border-slate-700/80">AT Settled Quantity</th>
              <th className="px-3 py-3 border-b-2 border-slate-700/80">Broker ISIN</th>
              <th className="px-3 py-3 text-right border-b-2 border-slate-700/80">Broker Settled Quantity</th>
              <th className="px-3 py-3 text-right border-b-2 border-slate-700/80">Difference</th>
              {mode === 'breaks' ? (
                <th className="px-3 py-3 border-b-2 border-slate-700/80">Break Type</th>
              ) : null}
              <th className="px-3 py-3 border-b-2 border-slate-700/80">Comments</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r, idx) => {
            const diffNum = typeof r.Difference === 'number' ? r.Difference : Number(r.Difference)
            const diffBad = !isZero5dp(diffNum)
            const commentKey = commentKeyOf(r)
            const commentValue = comments[commentKey]
            const storedCommentText =
              typeof commentValue === 'string'
                ? commentValue
                : commentValue && typeof commentValue === 'object'
                  ? commentValue.comment || ''
                  : ''
            const commentText =
              mode === 'matched'
                ? (matchedDrafts[r.rowKey] ?? storedCommentText)
                : storedCommentText
            const breakDescription =
              commentValue && typeof commentValue === 'object' && commentValue.break
                ? String(commentValue.break.description ?? '')
                : ''
            const breakTypeText =
              commentValue && typeof commentValue === 'object' && commentValue.break
                ? String(commentValue.break.breakType ?? '')
                : ''
            const history: BreakCommentHistoryItem[] =
              commentValue && typeof commentValue === 'object' && Array.isArray(commentValue.history)
                ? commentValue.history
                : []
            const groupFirst = groupMeta.indexToFirst.get(idx) === idx
            const span = groupMeta.firstIndex.get(idx)?.span ?? 1
            const isSelected = selectedKeys.has(commentKey)
            return (
              <tr
                key={r.rowKey || idx}
                onClick={
                  mode === 'breaks'
                    ? () => openBreakDetails(commentKey)
                    : undefined
                }
                className={[
                  groupFirst ? 'border-t-2 border-slate-600/80' : 'border-t border-slate-800/70',
                  idx % 2 ? 'bg-slate-800/10' : 'bg-transparent',
                  isSelected ? 'bg-violet-500/10' : '',
                  mode === 'breaks' ? 'cursor-pointer hover:bg-slate-800/25' : 'hover:bg-slate-800/20',
                ].join(' ')}
              >
                {!locked ? (
                  mode === 'breaks' ? (
                    groupFirst ? (
                      <td
                        rowSpan={span}
                        className="w-10 px-2 py-2 align-middle text-center border-r border-slate-800/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleKey(commentKey, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-softblue focus:ring-softblue/40"
                          aria-label={`Select break ${keyOf(r)}`}
                        />
                      </td>
                    ) : null
                  ) : (
                    <td className="w-10 px-2 py-2 text-center border-r border-slate-800/60">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleKey(commentKey, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-softblue focus:ring-softblue/40"
                        aria-label={`Select row ${r.rowKey}`}
                      />
                    </td>
                  )
                ) : null}
                <td className="px-3 py-2 text-shellSub whitespace-nowrap border-r border-slate-800/60">
                  {formatDateMDY(r.Date)}
                </td>
                <td className="px-3 py-2 text-slate-200 whitespace-nowrap border-r border-slate-800/60">{fmt(r['Customer No'])}</td>
                <td className="px-3 py-2 text-slate-200 border-r border-slate-800/60">{fmt(r['Customer Name'])}</td>
                <td className="px-3 py-2 text-slate-100 font-semibold whitespace-nowrap border-r border-slate-800/60">{fmt(r['AT - ISIN'])}</td>
                <td className="px-3 py-2 text-slate-200 text-right whitespace-nowrap border-r border-slate-800/60">
                  {fmt(r['AT Settled Quantity'])}
                </td>
                {groupFirst ? (
                  <>
                    <td
                      rowSpan={span}
                      className="px-3 py-2 text-slate-200 whitespace-nowrap align-middle text-center border-r border-slate-800/60"
                    >
                      {fmt(r['Broker ISIN'])}
                    </td>
                    <td
                      rowSpan={span}
                      className="px-3 py-2 text-slate-200 whitespace-nowrap align-middle text-center border-r border-slate-800/60"
                    >
                      {fmt(r['Broker Settled Quantity'])}
                    </td>
                    <td
                      rowSpan={span}
                      className={[
                        'px-3 py-2 font-semibold whitespace-nowrap align-middle text-center border-r border-slate-800/60',
                        diffBad ? 'text-amber-200' : 'text-green-200',
                      ].join(' ')}
                    >
                      {fmt(r.Difference)}
                    </td>
                  </>
                ) : null}
                {mode === 'breaks' ? (
                  groupFirst ? (
                    <td
                      rowSpan={span}
                      className="px-3 py-2 text-slate-200 whitespace-nowrap align-middle text-center border-r border-slate-800/60"
                    >
                      {breakTypeText ? breakTypeText : <span className="text-slate-500">—</span>}
                    </td>
                  ) : null
                ) : null}
                <td className="px-3 py-2">
                  {mode === 'breaks' ? (
                    groupFirst ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (locked) return
                          openBreakModal(commentKey)
                        }}
                        disabled={locked}
                        className={[
                          'w-full rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-center',
                          'hover:bg-slate-800/20 hover:border-slate-700/70 transition',
                          locked ? 'opacity-60 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        <div className="text-sm text-slate-100">
                          {breakDescription ? (
                            breakDescription
                          ) : (
                            <span className="text-slate-500">Add break comment…</span>
                          )}
                        </div>
                        {history.length > 0 ? <div className="mt-1 text-[11px] text-shellSub">{history.length} comment(s)</div> : null}
                      </button>
                    ) : null
                  ) : (
                    <>
                      <textarea
                        value={commentText}
                        onChange={(e) => {
                          const next = e.target.value
                          setMatchedDrafts((prev) => ({ ...prev, [r.rowKey]: next }))
                        }}
                        disabled={locked}
                        onBlur={async () => {
                          if (locked) return
                          const next = matchedDrafts[r.rowKey] ?? storedCommentText
                          if (next === storedCommentText) return
                          setSavingKey(r.rowKey)
                          try {
                            await saveReconComment(reconId, r.rowKey, { comment: next })
                            onCommentsUpdated(r.rowKey, next)
                            setMatchedDrafts((prev) => {
                              const copy = { ...prev }
                              delete copy[r.rowKey]
                              return copy
                            })
                          } finally {
                            setSavingKey((k) => (k === r.rowKey ? null : k))
                          }
                        }}
                        placeholder="Add comment…"
                        rows={1}
                        className="w-full resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"
                      />
                      {savingKey === r.rowKey ? (
                        <div className="mt-1 text-[11px] text-shellSub">Saving…</div>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            )
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={bulkOpen}
        title={mode === 'breaks' ? `Bulk break comment (${selectedKeys.size})` : `Bulk comment (${selectedKeys.size})`}
        onClose={() => {
          if (bulkSaving) return
          setBulkOpen(false)
        }}
        footer={
          <div className="flex items-center justify-between gap-3">
            {bulkErr ? <div className="text-sm text-danger">{bulkErr}</div> : <div />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={saveBulk} disabled={bulkSaving || selectedKeys.size === 0}>
                {bulkSaving ? 'Saving…' : `Apply to ${selectedKeys.size}`}
              </Button>
            </div>
          </div>
        }
      >
        {mode === 'breaks' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Break type" required>
              <Select value={breakType} onChange={(e) => setBreakType(e.target.value as any)}>
                <option value="Static Issue">Static Issue</option>
                <option value="Timing Difference">Timing Difference</option>
                <option value="Genuine Break">Genuine Break</option>
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </Field>
            <Field label="Break owner" required>
              <Select value={owner} onChange={(e) => setOwner(e.target.value as any)}>
                <option value="Operations">Operations</option>
                <option value="App Support">App Support</option>
              </Select>
            </Field>
            <Field label="Query Raised Date" hint="Optional">
              <Input type="date" value={queryRaisedDate} onChange={(e) => setQueryRaisedDate(e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descriptive comments" required>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"
                  placeholder="Applied to all selected breaks…"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Mail subject" hint="Optional">
                <Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} placeholder="Mail subject…" />
              </Field>
            </div>
          </div>
        ) : (
          <Field label="Comment" required>
            <textarea
              value={bulkMatchedComment}
              onChange={(e) => setBulkMatchedComment(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"
              placeholder="Applied to all selected matched rows…"
            />
          </Field>
        )}
      </Modal>

      <Modal
        open={mode === 'breaks' && Boolean(editKey)}
        title="Break comment"
        onClose={() => setEditKey(null)}
        footer={
          <div className="flex items-center justify-between gap-3">
            {formErr ? <div className="text-sm text-danger">{formErr}</div> : <div />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditKey(null)} disabled={Boolean(savingKey)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveBreak} disabled={Boolean(savingKey) || locked}>
                {savingKey ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Break type" required>
            <Select value={breakType} onChange={(e) => setBreakType(e.target.value as any)}>
              <option value="Static Issue">Static Issue</option>
              <option value="Timing Difference">Timing Difference</option>
              <option value="Genuine Break">Genuine Break</option>
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
          </Field>
          <Field label="Break owner" required>
            <Select value={owner} onChange={(e) => setOwner(e.target.value as any)}>
              <option value="Operations">Operations</option>
              <option value="App Support">App Support</option>
            </Select>
          </Field>
          <Field label="Query Raised Date" hint="Optional">
            <Input type="date" value={queryRaisedDate} onChange={(e) => setQueryRaisedDate(e.target.value)} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Descriptive comments" required>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-softblue"
                placeholder="Describe the break…"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Mail subject" hint="Optional">
              <Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} placeholder="Mail subject…" />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={mode === 'breaks' && Boolean(viewKey)}
        title="Break details"
        onClose={() => setViewKey(null)}
        className="max-w-[1120px]"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" type="button" onClick={() => setViewKey(null)}>
              Close
            </Button>
          </div>
        }
      >
        {(() => {
          const value = viewKey ? comments[viewKey] : null
          const breakInfo = value && typeof value === 'object' ? value.break : null
          const history: BreakCommentHistoryItem[] =
            value && typeof value === 'object' && Array.isArray(value.history) ? value.history : []
          return (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Break type">
                  <Input value={breakInfo?.breakType ?? ''} disabled />
                </Field>
                <Field label="Priority">
                  <Input value={breakInfo?.priority ?? ''} disabled />
                </Field>
                <Field label="Break owner">
                  <Input value={breakInfo?.owner ?? ''} disabled />
                </Field>
                <Field label="Query Raised Date">
                  <Input value={breakInfo?.queryRaisedDate ? formatDateMDY(breakInfo.queryRaisedDate) : ''} disabled />
                </Field>
                <Field label="Commented person">
                  <Input value={history.length > 0 ? usernameOnly(history[history.length - 1]?.updatedByName) : ''} disabled />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Descriptive comments">
                    <textarea
                      value={breakInfo?.description ?? ''}
                      rows={4}
                      disabled
                      className="w-full resize-none rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-sm text-slate-100"
                    />
                  </Field>
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <Field label="Mail subject">
                    <div className="flex gap-2">
                      <Input value={breakInfo?.mailSubject ?? ''} disabled />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => copyText('current-mail-subject', breakInfo?.mailSubject)}
                        disabled={!breakInfo?.mailSubject}
                      >
                        {copiedMailKey === 'current-mail-subject' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </Field>
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-shellSub">Comment history</div>
                <div className="overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-950/40">
                      <tr className="text-xs font-semibold text-slate-200">
                        <th className="px-3 py-2 border-b border-slate-800/70">Created</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Commented Person</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Break Type</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Priority</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Owner</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Description</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Mail Subject</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Difference</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Reason</th>
                        <th className="px-3 py-2 border-b border-slate-800/70">Query Raised Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-4 text-shellSub">
                            No comment history available.
                          </td>
                        </tr>
                      ) : (
                        [...history].reverse().map((item, idx) => (
                          <tr key={`${item.createdAt ?? 'na'}-${idx}`} className="border-t border-slate-800/70 text-slate-200">
                            <td className="px-3 py-2 whitespace-nowrap">{item.createdAt ? formatDateMDY(item.createdAt) : '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{usernameOnly(item.updatedByName) || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.break?.breakType ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.break?.priority ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.break?.owner ?? '—'}</td>
                            <td className="px-3 py-2">{item.break?.description || item.comment || '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span>{item.break?.mailSubject ?? '—'}</span>
                                {item.break?.mailSubject ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => copyText(`history-mail-subject-${idx}`, item.break?.mailSubject)}
                                  >
                                    {copiedMailKey === `history-mail-subject-${idx}` ? 'Copied' : 'Copy'}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.difference != null ? String(item.difference) : '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.archivedReason === 'difference_changed'
                                ? 'Difference changed'
                                : item.archivedReason === 'break_cleared'
                                  ? 'Break cleared'
                                  : item.archivedReason ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.break?.queryRaisedDate ? formatDateMDY(item.break.queryRaisedDate) : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </>
  )
}

