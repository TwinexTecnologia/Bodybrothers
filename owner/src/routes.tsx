import { Route, Routes, Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import Overview from './pages/Dashboard/Overview'
import ListPersonals from './pages/Personals/ListPersonals'
import CreatePersonal from './pages/Personals/CreatePersonal'
import EditPersonal from './pages/Personals/EditPersonal'
import ResetPassword from './pages/Personals/ResetPassword'
import ViewPersonalStudents from './pages/Personals/ViewPersonalStudents'
import PersonalBranding from './pages/Personals/PersonalBranding'
import Permissions from './pages/Personals/Permissions'
import DebitCreate from './pages/Billing/DebitCreate'
import DebitsHistory from './pages/Billing/DebitsHistory'
import PaymentsReceived from './pages/Billing/PaymentsReceived'
import Pendences from './pages/Billing/Pendences'
import FinancialByPersonal from './pages/Billing/FinancialByPersonal'
import OwnerBranding from './pages/Settings/OwnerBranding'
import SystemPreferences from './pages/Settings/SystemPreferences'
import OwnerCredentials from './pages/Settings/OwnerCredentials'
import Logout from './pages/Logout'
import Login from './pages/Auth/Login'

function DefaultRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard/overview' : '/login'} replace />
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard/overview" element={<Protected><Overview /></Protected>} />

      <Route path="/personals/list" element={<Protected><ListPersonals /></Protected>} />
      <Route path="/personals/create" element={<Protected><CreatePersonal /></Protected>} />
      <Route path="/personals/edit" element={<Protected><EditPersonal /></Protected>} />
      <Route path="/personals/reset-password" element={<Protected><ResetPassword /></Protected>} />
      <Route path="/personals/students" element={<Protected><ViewPersonalStudents /></Protected>} />
      <Route path="/personals/branding" element={<Protected><PersonalBranding /></Protected>} />
      <Route path="/personals/permissions" element={<Protected><Permissions /></Protected>} />

      <Route path="/billing/debit-create" element={<Protected><DebitCreate /></Protected>} />
      <Route path="/billing/debits-history" element={<Protected><DebitsHistory /></Protected>} />
      <Route path="/billing/payments-received" element={<Protected><PaymentsReceived /></Protected>} />
      <Route path="/billing/by-personal" element={<Protected><FinancialByPersonal /></Protected>} />
      <Route path="/billing/pendences" element={<Protected><Pendences /></Protected>} />

      <Route path="/settings/owner-branding" element={<Protected><OwnerBranding /></Protected>} />
      <Route path="/settings/system-preferences" element={<Protected><SystemPreferences /></Protected>} />
      <Route path="/settings/owner-credentials" element={<Protected><OwnerCredentials /></Protected>} />

      <Route path="/logout" element={<Logout />} />
    </Routes>
  )
}
