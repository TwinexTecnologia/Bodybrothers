import { Route, Routes, Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import Overview from './pages/Dashboard/Overview'
import ListStudents from './pages/Students/ListStudents'
import CreateStudent from './pages/Students/CreateStudent'
import EditStudent from './pages/Students/EditStudent'
import ToggleActive from './pages/Students/ToggleActive'
import WorkoutCreate from './pages/Protocols/WorkoutCreate'
import WorkoutsActive from './pages/Protocols/WorkoutsActive'
import WorkoutsArchived from './pages/Protocols/WorkoutsArchived'
import DietCreate from './pages/Protocols/DietCreate'
import DietsActive from './pages/Protocols/DietsActive'
import DietsArchived from './pages/Protocols/DietsArchived'
import AnamnesisModels from './pages/Protocols/AnamnesisModels'
import AnamnesisModelCreate from './pages/Protocols/AnamnesisModelCreate'
import AnamnesisApply from './pages/Protocols/AnamnesisApply'
import AnamnesisPending from './pages/Protocols/AnamnesisPending'
import ViewAnamnesis from './pages/Protocols/ViewAnamnesis'
import StudentEvolution from './pages/Students/StudentEvolution'
import EvolutionCentral from './pages/Evolution/EvolutionCentral' // Import novo
import ExercisesLibrary from './pages/Protocols/ExercisesLibrary'
import PlanCreate from './pages/Protocols/PlanCreate'
import PlanEdit from './pages/Protocols/PlanEdit'
import Plans from './pages/Protocols/Plans'
import FinancialList from './pages/Financial/FinancialList'
import Conversations from './pages/Chat/Conversations'
import History from './pages/Chat/History'
import Profile from './pages/Account/Profile'
import Branding from './pages/Account/Branding'
import Preferences from './pages/Account/Preferences'
import Logout from './pages/Logout'
import Login from './pages/Auth/Login'
import ResetPassword from './pages/Auth/ResetPassword'
import SyncCredentials from './pages/SyncCredentials'
import TestConnection from './pages/TestConnection'
import Migration from './pages/Migration'
import CRM from './pages/CRM/CRM'
import CRMDashboard from './pages/CRM/Dashboard'
import StudentLogin from './pages/StudentApp/Login'
import StudentHome from './pages/StudentApp/Home'

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
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/sync-credentials" element={<SyncCredentials />} />
      <Route path="/test-connection" element={<TestConnection />} />
      <Route path="/migration" element={<Protected><Migration /></Protected>} />
      
      <Route path="/crm" element={<Protected><CRM /></Protected>} />
      <Route path="/crm/dashboard" element={<Protected><CRMDashboard /></Protected>} />

      <Route path="/dashboard/overview" element={<Protected><Overview /></Protected>} />

      <Route path="/students/list" element={<Protected><ListStudents /></Protected>} />
      <Route path="/students/create" element={<Protected><CreateStudent /></Protected>} />
      <Route path="/students/edit" element={<Protected><EditStudent /></Protected>} />
      <Route path="/students/toggle-active" element={<Protected><ToggleActive /></Protected>} />
      <Route path="/students/evolution/:id" element={<Protected><StudentEvolution /></Protected>} />
      <Route path="/evolution/central" element={<Protected><EvolutionCentral /></Protected>} />

      <Route path="/protocols/workout-create" element={<Protected><WorkoutCreate /></Protected>} />
      <Route path="/protocols/workouts/edit/:id" element={<Protected><WorkoutCreate /></Protected>} />
      <Route path="/protocols/workouts-active" element={<Protected><WorkoutsActive /></Protected>} />
      <Route path="/protocols/workouts-archived" element={<Protected><WorkoutsArchived /></Protected>} />
      <Route path="/protocols/exercises" element={<Protected><ExercisesLibrary /></Protected>} />
      <Route path="/protocols/diet-create" element={<Protected><DietCreate /></Protected>} />
      <Route path="/protocols/diets-active" element={<Protected><DietsActive /></Protected>} />
      <Route path="/protocols/diets-archived" element={<Protected><DietsArchived /></Protected>} />
      <Route path="/protocols/anamnesis-models" element={<Protected><AnamnesisModels /></Protected>} />
      <Route path="/protocols/anamnesis/model/create" element={<Protected><AnamnesisModelCreate /></Protected>} />
      <Route path="/protocols/anamnesis/model/:id" element={<Protected><AnamnesisModelCreate /></Protected>} />
      <Route path="/protocols/anamnesis/view/:id" element={<Protected><ViewAnamnesis /></Protected>} />
      <Route path="/protocols/anamnesis-apply" element={<Protected><AnamnesisApply /></Protected>} />
      <Route path="/protocols/anamnesis-pending" element={<Protected><AnamnesisPending /></Protected>} />
      <Route path="/protocols/plan-create" element={<Protected><PlanCreate /></Protected>} />
      <Route path="/protocols/plan-edit" element={<Protected><PlanEdit /></Protected>} />
      <Route path="/protocols/plans" element={<Protected><Plans /></Protected>} />

      <Route path="/chat/conversations" element={<Protected><Conversations /></Protected>} />
      <Route path="/chat/history" element={<Protected><History /></Protected>} />
      
      <Route path="/financial" element={<Protected><FinancialList /></Protected>} />

      <Route path="/account/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/account/branding" element={<Protected><Branding /></Protected>} />
      <Route path="/account/preferences" element={<Protected><Preferences /></Protected>} />
      
      <Route path="/logout" element={<Logout />} />
      
      {/* App do Aluno */}
      <Route path="/app/login" element={<StudentLogin />} />
      <Route path="/app/home" element={<Protected><StudentHome /></Protected>} />
    </Routes>
  )
}
