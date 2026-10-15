import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, Phone, MapPin, AlertCircle, Loader2, CheckCircle2, Sun, Moon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { COMUNAS_SANTIAGO } from '../lib/comunas'
import Logo from '../components/Logo'

export default function Registro() {
  const { session, signUp, user } = useAuth()
  const { esOscuro, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [comuna, setComuna] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/seleccionar-rol" replace />

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
          terminos_version: 'v1-ley-19628-21719',
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
      navigate('/seleccionar-rol', { replace: true })
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_60%)] dark:bg-none dark:bg-slate-950">
      <div className="w-full max-w-[420px]">
        <div className="card p-8 md:p-12 relative">
          <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
            {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
        </div>
        <p className="text-center mt-6 text-[14px] text-[#64748B] dark:text-slate-400">
          ¿Ya tienes una cuenta? <Link to="/login" className="font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline underline-offset-4">Inicia sesión</Link>
        </p>
      </div>
    </main>
  )
}
