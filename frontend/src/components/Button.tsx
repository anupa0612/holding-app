import type { ButtonHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const base =
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200'
  const focus =
    'focus:outline-none focus-visible:ring-4 focus-visible:ring-softblue/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
  const disabled = 'disabled:opacity-60 disabled:cursor-not-allowed'

  const styles =
    variant === 'primary'
      ? 'border border-fuchsia-300/20 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 text-white shadow-[0_14px_34px_rgba(168,85,247,0.26)] hover:-translate-y-0.5 hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-400'
      : variant === 'secondary'
        ? 'border border-white/8 bg-[linear-gradient(180deg,rgba(43,48,61,0.86),rgba(28,31,42,0.92))] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-[linear-gradient(180deg,rgba(52,57,73,0.92),rgba(31,34,46,0.96))]'
        : variant === 'danger'
          ? 'border border-red-500/30 bg-gradient-to-r from-red-600 to-danger text-white shadow-[0_10px_24px_rgba(220,38,38,0.24)] hover:-translate-y-0.5 hover:from-red-500 hover:to-danger'
          : 'cursor-pointer border border-transparent bg-transparent text-slate-100 hover:border-white/8 hover:bg-white/5'

  return (
    <button
      {...props}
      className={[
        base,
        focus,
        disabled,
        styles,
        className,
      ].join(' ')}
    />
  )
}

