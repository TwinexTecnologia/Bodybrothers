import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ResetPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/reset-password" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
