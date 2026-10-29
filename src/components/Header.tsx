import { Link } from 'react-router-dom'
import { Sun, Moon, LayoutDashboard } from 'lucide-react'
import Logo from './Logo'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../auth/AuthContext'

export default function Header() {
  const { esOscuro, toggleTheme } = useTheme()
  const { session } = useAuth()

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-[#E2E8F0] dark:border-slate-700">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-5 md:px-8 py-3">
        <Link to="/" aria-label="CuidaChile inicio">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#374151] dark:text-slate-300">
          <a href="#inicio" className="hover:text-[#2563EB] transition-colors">Inicio</a>
          <a href="#funciones" className="hover:text-[#2563EB] transition-colors">Funciones</a>
          <a href="#como-funciona" className="hover:text-[#2563EB] transition-colors">Cómo funciona</a>
        </nav>
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
            {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {session ? (
            // El rol es definitivo: en vez de "Cambiar rol", se va al panel que le corresponde.
            <Link
              to="/auth/callback"
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] transition-colors"
            >
              <LayoutDashboard size={16} strokeWidth={2} />
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-[14px] font-semibold text-[#2563EB] hover:underline underline-offset-4 px-2 py-2">
                Iniciar sesión
              </Link>
              <Link to="/registro" className="btn-primary px-5 py-2.5 text-[14px]">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
