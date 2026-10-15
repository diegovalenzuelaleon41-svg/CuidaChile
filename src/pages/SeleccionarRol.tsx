import { Link } from 'react-router-dom'
import { Footprints, Headset, ArrowRight, Sun, Moon } from 'lucide-react'
import Logo from '../components/Logo'
import { useTheme } from '../hooks/useTheme'

export default function SeleccionarRol() {
  const { esOscuro, toggleTheme } = useTheme()
  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center px-5 py-14 relative">
      <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
        {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <Logo size={48} />
      <h1 className="mt-6 text-[28px] md:text-[32px] font-bold tracking-tight text-[#0F172A] dark:text-white text-center">
        ¿Cómo quieres usar CuidaChile?
      </h1>
      <p className="mt-2 text-[15px] text-[#64748B] dark:text-slate-400 text-center">
        Elige tu rol para personalizar tu experiencia.
      </p>

      <div className="mt-10 grid md:grid-cols-2 gap-6 w-full max-w-[760px]">
        <div className="card p-8 flex flex-col">
          <span className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 text-[#2563EB] flex items-center justify-center">
            <Footprints size={24} strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[20px] font-bold text-[#0F172A] dark:text-white">Soy Usuario</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400 flex-1">
            Activa tu ruta, comparte tu ubicación y mantén a tus contactos tranquilos.
          </p>
          <Link to="/usuario" className="btn-primary mt-6 w-full py-3 text-[14px]">
            Entrar como Usuario <ArrowRight size={16} />
          </Link>
        </div>

        <div className="card p-8 flex flex-col">
          <span className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 text-[#2563EB] flex items-center justify-center">
            <Headset size={24} strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[20px] font-bold text-[#0F172A] dark:text-white">Soy Operador</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B] dark:text-slate-400 flex-1">
            Gestiona alertas activas, acompaña a los usuarios y coordina la respuesta.
          </p>
          <Link to="/operador/dashboard" className="btn-secondary mt-6 w-full py-3 text-[14px]">
            Entrar como Operador <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </main>
  )
}
