import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homeForRole } from '@/lib/nav'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, RoleRoute } from '@/components/layout/guards'
import { PageLoader } from '@/components/ui/misc'

import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import HotelsPage from '@/pages/HotelsPage'
import HotelDetailPage from '@/pages/HotelDetailPage'
import HotelGroupsPage from '@/pages/HotelGroupsPage'
import PackagesPage from '@/pages/PackagesPage'
import PackageDetailPage from '@/pages/PackageDetailPage'
import RateMatrixPage from '@/pages/RateMatrixPage'
import SalesPage from '@/pages/SalesPage'
import SalesPackagePage from '@/pages/SalesPackagePage'
import QuotesPage from '@/pages/QuotesPage'
import QuoteNewPage from '@/pages/QuoteNewPage'
import QuoteDetailPage from '@/pages/QuoteDetailPage'
import UsersPage from '@/pages/UsersPage'
import SettingsPage from '@/pages/SettingsPage'
import SystemCheckPage from '@/pages/SystemCheckPage'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return <Navigate to={user ? homeForRole(user.role) : '/auth'} replace />
}

const ops = ['admin', 'operations'] as const

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/dashboard" element={<RoleRoute roles={[...ops]}><DashboardPage /></RoleRoute>} />
                <Route path="/hotels" element={<RoleRoute roles={[...ops]}><HotelsPage /></RoleRoute>} />
                <Route path="/hotels/:id" element={<RoleRoute roles={[...ops]}><HotelDetailPage /></RoleRoute>} />
                <Route path="/hotel-groups" element={<RoleRoute roles={[...ops]}><HotelGroupsPage /></RoleRoute>} />
                <Route path="/packages" element={<RoleRoute roles={[...ops]}><PackagesPage /></RoleRoute>} />
                <Route path="/packages/:id" element={<RoleRoute roles={[...ops]}><PackageDetailPage /></RoleRoute>} />
                <Route path="/rates/matrix/new" element={<RoleRoute roles={[...ops]}><RateMatrixPage /></RoleRoute>} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/packages/:id" element={<SalesPackagePage />} />
                <Route path="/quotes" element={<RoleRoute roles={['admin', 'operations', 'sales']}><QuotesPage /></RoleRoute>} />
                <Route path="/quotes/new" element={<RoleRoute roles={['admin', 'operations', 'sales']}><QuoteNewPage /></RoleRoute>} />
                <Route path="/quotes/:id" element={<RoleRoute roles={['admin', 'operations', 'sales']}><QuoteDetailPage /></RoleRoute>} />
                <Route path="/users" element={<RoleRoute roles={['admin']}><UsersPage /></RoleRoute>} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/system-check" element={<RoleRoute roles={[...ops]}><SystemCheckPage /></RoleRoute>} />
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
