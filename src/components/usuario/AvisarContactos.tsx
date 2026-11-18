import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, MessageCircle, MessageSquareText, Share2 } from 'lucide-react'
import type { Contacto } from '../../store/usoSeguridad'
import {
  crearLinkSeguimiento,
  linkSMS,
  linkWhatsApp,
  mensajeSeguimiento,
  type ObjetivoSeguimiento,
} from '../../lib/seguimiento'

interface Props {
  tipo: 'sos' | 'ruta'
  /** La alerta o la ruta abierta; null mientras se crea. */
  objetivo: ObjetivoSeguimiento | null
  contactos: Contacto[]
  /** Tonos para fondo oscuro (pantalla SOS) o para tarjeta normal. */
  tono?: 'sos' | 'tarjeta'
}

/**
 * Manda a los contactos de confianza un link para ver en vivo el SOS o la ruta. El mensaje sale
 * desde el teléfono del usuario (WhatsApp o SMS ya escritos): CuidaChile no lo envía por su cuenta.
 */
export default function AvisarContactos({ tipo, objetivo, contactos, tono = 'sos' }: Props) {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const esAlerta = !!objetivo && 'alertaId' in objetivo
  const clave = objetivo ? ('alertaId' in objetivo ? objetivo.alertaId : objetivo.acompanamientoId) : null

  useEffect(() => {
    if (!clave) return
    let cancelado = false
    void crearLinkSeguimiento(esAlerta ? { alertaId: clave } : { acompanamientoId: clave }).then((url) => {
      if (cancelado) return
      setLink(url)
      setError(!url)
    })
    return () => {
      cancelado = true
    }
  }, [clave, esAlerta])

  const texto = link ? mensajeSeguimiento(tipo, link) : ''
  const oscuro = tono === 'sos'
  const caja = oscuro ? 'border-slate-800 bg-slate-900/80' : 'border-line bg-white dark:border-slate-700 dark:bg-slate-900'
  const titulo = oscuro ? 'text-slate-100' : 'text-heading dark:text-white'
  const suave = oscuro ? 'text-slate-400' : 'text-muted dark:text-slate-400'
  const boton =
    'flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors disabled:opacity-50'

  async function compartir() {
    if (!link) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CuidaChile', text: texto })
        return
      }
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <section className={`mt-6 rounded-3xl border p-5 ${caja}`} aria-label="Avisar a tus contactos">
      <h3 className={`text-[16px] font-bold ${titulo}`}>
        {tipo === 'sos' ? 'Avisa a tus contactos' : 'Comparte tu trayecto'}
      </h3>
      <p className={`mt-1 text-[13px] leading-snug ${suave}`}>
        Les llega un link para ver dónde estás mientras {tipo === 'sos' ? 'la alerta' : 'la ruta'} siga activa.
      </p>

      {!link && !error && (
        <p className={`mt-4 flex items-center gap-2 text-[13px] ${suave}`}>
          <Loader2 size={16} className="animate-spin" /> Preparando el link…
        </p>
      )}
      {error && <p className="mt-4 text-[13px] text-amber-300">No pudimos crear el link. Revisa tu conexión.</p>}

      {link && (
        <>
          {contactos.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {contactos.map((c) => {
                const wa = linkWhatsApp(c.telefono, texto)
                const sms = linkSMS(c.telefono, texto)
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${titulo}`}>{c.nombre}</span>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className={`${boton} bg-emerald-600 text-white hover:bg-emerald-500`}
                        aria-label={`Enviar por WhatsApp a ${c.nombre}`}
                      >
                        <MessageCircle size={16} /> WhatsApp
                      </a>
                    )}
                    {sms && (
                      <a
                        href={sms}
                        className={`${boton} ${oscuro ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-canvas text-heading hover:bg-line dark:bg-slate-800 dark:text-white'}`}
                        aria-label={`Enviar SMS a ${c.nombre}`}
                      >
                        <MessageSquareText size={16} /> SMS
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void compartir()}
            className={`${boton} mt-4 w-full ${oscuro ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
          >
            {copiado ? <Check size={16} /> : 'share' in navigator ? <Share2 size={16} /> : <Copy size={16} />}
            {copiado ? 'Link copiado' : contactos.length > 0 ? 'Compartir con otra persona' : 'Compartir el link'}
          </button>
        </>
      )}
    </section>
  )
}
