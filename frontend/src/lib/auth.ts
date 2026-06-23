const TOKEN_KEY = 'holding.accessToken'

const JURISDICTION_KEY = 'holding.jurisdiction'



export type PortalJurisdiction = 'EU' | 'US' | 'ME' | 'ASIA' | 'HK'

/** User-access flag: may sign in to any portal jurisdiction. Not a login option. */

export type Jurisdiction = PortalJurisdiction | 'ALL'



export const PORTAL_JURISDICTIONS: PortalJurisdiction[] = ['EU', 'US', 'ME', 'ASIA', 'HK']



export function getAccessToken(): string | null {

  return localStorage.getItem(TOKEN_KEY)

}



export function setAccessToken(token: string) {

  localStorage.setItem(TOKEN_KEY, token)

}



export function clearAccessToken() {

  localStorage.removeItem(TOKEN_KEY)

}



export function getJurisdiction(): Jurisdiction | null {

  const v = localStorage.getItem(JURISDICTION_KEY)

  if (!v) return null

  if (v === 'ALL' || v === 'EU' || v === 'US' || v === 'ME' || v === 'ASIA' || v === 'HK') return v

  return null

}



/** Last portal used at sign-in (never ALL). */

export function getLoginJurisdiction(): PortalJurisdiction {

  const stored = getJurisdiction()

  if (stored && stored !== 'ALL' && PORTAL_JURISDICTIONS.includes(stored as PortalJurisdiction)) {

    return stored as PortalJurisdiction

  }

  return 'EU'

}



export function setJurisdiction(v: Jurisdiction) {

  localStorage.setItem(JURISDICTION_KEY, v)

}



export function clearJurisdiction() {

  localStorage.removeItem(JURISDICTION_KEY)

}


