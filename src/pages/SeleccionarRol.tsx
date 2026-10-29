import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Footprints, Headset, ArrowRight, Sun, Moon, AlertCircle, Loader2, Info } from 'lucide-react'
import Logo from '../components/Logo'
import { PantallaError } from '../components/EstadoPantalla'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../auth/AuthContext'
import { rutaPorRol, type Rol } from '../lib/roles'

export default function SeleccionarRol() {
  const { esOscuro, toggleTheme } = useTheme()
  const { rol, rolLoading, rolError, recargarRol, asignarRol } = useAuth()
  const [enviando, setEnviando] = useState<Rol | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El rol es definitivo: quien ya lo tiene nunca vuelve a ver esta pantalla.
  // También cubre el momento justo después de elegir: asignarRol actualiza el
  // contexto, este componente se vuelve a renderizar y redirige.
  if (!rolLoading && rol) return <Navigate to={rutaPorRol(rol)} replace />
  // Si no sabemos el rol, no ofrecemos elegir (podría ya tener uno).
  if (rolError) return <PantallaError mensaje={rolError} onReintentar={recargarRol} />

  async function manejarSeleccion(nuevo: Rol) {
    setEnviando(nuevo)
    setError(null)
    const err = await asignarRol(nuevo)
    setEnviando(null)
    if (err) setError(err)
  }

  const botonTema = (
    <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
      {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )

  if (rolLoading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center px-5 py-14 relative">
        {botonTema}
        <Logo size={48} />
        <div className="mt-10 w-10 h-10 rounded-full border-4 border-[#DBEAFE] border-t-[#2563EB] animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center px-5 py-14 relative">
      {botonTema}
      <Logo size={48} />
      <h1 className="mt-6 text-[28px] md:text-[32px] font-bold tracking-tight text-[#0F172A] dark:text-white text-center">
        ¿Cómo quieres usar CuidaChile?
      </h1>
      <p className="mt-2 text-[15px] text-[#64748B] dark:text-slate-400 text-center">
        Elige tu rol para personalizar tu experiencia.
      </p>
      <p className="mt-4 flex items-center gap-2 rounded-[10px] bg-[#EFF6FF] dark:bg-slate-800 px-4 py-2.5 text-[13px] text-[#1E40AF] dark:text-[#93C5FD] text-center">
        <Info size={16} className="shrink-0" /> Esta elección es definitiva y no se puede cambiar después.
      </p>

      {error && (
        <div role="alert" className="mt-6 w-full max-w-[760px] flex items-center gap-2 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-[14px] text-[#DC2626]">
          <AlertCircle size={18} className="shrink-0" /> {error}
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-6 w-full max-w-[760px]">
        <div className="card p-8 flex flex-col">
          <span className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 text-[#2563EB] flex items-center justify-center">
            <Footprints size={24} strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[20px] font-bold text-[#0F172A] dark:text-white">Soy Usuario</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400 flex-1">
            Activa tu ruta, comparte tu ubicación y mantén a tus contactos tranquilos.
          </p>
          <button
            type="button"
            onClick={() => manejarSeleccion('usuario')}
            disabled={enviando !== null}
            className="btn-primary mt-6 w-full py-3 text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {enviando === 'usuario'
              ? <><Loader2 size={16} className="animate-spin" /> Guardando…</>
              : <>Entrar como Usuario <ArrowRight size={16} /></>}
          </button>
        </div>

        <div className="card p-8 flex flex-col">
          <span className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 text-[#2563EB] flex items-center justify-center">
            <Headset size={24} strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[20px] font-bold text-[#0F172A] dark:text-white">Soy Operador</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400 flex-1">
            Gestiona alertas activas, acompaña a los usuarios y coordina la respuesta.
          </p>
          <button
            type="button"
            onClick={() => manejarSeleccion('operador')}
            disabled={enviando !== null}
            className="btn-secondary mt-6 w-full py-3 text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {enviando === 'operador'
              ? <><Loader2 size={16} className="animate-spin" /> Guardando…</>
              : <>Entrar como Operador <ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </main>
  )
}
