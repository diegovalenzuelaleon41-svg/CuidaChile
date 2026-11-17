import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, LayoutDashboard, UserRound, Menu, X } from 'lucide-react'
import Logo from './Logo'
import UserMenu from './UserMenu'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../auth/AuthContext'

const SECCIONES = [
  { id: 'inicio', texto: 'Inicio' },
  { id: 'funciones', texto: 'Funciones' },
  { id: 'como-funciona', texto: 'Cómo funciona' },
]

/** Sección de la landing que ocupa la franja central de la pantalla: la que se marca en la barra. */
function useSeccionActiva() {
  const [activa, setActiva] = useState('inicio')

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setActiva(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    SECCIONES.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return activa
}

/** Barra de la landing: siempre oscura, como el hero que tiene debajo. */
export default function Header() {
  const { esOscuro, toggleTheme } = useTheme()
  const { session } = useAuth()
  const activa = useSeccionActiva()
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Esc cierra el menú móvil; al pasar a escritorio se cierra solo.
  useEffect(() => {
    if (!menuAbierto) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false)
    const escritorio = window.matchMedia('(min-width: 768px)')
    const alCambiar = () => escritorio.matches && setMenuAbierto(false)
    window.addEventListener('keydown', alTeclear)
    escritorio.addEventListener('change', alCambiar)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      escritorio.removeEventListener('change', alCambiar)
    }
  }, [menuAbierto])

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#050B14]/75 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4 md:px-8 py-3">
        <Link to="/" aria-label="CuidaChile inicio" className="shrink-0">
          <Logo textoClaro />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium">
          {SECCIONES.map(({ id, texto }) => {
            const esActiva = activa === id
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={esActiva ? 'location' : undefined}
                className={`relative py-2 transition-colors ${esActiva ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {texto}
                {/* Línea neón bajo el enlace activo */}
                <span
                  aria-hidden
                  className={`absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-opacity duration-300 ${
                    esActiva ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </a>
            )
          })}
        </nav>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="hidden md:flex w-10 h-10 rounded-full items-center justify-center text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
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
              className="hidden md:flex w-10 h-10 rounded-full items-center justify-center border border-white/15 text-slate-300 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <UserRound size={18} strokeWidth={2} />
            </Link>
          )}
          {/* Con sesión, /auth/callback redirige al panel según el rol; sin sesión, a login. */}
          <Link
            to={session ? '/auth/callback' : '/login'}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-blue-500/60 px-3.5 py-2 text-[13px] md:px-4 md:text-[14px] font-semibold text-blue-100 transition-[border-color,box-shadow,background-color] duration-200 hover:border-blue-400 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]"
          >
            <LayoutDashboard size={16} strokeWidth={2} aria-hidden />
            {/* En teléfonos angostos el texto corto deja sitio a la hamburguesa */}
            <span className="sm:hidden">Panel</span>
            <span className="hidden sm:inline">Panel de Usuario</span>
          </Link>
          {/* Hamburguesa: solo en móvil */}
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-[background-color,box-shadow] hover:bg-white/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          >
            {menuAbierto ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Menú móvil: panel de cristal bajo la barra */}
      {menuAbierto && (
        <nav id="menu-movil" aria-label="Secciones" className="md:hidden border-t border-white/10 bg-[#050B14]/95 px-4 pb-5 pt-2 backdrop-blur-xl">
          <ul className="flex flex-col">
            {SECCIONES.map(({ id, texto }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={() => setMenuAbierto(false)}
                  aria-current={activa === id ? 'location' : undefined}
                  className={`flex min-h-[48px] items-center border-b border-white/5 text-[16px] font-medium ${
                    activa === id ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {texto}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3">
            {!session && (
              <Link to="/login" onClick={() => setMenuAbierto(false)} className="btn-cristal w-full">
                <UserRound size={18} strokeWidth={2} aria-hidden />
                Iniciar sesión
              </Link>
            )}
            <button type="button" onClick={toggleTheme} className="btn-cristal w-full">
              {esOscuro ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
              {esOscuro ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
