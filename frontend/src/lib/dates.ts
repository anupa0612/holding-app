export function formatDateMDY(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value).trim()
  if (!s) return ''

  // Handle "YYYY-MM-DD" directly to avoid timezone shifting.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) {
    const [, y, mo, d] = m
    return `${mo}/${d}/${y}`
  }

  // Fall back to Date parsing for ISO timestamps etc.
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return s

  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const yyyy = String(dt.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

