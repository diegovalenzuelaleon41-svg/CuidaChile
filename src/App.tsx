import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './hooks/useTheme'
import Protected from './components/Protected'
import RoleGuard from './components/RoleGuard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Registro from './pages/Registro'
import SeleccionarRol from './pages/SeleccionarRol'
import AuthCallback from './pages/AuthCallback'
import Usuario from './pages/Usuario'
import OperadorDashboard from './pages/OperadorDashboard'
import OperadorPendiente from './pages/OperadorPendiente'

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          {/* Alias legacy */}
          <Route path="/registrarse" element={<Navigate to="/registro" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/seleccionar-rol"element={<Protected><SeleccionarRol /></Protected>} />
          <Route
            path="/usuario"
            element={
              <Protected>
                <RoleGuard requiredRole="usuario">
                  <Usuario />
                </RoleGuard>
              </Protected>
            }
          />
          <Route
            path="/operador/dashboard"
            element={
              <Protected>
                <RoleGuard requiredRole="operador">
                  <OperadorDashboard />
                </RoleGuard>
              </Protected>
            }
          />
          <Route path="/operador/pendiente" element={<Protected><OperadorPendiente /></Protected>} />
          <Route path="*"element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App
