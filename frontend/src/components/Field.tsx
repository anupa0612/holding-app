import type { PropsWithChildren } from 'react'

export function Field({
  label,
  hint,
  required,
  children,
}: PropsWithChildren<{
  label: string
  hint?: string
  required?: boolean
}>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-shellSub">
          {label} {required ? <span className="text-danger">*</span> : null}
        </div>
      </div>
      {children}
      {hint ? <div className="text-[12px] leading-5 text-shellSub">{hint}</div> : null}
    </div>
  )
}

