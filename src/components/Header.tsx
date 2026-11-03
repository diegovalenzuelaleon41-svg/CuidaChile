import { Link } from 'react-router-dom'
import { Sun, Moon, LayoutDashboard, UserRound } from 'lucide-react'
import Logo from './Logo'
import UserMenu from './UserMenu'
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
          {/* Con sesión: menú de cuenta. Sin sesión: el icono lleva a login. */}
          {session ? (
            <UserMenu />
          ) : (
            <Link
              to="/login"
              aria-label="Iniciar sesión"
              title="Iniciar sesión"
              className="w-10 h-10 rounded-full flex items-center justify-center border border-[#E2E8F0] text-[#0B1E4A] hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <UserRound size={18} strokeWidth={2} />
            </Link>
          )}
          {/* Con sesión, /auth/callback redirige al panel según el rol; sin sesión, a login. */}
          <Link
            to={session ? '/auth/callback' : '/login'}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border-[1.5px] border-[#93C5FD] text-[#2563EB] text-[14px] font-semibold hover:bg-[#EFF6FF] hover:border-[#2563EB] transition-colors dark:border-[#3B82F6]/60 dark:text-[#93C5FD] dark:hover:bg-slate-800"
          >
            <LayoutDashboard size={16} strokeWidth={2} />
            Panel de Usuario
          </Link>
        </div>
      </div>
    </header>
  )
}
