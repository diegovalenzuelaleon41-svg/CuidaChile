import { Navigate } from 'react-router-dom'
import { Clock, ShieldX, RotateCw, LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { rutaPorRol } from '../lib/roles'
import { PantallaCarga, PantallaError } from '../components/EstadoPantalla'
import Logo from '../components/Logo'

/**
 * /operador/pendiente — operadores que aún no aprueba un admin
 * (perfil.operador_estado = 'pendiente' | 'rechazado').
 * La aprobación se hace con public.aprobar_operador() desde el SQL Editor.
 */
export default function OperadorPendiente() {
  const { esOscuro, toggleTheme } = useTheme()
  const { user, rol, estadoOperador, rolLoading, rolError, recargarRol, signOut } = useAuth()

  if (rolLoading) return <PantallaCarga />
  if (rolError) return <PantallaError mensaje={rolError} onReintentar={recargarRol} />

  // Aprobado (o no es operador): a su panel.
  const destino = rutaPorRol(rol, estadoOperador)
  if (destino !== '/operador/pendiente') return <Navigate to={destino} replace />

  const rechazado = estadoOperador === 'rechazado'

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center gap-8 p-5 relative">
      <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
        {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <Logo size={48} />
      <div className="card max-w-[440px] w-full p-8 md:p-10 text-center">
        <span className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
          rechazado ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FFFBEB] text-[#B45309] dark:bg-slate-800 dark:text-amber-400'
        }`}>
          {rechazado ? <ShieldX size={28} strokeWidth={1.75} /> : <Clock size={28} strokeWidth={1.75} />}
        </span>
        <h1 className="mt-5 text-[22px] font-bold text-[#0F172A] dark:text-white">
          {rechazado ? 'Solicitud no aprobada' : 'Tu cuenta de operador está en revisión'}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400">
          {rechazado
            ? 'El equipo de CuidaChile no aprobó tu acceso como operador. Si crees que es un error, contáctanos.'
            : 'El panel de operador muestra información sensible de personas en riesgo, por eso cada operador es verificado por el equipo de CuidaChile. Te avisaremos cuando tu acceso esté listo.'}
        </p>
        {user?.email && (
          <p className="mt-4 text-[13px] text-[#94A3B8] dark:text-slate-500">
            Cuenta: <span className="font-medium text-[#475569] dark:text-slate-300">{user.email}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          {!rechazado && (
            <button type="button" onClick={recargarRol} className="btn-primary w-full py-3 text-[14px]">
              <RotateCw size={16} /> Volver a verificar
            </button>
          )}
          <button type="button" onClick={() => signOut()} className="btn-secondary w-full py-3 text-[14px]">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  )
}
