import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { getAccessToken } from '../lib/auth'

export function RequireAuth({ children }: PropsWithChildren) {
  const token = getAccessToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

