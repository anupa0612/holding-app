export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/6 bg-[linear-gradient(135deg,rgba(28,31,41,0.98),rgba(19,21,29,0.98))] px-6 py-5 shadow-[0_22px_44px_rgba(0,0,0,0.30)]">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.22),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-56 bg-[radial-gradient(circle_at_bottom_left,rgba(232,121,249,0.16),transparent_55%)]" />
      <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">Control Center</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 md:text-[30px]">{title}</div>
          {subtitle ? <div className="mt-2 max-w-2xl text-sm leading-6 text-shellSub">{subtitle}</div> : null}
        </div>
        {actions ? <div className="relative flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

