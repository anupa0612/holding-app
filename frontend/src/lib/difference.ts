export type DifferenceOperator = 'none' | 'eq' | 'gt' | 'lt'

export function parseDifference(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function roundDifference5(n: number): number {
  return Number(n.toFixed(5))
}

/** True when Difference is zero (5 dp) → matched row. */
export function differenceIsZero(value: unknown): boolean {  if (value === null || value === undefined) return true
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return true
    const n = Number(s)
    if (!Number.isFinite(n)) return false
    return Number(n.toFixed(5)) === 0
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return false
  return Number(n.toFixed(5)) === 0
}

export function matchesDifferenceFilter(
  rowDifference: unknown,
  operator: DifferenceOperator,
  filterValue: string,
): boolean {
  if (operator === 'none' || !filterValue.trim()) return true
  const rowN = parseDifference(rowDifference)
  const filterN = parseDifference(filterValue)
  if (rowN === null || filterN === null) return false
  if (operator === 'eq') return roundDifference5(rowN) === roundDifference5(filterN)
  if (operator === 'gt') return rowN > filterN
  if (operator === 'lt') return rowN < filterN
  return true
}

export function splitRowsByDifference<T extends { Difference?: unknown }>(rows: T[]) {
  const matched: T[] = []
  const breaks: T[] = []
  for (const row of rows) {
    if (differenceIsZero(row.Difference)) matched.push(row)
    else breaks.push(row)
  }
  return { matched, breaks }
}
