import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, LayoutDashboard, UserRound } from 'lucide-react'
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

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#050B14]/75 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-5 md:px-8 py-3">
        <Link to="/" aria-label="CuidaChile inicio">
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
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
              className="w-10 h-10 rounded-full flex items-center justify-center border border-white/15 text-slate-300 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <UserRound size={18} strokeWidth={2} />
            </Link>
          )}
          {/* Con sesión, /auth/callback redirige al panel según el rol; sin sesión, a login. */}
          <Link
            to={session ? '/auth/callback' : '/login'}
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-blue-500/60 px-4 py-2 text-[14px] font-semibold text-blue-100 transition-[border-color,box-shadow,background-color] duration-200 hover:border-blue-400 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]"
          >
            <LayoutDashboard size={16} strokeWidth={2} />
            Panel de Usuario
          </Link>
        </div>
      </div>
    </header>
  )
}
