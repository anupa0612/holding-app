import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { Select } from '../../components/Select'
import { createUser, deleteUser, listUsers, me, updateUser, type User } from '../../lib/api'
import type { Jurisdiction } from '../../lib/auth'

export function UsersAdminPage() {
  const JURIS: Jurisdiction[] = ['ALL', 'EU', 'US', 'ME', 'ASIA', 'HK']
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myUserId, setMyUserId] = useState('')

  const [items, setItems] = useState<User[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user')
  const [editTeam, setEditTeam] = useState<'Reconciliations' | 'Operations'>('Reconciliations')
  const [editJurisdictions, setEditJurisdictions] = useState<Jurisdiction[]>(['EU'])
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [team, setTeam] = useState<'Reconciliations' | 'Operations'>('Reconciliations')
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(['EU'])

  function sanitizeJurisdictions(input: unknown): Jurisdiction[] {
    const raw = Array.isArray(input) ? input : input ? [input] : []
    const allowed = new Set(JURIS)
    const out: Jurisdiction[] = []
    for (const v of raw) {
      const s = String(v).trim() as Jurisdiction
      if (allowed.has(s) && !out.includes(s)) out.push(s)
    }
    return out.length ? out : ['EU']
  }

  function toggleJurisdiction(current: Jurisdiction[], next: Jurisdiction): Jurisdiction[] {
    if (next === 'ALL') return ['ALL']
    const set = new Set<Jurisdiction>(sanitizeJurisdictions(current).filter((j) => j !== 'ALL'))
    if (set.has(next)) set.delete(next)
    else set.add(next)
    const ordered: Jurisdiction[] = []
    for (const j of JURIS) {
      if (j !== 'ALL' && set.has(j)) ordered.push(j)
    }
    return ordered.length ? ordered : ['EU']
  }

  async function refresh() {
    const res = await listUsers()
    setItems(res.items)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setEditFullName(u.fullName ?? '')
    setEditRole((u.role as any) === 'admin' ? 'admin' : 'user')
    setEditTeam((u.team as any) === 'Operations' ? 'Operations' : 'Reconciliations')
    const fromApi = sanitizeJurisdictions(u.jurisdictions)
    const legacy = sanitizeJurisdictions(u.jurisdiction)
    const initial = fromApi?.length ? fromApi : legacy
    setEditJurisdictions(initial.includes('ALL') ? ['ALL'] : initial)
    setEditPassword('')
    setEditError(null)
    setEditOpen(true)
  }

  function openResetPassword(u: User) {
    setResetUser(u)
    setResetPassword('')
    setResetPasswordConfirm('')
    setResetError(null)
    setResetOpen(true)
  }

  async function savePasswordReset() {
    if (!resetUser) return
    const password = resetPassword.trim()
    const confirm = resetPasswordConfirm.trim()
    if (password.length < 6) {
      setResetError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setResetError('Passwords do not match.')
      return
    }
    setSaving(true)
    setResetError(null)
    setError(null)
    setSuccess(null)
    try {
      await updateUser(resetUser.id, { password })
      const label = resetUser.fullName || resetUser.email
      setSuccess(`Password reset for "${label}".`)
      setResetOpen(false)
      setResetUser(null)
      setResetPassword('')
      setResetPasswordConfirm('')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Failed to reset password')
    } finally {
      setSaving(false)
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
        setMyUserId(meRes.user.id)
        if (!admin) return
        await refresh()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load users')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const canCreate = useMemo(() => {
    return (
      fullName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      Boolean(role) &&
      Boolean(team) &&
      jurisdictions.length > 0
    )
  }, [fullName, email, password, role, team, jurisdictions])

  if (!isAdmin && !busy) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Users" subtitle="Admin-only user management." />
        <Card title="Not authorized" right={<Badge variant="danger">Admin only</Badge>}>
          <div className="text-sm text-shellSub">Only admins can create and manage user accounts.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" subtitle="Create user accounts and manage access." actions={<Badge variant="info">Admin</Badge>} />

      {error ? (
        <Card title="Error">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}

      {success ? (
        <Card title="Success">
          <div className="text-sm text-emerald-300">{success}</div>
        </Card>
      ) : null}

      <Card title="Create account" subtitle="Only admins can create accounts.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Full name" required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Smith" />
          </Field>
          <Field label="Email" required>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="Password" required hint="Minimum 6 characters.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>

          <Field label="Access" required>
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Team" required>
            <Select value={team} onChange={(e) => setTeam(e.target.value as any)}>
              <option value="Reconciliations">Reconciliations</option>
              <option value="Operations">Operations</option>
            </Select>
          </Field>
          <Field
            label="Jurisdictions"
            required
            hint="ALL means the user may sign in to any region portal. Otherwise pick one or more regions."
          >
            <div className="flex flex-wrap gap-2">
              {JURIS.map((j) => {
                const active = jurisdictions.includes(j)
                const label = j === 'ALL' ? 'ALL (any region)' : j
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setJurisdictions((cur) => toggleJurisdiction(cur, j))}
                    className={[
                      'rounded-xl border px-3 py-2 text-xs font-semibold tracking-wide transition',
                      active
                        ? 'border-white/20 bg-white/10 text-slate-50 shadow-chrome'
                        : 'border-white/10 bg-black/20 text-shellSub hover:bg-white/5 hover:text-slate-100',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            type="button"
            disabled={saving}
            onClick={() => {
              setFullName('')
              setEmail('')
              setPassword('')
              setRole('user')
              setTeam('Reconciliations')
              setJurisdictions(['EU'])
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            disabled={!canCreate || saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await createUser({
                  fullName: fullName.trim(),
                  email: email.trim(),
                  password,
                  role,
                  team,
                  jurisdictions: jurisdictions.includes('ALL') ? ['ALL'] : jurisdictions,
                })
                setPassword('')
                await refresh()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create user')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </Card>

      <Card title="Existing users" subtitle={busy ? 'Loading…' : `${items.length} user(s)`}>
        <div className="overflow-auto rounded-xl border border-white/6 bg-black/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/20">
              <tr className="text-xs font-semibold text-slate-200">
                <th className="px-3 py-2 border-b border-white/6">Full name</th>
                <th className="px-3 py-2 border-b border-white/6">Email</th>
                <th className="px-3 py-2 border-b border-white/6">Role</th>
                <th className="px-3 py-2 border-b border-white/6">Team</th>
                <th className="px-3 py-2 border-b border-white/6">Jurisdictions</th>
                <th className="px-3 py-2 border-b border-white/6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-shellSub">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-shellSub">
                    No users found.
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-t border-white/6 text-slate-200 hover:bg-white/5">
                    <td className="px-3 py-2 font-semibold text-slate-100">{u.fullName ?? '—'}</td>
                    <td className="px-3 py-2 text-shellSub">{u.email}</td>
                    <td className="px-3 py-2">
                      <Badge variant={u.role === 'admin' ? 'warn' : 'neutral'}>{u.role ?? 'user'}</Badge>
                    </td>
                    <td className="px-3 py-2">{u.team ?? '—'}</td>
                    <td className="px-3 py-2">
                      {Array.isArray(u.jurisdictions) && u.jurisdictions.length
                        ? u.jurisdictions.join(', ')
                        : u.jurisdiction ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" type="button" onClick={() => openResetPassword(u)}>
                          Reset password
                        </Button>
                        <Button variant="secondary" type="button" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          type="button"
                          disabled={saving || u.id === myUserId}
                          title={u.id === myUserId ? 'You cannot delete your own account' : undefined}
                          onClick={async () => {
                            const label = u.fullName || u.email
                            if (!window.confirm(`Delete user "${label}"? This cannot be undone.`)) return
                            setSaving(true)
                            setError(null)
                            setSuccess(null)
                            try {
                              await deleteUser(u.id)
                              setSuccess(`Deleted user "${label}". Historical reconciliations are kept.`)
                              await refresh()
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'Failed to delete user'
                              setError(msg)
                              window.alert(msg)
                            } finally {
                              setSaving(false)
                            }
                          }}
                        >
                          Delete
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

      <Modal
        open={editOpen}
        title="Edit user"
        onClose={() => setEditOpen(false)}
        className="max-w-[920px]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-shellSub">{editUser?.email ?? ''}</div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!editUser || saving || (!editFullName.trim() && !editPassword.trim())}
                onClick={async () => {
                  if (!editUser) return
                  const password = editPassword.trim()
                  if (password && password.length < 6) {
                    setEditError('Password must be at least 6 characters.')
                    return
                  }
                  setSaving(true)
                  setEditError(null)
                  setError(null)
                  setSuccess(null)
                  try {
                    await updateUser(editUser.id, {
                      ...(editFullName.trim() ? { fullName: editFullName.trim() } : {}),
                      role: editRole,
                      team: editTeam,
                      jurisdictions: editJurisdictions.includes('ALL') ? ['ALL'] : editJurisdictions,
                      ...(password ? { password } : {}),
                    })
                    setSuccess(
                      password
                        ? `Updated "${editUser.fullName || editUser.email}" and reset password.`
                        : `Updated "${editUser.fullName || editUser.email}".`,
                    )
                    setEditOpen(false)
                    await refresh()
                  } catch (e) {
                    setEditError(e instanceof Error ? e.message : 'Failed to update user')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        }
      >
        {editError ? <div className="mb-4 text-sm text-danger">{editError}</div> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Full name" required>
            <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
          </Field>
          <Field label="Access" required>
            <Select value={editRole} onChange={(e) => setEditRole(e.target.value as any)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Team" required>
            <Select value={editTeam} onChange={(e) => setEditTeam(e.target.value as any)}>
              <option value="Reconciliations">Reconciliations</option>
              <option value="Operations">Operations</option>
            </Select>
          </Field>
          <Field
            label="Jurisdictions"
            required
            hint="ALL means the user may sign in to any region portal. Otherwise pick one or more regions."
          >
            <div className="flex flex-wrap gap-2">
              {JURIS.map((j) => {
                const active = editJurisdictions.includes(j)
                const label = j === 'ALL' ? 'ALL (any region)' : j
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setEditJurisdictions((cur) => toggleJurisdiction(cur, j))}
                    className={[
                      'rounded-xl border px-3 py-2 text-xs font-semibold tracking-wide transition',
                      active
                        ? 'border-white/20 bg-white/10 text-slate-50 shadow-chrome'
                        : 'border-white/10 bg-black/20 text-shellSub hover:bg-white/5 hover:text-slate-100',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Reset password" hint="Optional. Minimum 6 characters. Leave empty to keep current password.">
            <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        title="Reset password"
        onClose={() => setResetOpen(false)}
        className="max-w-[520px]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-shellSub">{resetUser?.email ?? ''}</div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setResetOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" disabled={!resetUser || saving || !resetPassword.trim()} onClick={savePasswordReset}>
                {saving ? 'Saving…' : 'Reset password'}
              </Button>
            </div>
          </div>
        }
      >
        {resetError ? <div className="mb-4 text-sm text-danger">{resetError}</div> : null}
        <div className="grid gap-4">
          <div className="rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-sm text-shellSub">
            Set a new password for <span className="font-semibold text-slate-100">{resetUser?.fullName || resetUser?.email}</span>.
          </div>
          <Field label="New password" required hint="Minimum 6 characters.">
            <Input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password" required>
            <Input
              type="password"
              value={resetPasswordConfirm}
              onChange={(e) => setResetPasswordConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

