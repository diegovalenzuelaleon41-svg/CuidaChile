import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserRound, User, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

const ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors outline-none'

/**
 * Icono de usuario del header con menú desplegable (Mi Perfil, Configuración,
 * Cerrar Sesión). Se cierra con clic fuera, Escape o al elegir una opción.
 */
export default function UserMenu() {
  const { rol, signOut } = useAuth()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const raizRef = useRef<HTMLDivElement | null>(null)
  const botonRef = useRef<HTMLButtonElement | null>(null)

  // El operador aún no tiene vista de perfil propia: se le lleva a su panel.
  const rutaPerfil = rol === 'usuario' ? '/usuario?tab=perfil' : '/auth/callback'

  useEffect(() => {
    if (!abierto) return
    function onClick(e: globalThis.MouseEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false)
        botonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  async function cerrarSesion() {
    setAbierto(false)
    await signOut()
    navigate('/')
  }

  return (
    <div ref={raizRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Mi cuenta"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Mi cuenta"
        className={`w-10 h-10 rounded-full flex items-center justify-center border text-[#0B1E4A] hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:text-slate-300 dark:hover:bg-slate-800 ${
          abierto ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB] dark:border-[#3B82F6]/60 dark:bg-slate-800' : 'border-[#E2E8F0] dark:border-slate-700'
        }`}
      >
        <UserRound size={18} strokeWidth={2} />
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label="Mi cuenta"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 origin-top-right rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.10)] dark:border-slate-700 dark:bg-slate-900"
        >
          <Link
            to={rutaPerfil}
            role="menuitem"
            onClick={() => setAbierto(false)}
            className={`${ITEM} text-[#1E293B] hover:bg-[#F1F5F9] focus-visible:bg-[#F1F5F9] dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
          >
            <User size={16} strokeWidth={2} className="text-[#64748B] dark:text-slate-400" />
            Mi Perfil
          </Link>
          <Link
            to={rutaPerfil}
            role="menuitem"
            onClick={() => setAbierto(false)}
            className={`${ITEM} text-[#1E293B] hover:bg-[#F1F5F9] focus-visible:bg-[#F1F5F9] dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
          >
            <Settings size={16} strokeWidth={2} className="text-[#64748B] dark:text-slate-400" />
            Configuración
          </Link>
          <div className="my-1.5 h-px bg-[#E2E8F0] dark:bg-slate-700" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={cerrarSesion}
            className={`${ITEM} text-[#DC2626] hover:bg-[#FEF2F2] focus-visible:bg-[#FEF2F2] dark:text-[#F87171] dark:hover:bg-[#DC2626]/10 dark:focus-visible:bg-[#DC2626]/10`}
          >
            <LogOut size={16} strokeWidth={2} />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  )
}
