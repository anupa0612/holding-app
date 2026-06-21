import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const BrokersAdminPage = lazy(() => import('./pages/admin/BrokersAdminPage').then((m) => ({ default: m.BrokersAdminPage })))
const UsersAdminPage = lazy(() => import('./pages/admin/UsersAdminPage').then((m) => ({ default: m.UsersAdminPage })))
const CompletedReconsPage = lazy(() =>
  import('./pages/recon/CompletedReconsPage').then((m) => ({ default: m.CompletedReconsPage })),
)
const DraftsPage = lazy(() => import('./pages/recon/DraftsPage').then((m) => ({ default: m.DraftsPage })))
const NewReconTypePage = lazy(() => import('./pages/recon/NewReconTypePage').then((m) => ({ default: m.NewReconTypePage })))
const ReconBuildPage = lazy(() => import('./pages/recon/ReconBuildPage').then((m) => ({ default: m.ReconBuildPage })))
const ReconPreviewRedirect = lazy(() =>
  import('./pages/recon/ReconPreviewRedirect').then((m) => ({ default: m.ReconPreviewRedirect })),
)
const ReconUploadPage = lazy(() => import('./pages/recon/ReconUploadPage').then((m) => ({ default: m.ReconUploadPage })))
const ReconResultsPage = lazy(() => import('./pages/recon/ReconResultsPage').then((m) => ({ default: m.ReconResultsPage })))
const ReviewQueuePage = lazy(() => import('./pages/review/ReviewQueuePage').then((m) => ({ default: m.ReviewQueuePage })))

function RouteFallback() {
  return <div className="px-6 py-10 text-sm text-shellSub">Loading…</div>
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="reconciliations/new" element={<NewReconTypePage />} />
          <Route path="reconciliations/completed" element={<CompletedReconsPage />} />
          <Route path="reconciliations/drafts" element={<DraftsPage />} />
          <Route path="reconciliations/:reconId/upload" element={<ReconUploadPage />} />
          <Route path="reconciliations/:reconId/build" element={<ReconBuildPage />} />
          <Route path="reconciliations/:reconId/preview" element={<ReconPreviewRedirect />} />
          <Route path="reconciliations/:reconId/results" element={<ReconResultsPage />} />
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="admin/users" element={<UsersAdminPage />} />
          <Route path="admin/brokers" element={<BrokersAdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
