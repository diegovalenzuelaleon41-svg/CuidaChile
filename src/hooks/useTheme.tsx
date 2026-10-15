import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Tema = 'light' | 'dark'

const CLAVE = 'cuidachile.theme'

function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'light' || guardado === 'dark') return guardado
  } catch {
    /* sin storage: se usa el SO */
  }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* noop */
  }
  return 'light'
}

function aplicar(tema: Tema) {
  try {
    document.documentElement.classList.toggle('dark', tema === 'dark')
    document.documentElement.style.colorScheme = tema
  } catch {
    /* noop */
  }
}

interface TemaCtx {
  theme: Tema
  esOscuro: boolean
  toggleTheme: () => void
}

const Ctx = createContext<TemaCtx>({ theme: 'light', esOscuro: false, toggleTheme: () => {} })

/** Proveedor único: todo el árbol comparte el mismo tema. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Tema>(temaInicial)

  useEffect(() => {
    aplicar(theme)
    try {
      localStorage.setItem(CLAVE, theme)
    } catch {
      /* noop */
    }
  }, [theme])

  // Seguir al SO solo mientras el usuario no haya elegido manualmente.
  useEffect(() => {
    let mq: MediaQueryList | null = null
    try {
      if (localStorage.getItem(CLAVE)) return
      mq = window.matchMedia('(prefers-color-scheme: dark)')
      const alCambiar = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', alCambiar)
      return () => mq?.removeEventListener('change', alCambiar)
    } catch {
      return undefined
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const valor = useMemo(
    () => ({ theme, esOscuro: theme === 'dark', toggleTheme }),
    [theme, toggleTheme],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/** Tema global claro/oscuro con persistencia y respeto al SO en primera visita. */
export function useTheme(): TemaCtx {
  return useContext(Ctx)
}
