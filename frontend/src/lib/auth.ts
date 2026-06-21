const TOKEN_KEY = 'holding.accessToken'
const JURISDICTION_KEY = 'holding.jurisdiction'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export type Jurisdiction = 'ALL' | 'EU' | 'US' | 'ME' | 'ASIA' | 'HK'

export function getJurisdiction(): Jurisdiction | null {
  const v = localStorage.getItem(JURISDICTION_KEY)
  if (!v) return null
  if (v === 'ALL' || v === 'EU' || v === 'US' || v === 'ME' || v === 'ASIA' || v === 'HK') return v
  return null
}

export function setJurisdiction(v: Jurisdiction) {
  localStorage.setItem(JURISDICTION_KEY, v)
}

export function clearJurisdiction() {
  localStorage.removeItem(JURISDICTION_KEY)
}

