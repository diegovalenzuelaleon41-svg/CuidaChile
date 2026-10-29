import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PostgrestError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { esEstadoOperadorValido, esRolValido, type EstadoOperador, type Rol } from '../lib/roles'

interface SignUpResult {
  error: string | null
  needsConfirmation: boolean
}

/** Rol cargado para un usuario concreto (evita mostrar el rol de una sesión anterior). */
interface EstadoRol {
  userId: string
  rol: Rol | null
  estadoOperador: EstadoOperador | null
  error: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /** Rol definitivo desde perfil.rol. null = aún no lo elige. */
  rol: Rol | null
  /** Solo operadores: 'aprobado' abre el panel; lo asigna un admin. */
  estadoOperador: EstadoOperador | null
  /** true mientras se consulta el rol del usuario actual. */
  rolLoading: boolean
  rolError: string | null
  recargarRol: () => void
  /** Asigna el rol una única vez. Devuelve un mensaje de error o null. */
  asignarRol: (rol: Rol) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ERROR_RED = 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
const ERROR_SERVIDOR = 'No pudimos cargar tu perfil por un problema del servidor. Intenta de nuevo en unos minutos.'

/** supabase-js no trae code cuando falla el fetch (sin internet, DNS, CORS). */
function esErrorDeRed(error: PostgrestError) {
  return !error.code || /failed to fetch|network|load failed/i.test(error.message)
}

/**
 * Lee rol y operador_estado de perfil. Si la fila no existe (el trigger
 * crear_perfil_usuario_nuevo falló al registrarse), la crea con rol NULL:
 * rutaPorRol() manda entonces a /seleccionar-rol.
 */
async function cargarPerfil(user: User): Promise<EstadoRol> {
  const sinRol: EstadoRol = { userId: user.id, rol: null, estadoOperador: null, error: null }

  const { data, error } = await supabase
    .from('perfil')
    .select('rol, operador_estado')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    // Ej.: 42703 = columna inexistente (falta aplicar una migración).
    console.error('[perfil] error al cargar:', error.code, error.message)
    return { ...sinRol, error: esErrorDeRed(error) ? ERROR_RED : ERROR_SERVIDOR }
  }

  if (data) {
    return {
      ...sinRol,
      rol: esRolValido(data.rol) ? data.rol : null,
      estadoOperador: esEstadoOperadorValido(data.operador_estado) ? data.operador_estado : null,
    }
  }

  // Sin fila. rol no se envía: proteger_rol_perfil() lo fuerza a NULL igual.
  // email y nombre son NOT NULL en perfil.
  const meta = user.user_metadata ?? {}
  const nombre = meta.full_name || meta.name || user.email?.split('@')[0] || 'Usuario'
  const email = user.email ?? `usuario-${user.id}@cuidachile.local`
  const { error: errInsert } = await supabase
    .from('perfil')
    .upsert({ id: user.id, nombre, email }, { onConflict: 'id', ignoreDuplicates: true })

  if (errInsert) {
    console.error('[perfil] no se pudo crear:', errInsert.code, errInsert.message)
    if (esErrorDeRed(errInsert)) return { ...sinRol, error: ERROR_RED }
    // Si RLS no permite insertar, /seleccionar-rol mostrará el error de asignar_rol().
  }
  return sinRol
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [estadoRol, setEstadoRol] = useState<EstadoRol | null>(null)
  const [intentoRol, setIntentoRol] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Consulta el rol cada vez que cambia el usuario (login, logout, cambio de cuenta).
  // Depende de user.id y no de user: el refresco de token crea un objeto nuevo
  // con el mismo id y no debe volver a consultar.
  const userId = user?.id
  useEffect(() => {
    if (!userId || !user) return
    let activo = true
    cargarPerfil(user).then((estado) => {
      if (activo) setEstadoRol(estado)
    })
    return () => { activo = false }
  }, [userId, intentoRol])

  const vigente = userId && estadoRol?.userId === userId ? estadoRol : null
  const rolLoading = !!userId && !vigente

  const recargarRol = useCallback(() => {
    setEstadoRol(null)
    setIntentoRol((n) => n + 1)
  }, [])

  async function asignarRol(nuevo: Rol): Promise<string | null> {
    if (!userId) return 'Debes iniciar sesión.'
    const { data, error } = await supabase.rpc('asignar_rol', { p_rol: nuevo })
    if (error) {
      // Ya tenía rol (p. ej. lo eligió en otra pestaña): recargar lo redirige a su panel.
      if (error.hint === 'rol_ya_asignado') recargarRol()
      return error.message
    }
    const rolAsignado = esRolValido(data) ? data : nuevo
    setEstadoRol({
      userId,
      rol: rolAsignado,
      // asignar_rol() deja a todo operador nuevo en revisión.
      estadoOperador: rolAsignado === 'operador' ? 'pendiente' : null,
      error: null,
    })
    return null
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }

  async function signUp(email: string, password: string, fullName: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // El enlace del correo de confirmación vuelve al resolvedor de rol.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })
    if (error) return { error: error.message, needsConfirmation: false }
    const needsConfirmation = !data.session
    return { error: null, needsConfirmation }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session, user, loading,
        rol: vigente?.rol ?? null,
        estadoOperador: vigente?.estadoOperador ?? null,
        rolLoading,
        rolError: vigente?.error ?? null,
        recargarRol, asignarRol,
        signIn, signUp, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}

export { AuthProvider, useAuth }
