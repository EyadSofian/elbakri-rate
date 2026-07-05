import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homeForUser } from '@/lib/nav'
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
import HoneymoonPage from '@/pages/HoneymoonPage'
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
  return <Navigate to={user ? homeForUser(user) : '/auth'} replace />
}

const ops = ['admin', 'operations'] as const
const opsSales = ['admin', 'operations', 'sales'] as const

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
                <Route path="/dashboard" element={<RoleRoute roles={[...opsSales]} navKey="dashboard"><DashboardPage /></RoleRoute>} />
                <Route path="/hotels" element={<RoleRoute roles={[...opsSales]} navKey="hotels"><HotelsPage /></RoleRoute>} />
                <Route path="/hotels/:id" element={<RoleRoute roles={[...opsSales]} navKey="hotels"><HotelDetailPage /></RoleRoute>} />
                <Route path="/hotel-groups" element={<RoleRoute roles={[...opsSales]} navKey="groups"><HotelGroupsPage /></RoleRoute>} />
                <Route path="/packages" element={<RoleRoute roles={[...opsSales]} navKey="packages"><PackagesPage /></RoleRoute>} />
                <Route path="/packages/:id" element={<RoleRoute roles={[...opsSales]} navKey="packages"><PackageDetailPage /></RoleRoute>} />
                <Route path="/honeymoon" element={<RoleRoute roles={['admin', 'operations', 'sales', 'viewer']} navKey="honeymoon"><HoneymoonPage /></RoleRoute>} />
                <Route path="/sales" element={<RoleRoute roles={['admin', 'operations', 'sales', 'viewer']} navKey="sales"><SalesPage /></RoleRoute>} />
                <Route path="/sales/packages/:id" element={<RoleRoute roles={['admin', 'operations', 'sales', 'viewer']} navKey="sales"><SalesPackagePage /></RoleRoute>} />
                <Route path="/quotes" element={<RoleRoute roles={['admin', 'operations', 'sales']} navKey="quotes"><QuotesPage /></RoleRoute>} />
                <Route path="/quotes/new" element={<RoleRoute roles={['admin', 'operations', 'sales']} navKey="quotes"><QuoteNewPage /></RoleRoute>} />
                <Route path="/quotes/:id" element={<RoleRoute roles={['admin', 'operations', 'sales']} navKey="quotes"><QuoteDetailPage /></RoleRoute>} />
                <Route path="/users" element={<RoleRoute roles={['admin']} navKey="users"><UsersPage /></RoleRoute>} />
                <Route path="/settings" element={<RoleRoute roles={['admin', 'operations', 'sales', 'viewer']} navKey="settings"><SettingsPage /></RoleRoute>} />
                <Route path="/system-check" element={<RoleRoute roles={[...ops]} navKey="system"><SystemCheckPage /></RoleRoute>} />
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
