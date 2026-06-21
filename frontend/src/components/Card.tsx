import type { PropsWithChildren } from 'react'

export function Card({
  title,
  subtitle,
  right,
  children,
}: PropsWithChildren<{
  title?: string
  subtitle?: string
  right?: React.ReactNode
}>) {
  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-white/6 bg-[linear-gradient(180deg,rgba(31,35,46,0.94),rgba(20,23,31,0.96))] shadow-[0_22px_45px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-fuchsia-500/8 blur-3xl" />
      {title ? (
        <div className="relative flex items-start justify-between gap-4 border-b border-white/6 px-6 py-5">
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-100">{title}</div>
            {subtitle ? <div className="mt-1 text-xs leading-5 text-shellSub">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className="relative px-6 py-5">{children}</div>
    </div>
  )
}

