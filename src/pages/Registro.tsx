import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, Phone, MapPin, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { COMUNAS_SANTIAGO } from '../lib/comunas'
import { TERMINOS_PENDIENTES_KEY, TERMINOS_VERSION } from '../lib/terminos'
import Logo from '../components/Logo'

export default function Registro() {
  const { session, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [comuna, setComuna] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Ya autenticado: /auth/callback consulta perfil.rol y redirige a su panel.
  if (session) return <Navigate to="/auth/callback" replace />

  async function handleGoogleSignUp() {
    setError(null)
    setInfo(null)
    if (!acepta) {
      setError('Debes aceptar los términos y la política de privacidad para crear tu cuenta.')
      return
    }
    // El consentimiento se registra en perfil al volver a /auth/callback
    // (sessionStorage sobrevive al redirect de OAuth en la misma pestaña).
    try {
      sessionStorage.setItem(TERMINOS_PENDIENTES_KEY, TERMINOS_VERSION)
    } catch {
      // Sin storage no se registra el consentimiento, pero no bloquea el registro
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error(error)
      setError('No se pudo registrar con Google. Intenta de nuevo.')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!acepta) {
      setError('Debes aceptar los términos y la política de privacidad para crear tu cuenta.')
      return
    }
    if (telefono && !/^\+[1-9][0-9]{7,14}$/.test(telefono.trim())) {
      setError('El teléfono debe estar en formato E.164, ej: +56912345678.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setBusy(true)
    const { error: err, needsConfirmation } = await signUp(email.trim(), password, nombre.trim())
    if (err) {
      setError(err)
      setBusy(false)
      return
    }
    // Completar perfil (telefono, comuna en direccion, consentimiento).
    // El trigger crea la fila; aquí la actualizamos si ya hay sesión.
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id ?? user?.id
      if (uid) {
        await supabase.from('perfil').update({
          telefono: telefono.trim() || null,
          direccion: comuna || null,
          terminos_version: TERMINOS_VERSION,
          terminos_aceptado_en: new Date().toISOString(),
        }).eq('id', uid)
      }
    } catch {
      // No bloquea el registro si el perfil aún no es escribible
    }
    setBusy(false)
    if (needsConfirmation) {
      setInfo(`Te enviamos un correo de confirmación a ${email.trim()}. Revisa tu bandeja para activar tu cuenta.`)
    } else {
      navigate('/auth/callback', { replace: true })
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_60%)] dark:bg-none dark:bg-slate-950">
      <div className="w-full max-w-[420px]">
        <div className="card p-8 md:p-12 relative">
          <div className="flex flex-col items-center mb-8">
            <Logo size={64} />
            <p className="mt-3 text-[14px] text-[#64748B] dark:text-slate-400 text-center">
              Crea tu cuenta para empezar a cuidarte.
            </p>
          </div>

          {info && (
            <div role="status" className="mb-5 flex gap-2 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] px-4 py-3 text-[14px] text-[#047857]">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> {info}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="nombre" className="label-cuida mb-2">Nombre completo</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="nombre" required autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre completo" className="input-cuida pl-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="telefono" className="label-cuida mb-2">Teléfono</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                  <input id="telefono" type="tel" autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56912345678" className="input-cuida pl-11" />
                </div>
              </div>
              <div>
                <label htmlFor="comuna" className="label-cuida mb-2">Comuna</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 pointer-events-none" />
                  <select id="comuna" required value={comuna} onChange={(e) => setComuna(e.target.value)}
                    className="input-cuida pl-11 appearance-none">
                    <option value="">Selecciona…</option>
                    {COMUNAS_SANTIAGO.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label-cuida mb-2">Correo Electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com" className="input-cuida pl-11" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label-cuida mb-2">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="password" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres" className="input-cuida pl-11 pr-11" />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#1E293B] dark:hover:text-white"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="label-cuida mb-2">Confirmar Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña" className="input-cuida pl-11 pr-11" />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#1E293B] dark:hover:text-white"
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="mt-1 text-[12px] text-[#DC2626]">Las contraseñas no coinciden</p>
              )}
            </div>

            <label className="flex gap-3 items-start text-[13px] text-[#475569] dark:text-slate-400 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#2563EB]" required />
              <span>
                Acepto los <a href="#" className="text-[#2563EB] dark:text-[#93C5FD] font-medium hover:underline">términos</a> y la{' '}
                <a href="#" className="text-[#2563EB] dark:text-[#93C5FD] font-medium hover:underline">política de privacidad</a>{' '}
                (Ley 19.628 y 21.719).
              </span>
            </label>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-[14px] text-[#DC2626]">
                <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-60">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Creando cuenta…</> : 'Crear cuenta'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-slate-700" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] dark:text-slate-500">O regístrate con</span>
            <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-slate-700" />
          </div>

          <button type="button" onClick={handleGoogleSignUp}
            aria-label="Registrarse con Google"
            className="group relative w-full flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[14px] sm:text-[15px] font-medium text-gray-700 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400/60 dark:focus-visible:ring-offset-slate-900">
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="absolute left-4 sm:left-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>Registrarse con Google</span>
          </button>
        </div>
        <p className="text-center mt-6 text-[14px] text-[#64748B] dark:text-slate-400">
          ¿Ya tienes una cuenta? <Link to="/login" className="font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline underline-offset-4">Inicia sesión</Link>
        </p>
      </div>
    </main>
  )
}
