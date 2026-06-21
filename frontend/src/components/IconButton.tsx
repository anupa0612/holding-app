import type { ButtonHTMLAttributes } from 'react'

export function IconButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...props}
      className={[
        'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200',
        'border border-slate-700/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.72))] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.22)]',
        'hover:-translate-y-0.5 hover:border-softblue/40 hover:bg-slate-800/70 hover:text-softblue',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-softblue/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    />
  )
}

