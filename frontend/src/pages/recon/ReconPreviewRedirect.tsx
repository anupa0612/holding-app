import { Navigate, useParams } from 'react-router-dom'

export function ReconPreviewRedirect() {
  const { reconId } = useParams<{ reconId: string }>()
  if (!reconId) return <Navigate to="/" replace />
  return <Navigate to={`/reconciliations/${reconId}/results`} replace />
}
