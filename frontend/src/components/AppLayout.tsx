import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearAccessToken, getJurisdiction } from '../lib/auth'
import { clearMeCache, listNotifications, markNotificationsRead, me, type NotificationItem } from '../lib/api'
import { Button } from './Button'
import { Bell, LayoutDashboard, PlusSquare, Search, Users, ClipboardCheck, Archive, Building2, FilePen } from 'lucide-react'
import { useEffect, useState } from 'react'

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-200',
        active
          ? 'border border-violet-400/20 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/12 text-shellText shadow-[0_12px_28px_rgba(168,85,247,0.16)]'
          : 'border border-transparent text-shellSub hover:border-white/8 hover:bg-white/5 hover:text-shellText',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-violet-500/18 text-violet-300' : 'bg-black/20 text-shellSub group-hover:text-shellText',
        ].join(' ')}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}

export function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOperations, setIsOperations] = useState(false)
  const [jurisdiction, setJuris] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await me()
        if (!cancelled) {
          setIsAdmin(r.user.role === 'admin')
          setIsOperations(r.user.team === 'Operations')
          setDisplayName((r.user.fullName || r.user.email || '').trim())
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false)
          setIsOperations(false)
          setDisplayName('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await listNotifications(30, false)
        if (!cancelled) {
          setNotifs(r.items)
          setUnreadCount(r.unreadCount)
        }
      } catch {
        if (!cancelled) {
          setNotifs([])
          setUnreadCount(0)
        }
      }
    })()
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      listNotifications(30, false)
        .then((r) => {
          if (!cancelled) {
            setNotifs(r.items)
            setUnreadCount(r.unreadCount)
          }
        })
        .catch(() => {})
    }
    const t = window.setInterval(poll, 60000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    setJuris(getJurisdiction() ?? '')
  }, [])

  return (
    <div className="min-h-full">
      <div className="flex min-h-full">
        <aside className="hidden w-[300px] shrink-0 border-r border-white/6 bg-[linear-gradient(180deg,rgba(16,18,24,0.98),rgba(21,23,31,0.96))] md:block">
          <div className="flex h-full flex-col p-5">
            <div className="rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(27,30,39,0.95),rgba(20,23,31,0.98))] px-5 py-5 shadow-[0_22px_44px_rgba(0,0,0,0.34)]">
              <div className="relative">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">Platform</div>
                <div className="mt-2 text-lg font-semibold text-shellText">Holding Reconciliation</div>
                <div className="mt-1 text-xs leading-5 text-shellSub">Reconcile. Review. Explain every break.</div>
              </div>
              <div className="mt-4 space-y-1">
                <NavItem
                  label="Dashboard"
                  icon={<LayoutDashboard size={18} />}
                  active={loc.pathname === '/'}
                  onClick={() => nav('/')}
                />
                {!isOperations ? (
                  <NavItem
                    label="New reconciliation"
                    icon={<PlusSquare size={18} />}
                    active={loc.pathname === '/reconciliations/new'}
                    onClick={() => nav('/reconciliations/new')}
                  />
                ) : null}
                {!isOperations ? (
                  <NavItem
                    label="Drafts"
                    icon={<FilePen size={18} />}
                    active={loc.pathname.startsWith('/reconciliations/drafts')}
                    onClick={() => nav('/reconciliations/drafts')}
                  />
                ) : null}
                <NavItem
                  label="Completed"
                  icon={<Archive size={18} />}
                  active={loc.pathname.startsWith('/reconciliations/completed')}
                  onClick={() => nav('/reconciliations/completed')}
                />
                {!isOperations ? (
                  <NavItem
                    label="Review queue"
                    icon={<ClipboardCheck size={18} />}
                    active={loc.pathname.startsWith('/review')}
                    onClick={() => nav('/review')}
                  />
                ) : null}
                {isAdmin ? (
                  <>
                    <NavItem
                      label="Brokers"
                      icon={<Building2 size={18} />}
                      active={loc.pathname.startsWith('/admin/brokers')}
                      onClick={() => nav('/admin/brokers')}
                    />
                    <NavItem
                      label="Users"
                      icon={<Users size={18} />}
                      active={loc.pathname.startsWith('/admin/users')}
                      onClick={() => nav('/admin/users')}
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(30,33,43,0.92),rgba(23,25,34,0.98))] px-5 py-5 shadow-[0_18px_36px_rgba(0,0,0,0.26)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shellSub">Session</div>
                  <div className="mt-2 text-sm font-medium text-slate-100">Ready to start a new run</div>
                </div>
                <div className="h-9 w-9 rounded-xl border border-violet-400/20 bg-violet-500/12" />
              </div>
              <div className="mt-4 flex gap-2">
                {!isOperations ? (
                  <Button variant="secondary" className="w-full" onClick={() => nav('/reconciliations/new')}>
                    New
                  </Button>
                ) : null}
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => {
                    clearMeCache()
                    clearAccessToken()
                    nav('/login')
                  }}
                >
                  Logout
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(28,30,39,0.92),rgba(22,24,32,0.96))] px-5 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shellSub">Workspace status</div>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-shellSub">Jurisdiction</span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/12 px-2.5 py-1 text-xs font-medium text-slate-100">
                    {jurisdiction || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-shellSub">Theme</span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/12 px-2.5 py-1 text-xs font-medium text-slate-100">Violet Luxe</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-shellSub">Mode</span>
                  <span className="text-slate-100">Audit Ready</span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 text-[11px] text-shellSub">
              © Holding Reconciliation
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/6 bg-[linear-gradient(180deg,rgba(15,17,24,0.94),rgba(15,17,24,0.76))] px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="hidden flex-1 md:block">
                <div className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(28,31,41,0.94),rgba(22,24,33,0.96))] px-5 py-4 shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300/90">Financial Dashboard</div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">Premium reconciliation workspace</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shellSub">Logged in as</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">{displayName || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-black/20 px-4 py-2.5 text-shellSub min-w-[280px]">
                        <Search size={16} className="text-violet-300" />
                        <span className="text-sm">Search workflows, files, results</span>
                      </div>
                      <button
                        type="button"
                        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-black/20 text-violet-300"
                        onClick={async () => {
                          const next = !notifOpen
                          setNotifOpen(next)
                          if (!next) return
                          setNotifBusy(true)
                          try {
                            const r = await listNotifications(30, false)
                            setNotifs(r.items)
                            setUnreadCount(r.unreadCount)
                          } finally {
                            setNotifBusy(false)
                          }
                        }}
                      >
                        <Bell size={18} />
                        {unreadCount > 0 ? (
                          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full border border-violet-400/25 bg-violet-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-slate-100">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <Button variant="secondary" onClick={() => nav('/reconciliations/new')}>
                  New
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    clearMeCache()
                    clearAccessToken()
                    nav('/login')
                  }}
                >
                  Logout
                </Button>
              </div>
            </div>
          </header>

          {notifOpen ? (
            <div className="relative">
              <div
                className="fixed inset-0 z-20"
                onClick={() => setNotifOpen(false)}
                role="button"
                tabIndex={-1}
              />
              <div className="absolute right-6 top-0 z-30 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(28,31,41,0.98),rgba(22,24,33,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-shellSub">Notifications</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">
                      {notifBusy ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={unreadCount === 0 || notifBusy}
                      onClick={async () => {
                        const unreadIds = notifs.filter((n) => !n.readAt).map((n) => n.id)
                        if (unreadIds.length === 0) return
                        setNotifBusy(true)
                        try {
                          const r = await markNotificationsRead(unreadIds)
                          setUnreadCount(r.unreadCount)
                          setNotifs((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)))
                        } finally {
                          setNotifBusy(false)
                        }
                      }}
                    >
                      Mark all read
                    </Button>
                    <Button variant="secondary" type="button" onClick={() => setNotifOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-auto p-2">
                  {notifs.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-shellSub">No notifications yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {notifs.map((n) => {
                        const reconId = (n.meta as any)?.reconId as string | undefined
                        const unread = !n.readAt
                        return (
                          <button
                            key={n.id}
                            type="button"
                            className={[
                              'w-full rounded-2xl border px-3.5 py-3 text-left transition',
                              unread
                                ? 'border-violet-400/25 bg-violet-500/10 hover:bg-violet-500/14'
                                : 'border-white/6 bg-black/20 hover:bg-white/5',
                            ].join(' ')}
                            onClick={async () => {
                              if (unread) {
                                try {
                                  const r = await markNotificationsRead([n.id])
                                  setUnreadCount(r.unreadCount)
                                  setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
                                } catch {}
                              }
                              setNotifOpen(false)
                              if (reconId) nav(`/reconciliations/completed`)
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-100">{n.title}</div>
                                <div className="mt-1 text-xs text-shellSub">{n.body}</div>
                              </div>
                              {unread ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-400" /> : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex-1 px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

