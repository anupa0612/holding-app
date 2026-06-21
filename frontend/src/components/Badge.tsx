export function Badge({
  variant = 'neutral',
  children,
}: {
  variant?: 'neutral' | 'info' | 'success' | 'warn' | 'danger'
  children: React.ReactNode
}) {
  const styles =
    variant === 'success'
      ? 'border-green-900/60 bg-green-950/40 text-green-200'
      : variant === 'warn'
        ? 'border-amber-900/60 bg-amber-950/35 text-amber-200'
        : variant === 'danger'
          ? 'border-red-900/60 bg-red-950/35 text-red-200'
          : variant === 'info'
            ? 'border-blue-900/60 bg-blue-950/35 text-blue-200'
            : 'border-slate-800/70 bg-slate-950/25 text-slate-200'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        styles,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

