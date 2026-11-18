import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'
import HeroBackdrop from '../components/HeroBackdrop'
import EscudoHolografico from '../components/EscudoHolografico'
import PlanetaHolografico from '../components/PlanetaHolografico'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  // AuthCallback reenvía aquí el error si el usuario canceló en Google.
  const [error, setError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error ?? null
  )
  const [busy, setBusy] = useState(false)

  // Ya autenticado: /auth/callback consulta perfil.rol y redirige a su panel.
  if (session) return <Navigate to="/auth/callback" replace />

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/auth/callback', { replace: true })
  }

  async function handleGoogleLogin() {
    setError(null)
    // Supabase redirige a Google y vuelve a /auth/callback, que resuelve el rol.
    // Esa URL debe estar en Authentication → URL Configuration → Redirect URLs.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error(error)
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#050B14] selection:bg-cyan-400/30 selection:text-white flex items-center justify-center px-5 pt-20 pb-12 sm:py-14">
      {/* Fondo del hero de la landing (constelación neón y radiales) con un planeta holográfico abajo */}
      <HeroBackdrop horizonte={false} />
      <PlanetaHolografico className="h-[26vh] sm:h-[40vh] max-h-[440px]" />

      <Link to="/"
        className="absolute top-4 left-4 md:top-6 md:left-6 z-10 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-medium text-slate-400 hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 group">
        <ArrowLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        <span>Volver al inicio</span>
      </Link>

      <div className="relative z-10 w-full max-w-[480px]">
        <div className="relative rounded-3xl border border-slate-700/50 bg-gradient-to-b from-[#0F1E3A]/70 to-[#0B1426]/70 p-8 md:p-10 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75),0_0_60px_rgba(37,99,235,0.12)]">
          {/* La luz del escudo baña el borde superior de la tarjeta y se apaga hacia la izquierda */}
          <div className="pointer-events-none absolute -top-px right-6 h-px w-2/3 bg-gradient-to-l from-transparent via-cyan-300/70 to-transparent" aria-hidden />
          <div className="pointer-events-none absolute -top-10 right-0 h-24 w-48 rounded-full bg-cyan-400/10 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -top-8 -right-2 sm:-top-6 sm:-right-4" aria-hidden>
            <EscudoHolografico className="float-card h-20 w-20 sm:h-[104px] sm:w-[104px] drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
          </div>

          <div className="flex flex-col items-center text-center mb-8">
            <Logo size={48} textoClaro textoClase="text-2xl" />
            <div className="mt-6 space-y-2">
              <h1 className="text-[30px] sm:text-[34px] font-bold leading-tight tracking-tight text-white">Inicia sesión</h1>
              <p className="mx-auto max-w-[340px] text-[15px] leading-relaxed text-slate-400 text-balance">
                Accede a tu cuenta para pedir ayuda cuando la necesites y seguir conectado con tu red de confianza.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5" noValidate>
            <div>
              <label htmlFor="email" className="block mb-2 text-[13px] font-medium text-slate-200">Correo Electrónico</label>
              <div className="relative flex items-center">
                <Mail size={17} className="pointer-events-none absolute left-3.5 text-slate-500" />
                <input id="email" type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined}
                  placeholder="ejemplo@correo.com" className={`${INPUT} pr-3.5`} />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block mb-2 text-[13px] font-medium text-slate-200">Contraseña</label>
              <div className="relative flex items-center">
                <Lock size={17} className="pointer-events-none absolute left-3.5 text-slate-500" />
                <input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined}
                  placeholder="••••••••" className={`${INPUT} pr-11`} />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-2 rounded-lg p-1.5 text-slate-500 hover:text-slate-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-[14px] text-red-300">
                <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={busy} aria-busy={busy}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-[16px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] transition duration-200 enabled:hover:brightness-110 enabled:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <><Loader2 size={17} className="animate-spin" /> Iniciando sesión…</> : <>Iniciar sesión <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-slate-800" />
            <span className="text-[13px] text-slate-400">O continúa con</span>
            <div className="flex-1 border-t border-slate-800" />
          </div>

          <button type="button" onClick={handleGoogleLogin}
            aria-label="Iniciar sesión con Google"
            className="relative w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-transparent px-4 py-3.5 text-[16px] font-medium text-white transition-colors duration-200 hover:bg-slate-800/50 active:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <p className="mt-7 flex items-center justify-center gap-1.5 text-[14px] text-slate-400">
            <ShieldCheck size={16} aria-hidden />
            Conexión segura
          </p>
        </div>

        <p className="text-center mt-6 text-[16px] text-slate-300">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  )
}

const INPUT =
  'input-oscuro w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pl-10 text-[15px] text-white caret-cyan-400 placeholder:text-slate-400/80 transition-[border-color,box-shadow] duration-200 hover:border-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20'
