import { Link, useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut } from 'lucide-react'
import Logo from './Logo'
import { useTheme } from '../hooks/useTheme'
import { useRole } from '../hooks/useRole'

export default function Header() {
  const { esOscuro, toggleTheme } = useTheme()
  const { role, clearRole } = useRole()
  const navigate = useNavigate()

  const manejarCambiarRol = () => {
    clearRole()
    navigate('/seleccionar-rol', { replace: true })
  }

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
          {role ? (
            <button
              type="button"
              onClick={manejarCambiarRol}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] transition-colors"
              aria-label="Cambiar rol"
            >
              <LogOut size={16} strokeWidth={2} />
              Cambiar rol
            </button>
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
