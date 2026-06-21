import { UploadCloud } from 'lucide-react'
import { useCallback, useId, useState } from 'react'

export function Dropzone({
  label,
  hint,
  accept,
  file,
  onFile,
}: {
  label: string
  hint?: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
}) {
  const inputId = useId()
  const [drag, setDrag] = useState(false)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      const f = e.dataTransfer.files?.[0]
      onFile(f ?? null)
    },
    [onFile],
  )

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-200">{label}</div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={[
          'group flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed px-4 py-7 text-center shadow-[0_12px_28px_rgba(2,6,23,0.18)] transition-all duration-200',
          drag
            ? 'border-softblue bg-softblue/10 shadow-[0_14px_34px_rgba(59,130,246,0.18)]'
            : 'border-slate-700/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.68),rgba(10,15,28,0.82))] hover:-translate-y-0.5 hover:border-softblue/35 hover:bg-slate-800/30',
        ].join(' ')}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-softblue/20 bg-softblue/10 text-softblue transition-transform duration-200 group-hover:scale-105">
          <UploadCloud size={18} />
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-100">
          {file ? file.name : 'Drop file here or click to browse'}
        </div>
        <div className="mt-1 text-xs leading-5 text-shellSub">
          {hint ?? 'Accepted: CSV / Excel (XLSX)'}
        </div>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/25 px-3 py-2 text-xs text-shellSub shadow-sm">
          <span className="truncate" title={file.name}>
            Selected: <span className="font-medium text-slate-100">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="rounded-lg px-2 py-1 font-semibold text-softblue transition hover:bg-softblue/10 hover:no-underline"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  )
}

