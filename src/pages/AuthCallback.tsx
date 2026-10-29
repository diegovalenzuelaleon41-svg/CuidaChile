import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { rutaPorRol } from '../lib/roles'
import { PantallaCarga, PantallaError } from '../components/EstadoPantalla'

/**
 * /auth/callback — punto único de entrada después de autenticarse.
 *
 * Llegan aquí: el login con email, el regreso de Google OAuth, el enlace
 * del correo de confirmación y el botón "Ir a mi panel". supabase-js
 * procesa los tokens de la URL al iniciar (detectSessionInUrl); esta página
 * solo espera la sesión + el rol y redirige:
 *   operador → /operador/dashboard · usuario → /usuario · sin rol → /seleccionar-rol
 */
export default function AuthCallback() {
  const { session, loading, rolLoading, rol, rolError, recargarRol } = useAuth()

  // Google devuelve ?error=…&error_description=… (o en el hash) si el usuario cancela.
  const params = new URLSearchParams(window.location.search || window.location.hash.slice(1))
  const errorOAuth = params.get('error_description') ?? params.get('error')

  if (loading || (session && rolLoading)) return <PantallaCarga />
  if (!session) {
    if (errorOAuth) return <Navigate to="/login" replace state={{ error: errorOAuth }} />
    return <Navigate to="/login" replace />
  }
  if (rolError) return <PantallaError mensaje={rolError} onReintentar={recargarRol} />
  return <Navigate to={rutaPorRol(rol)} replace />
}
