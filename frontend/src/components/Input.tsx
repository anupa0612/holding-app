import type { InputHTMLAttributes } from 'react'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-xl border border-slate-700/70 bg-[linear-gradient(180deg,rgba(2,6,23,0.55),rgba(15,23,42,0.42))] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        'hover:border-slate-500/70 focus:outline-none focus:shadow-focus focus:border-softblue',
        'disabled:border-slate-800/70 disabled:bg-slate-950/30 disabled:text-shellSub',
        className,
      ].join(' ')}
    />
  )
}

