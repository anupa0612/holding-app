export function TablePreview({
  columns,
  rows,
}: {
  columns: string[]
  rows: Record<string, unknown>[]
}) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20 shadow-sm">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-950/40">
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap border-b border-slate-800/70 px-3 py-2 font-semibold text-slate-200"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-transparent">
          {rows.map((r, idx) => (
            <tr key={idx} className="odd:bg-transparent even:bg-slate-800/25">
              {columns.map((c) => (
                <td
                  key={c}
                  className="max-w-[240px] truncate border-b border-slate-800/70 px-3 py-2 text-slate-200"
                >
                  <span title={String(r[c] ?? '')}>{String(r[c] ?? '')}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

