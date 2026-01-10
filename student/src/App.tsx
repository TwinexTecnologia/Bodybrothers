import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Auth/Login'
import Overview from './pages/Dashboard/Overview'
import ListWorkouts from './pages/Workouts/ListWorkouts'
import ListDiets from './pages/Diets/ListDiets'
import ListAnamnesis from './pages/Anamnesis/ListAnamnesis'
import PhotoEvolution from './pages/Evolution/PhotoEvolution'
import ListPendences from './pages/Financial/ListPendences'
import Profile from './pages/Account/Profile'
import Layout from './components/Layout'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div>Carregando...</div>
  
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Rotas Protegidas com Layout Persistente */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/workouts" element={<ListWorkouts />} />
        <Route path="/diets" element={<ListDiets />} />
        <Route path="/anamnesis" element={<ListAnamnesis />} />
        <Route path="/evolution" element={<PhotoEvolution />} />
        <Route path="/financial" element={<ListPendences />} />
        <Route path="/account/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
