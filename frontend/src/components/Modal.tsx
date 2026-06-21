import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  className = '',
}: {
  open: boolean
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center py-6">
          <div
            role="dialog"
            aria-modal="true"
            className={[
              'w-full max-w-[680px] rounded-2xl border border-slate-800/70 bg-slate-950/85 shadow-chrome',
              'overflow-hidden',
              className,
            ].join(' ')}
          >
            <div className="px-5 py-4 border-b border-slate-800/70">
              <div className="text-sm font-semibold text-slate-100">{title}</div>
              {description ? <div className="mt-1 text-xs text-shellSub">{description}</div> : null}
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer ? <div className="px-5 py-4 border-t border-slate-800/70">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

