import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

/**
 * Política de privacidad. Cada afirmación sale del código y de la base (migraciones en
 * supabase/migrations). Es un BORRADOR: falta la revisión de un abogado, el responsable legal y un
 * correo de contacto, que se completan en RESPONSABLE antes de quitar el aviso.
 */
const RESPONSABLE = {
  nombre: '',
  correo: '',
}
const BORRADOR = !RESPONSABLE.nombre || !RESPONSABLE.correo

const SECCIONES: { titulo: string; parrafos: string[] }[] = [
  {
    titulo: 'Qué datos guardamos',
    parrafos: [
      'Tu cuenta: nombre, correo y teléfono. Si entras con Google, recibimos tu nombre y tu correo de Google.',
      'Tus contactos de confianza: el nombre, el teléfono y la relación que tú escribes.',
      'Tus rutas y alertas: origen, destino, horas de inicio y término, y los mensajes del chat con la central.',
      'Tus reportes del barrio: el lugar, la categoría, la descripción y, si los agregas, una foto o una nota de voz. Los reportes que la central valida se muestran a la comunidad sin tu nombre durante 6 horas.',
      'Tu PIN de seguridad y tu PIN de coacción se guardan como un hash irreversible: nadie, ni siquiera la central, puede leerlos.',
    ],
  },
  {
    titulo: 'Cuándo usamos tu ubicación',
    parrafos: [
      'Solo mientras tienes una ruta acompañada o una alerta SOS abierta: cada 5 segundos en una ruta y cada 3 segundos en un SOS. Cuando termina, el envío se detiene.',
      'Fuera de eso la app puede mostrarte tu posición en el mapa, pero no la envía a la central.',
    ],
  },
  {
    titulo: 'Quién ve tus datos',
    parrafos: [
      'Los operadores aprobados de la central ven tu nombre, tu teléfono y tu ubicación en vivo mientras atienden tu ruta o tu alerta.',
      'Si compartes un link de seguimiento, quien lo tenga ve tu primer nombre y tu ubicación mientras la ruta o la alerta sigan abiertas, y como máximo 12 horas. Después el link solo dice que terminó.',
      'No vendemos tus datos ni los usamos para publicidad.',
    ],
  },
  {
    titulo: 'Servicios que usamos',
    parrafos: [
      'Supabase guarda la base de datos y las cuentas. Vercel publica la aplicación.',
      'Los mapas vienen de CARTO, OpenFreeMap y OpenStreetMap. Para buscar direcciones usamos Nominatim (OpenStreetMap) y para trazar rutas, OSRM: a ellos llegan las coordenadas o el texto de la búsqueda, no tu nombre.',
      'Las llamadas de voz con la central pasan por LiveKit.',
      'Toda la comunicación entre tu teléfono y estos servicios va cifrada (HTTPS).',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'Según la Ley 19.628 y la Ley 21.719 puedes pedir acceso a tus datos, corregirlos, eliminarlos, oponerte a su tratamiento y pedir una copia para llevarlos a otro servicio.',
    ],
  },
]

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-300">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-32 md:px-8">
        {BORRADOR && (
          <p className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Borrador en revisión. Esta política describe cómo funciona hoy la aplicación, pero todavía no tiene la revisión
            legal final.
          </p>
        )}
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Política de privacidad</p>
        <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
          Qué hacemos con tus datos
        </h1>
        <p className="mt-5 text-pretty text-base text-slate-400">
          CuidaChile existe para que llegues bien a casa. Para eso necesitamos algunos datos tuyos; aquí está cuáles, cuándo y
          quién los ve.
        </p>

        {SECCIONES.map((s) => (
          <section key={s.titulo} className="mt-12">
            <h2 className="text-2xl font-semibold text-white">{s.titulo}</h2>
            <ul className="mt-4 space-y-3">
              {s.parrafos.map((p) => (
                <li key={p} className="flex items-start gap-3 text-pretty text-base leading-relaxed">
                  <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-white">Contacto</h2>
          <p className="mt-4 text-base leading-relaxed">
            {RESPONSABLE.correo ? (
              <>
                Para ejercer tus derechos o hacer una consulta escribe a{' '}
                <a href={`mailto:${RESPONSABLE.correo}`} className="text-cyan-300 underline underline-offset-4">
                  {RESPONSABLE.correo}
                </a>
                . Responsable del tratamiento: {RESPONSABLE.nombre}.
              </>
            ) : (
              'Muy pronto publicaremos aquí el correo para ejercer tus derechos y el responsable del tratamiento.'
            )}
          </p>
        </section>

        <Link to="/" className="mt-16 inline-block text-sm text-slate-400 hover:text-white">
          ← Volver al inicio
        </Link>
      </main>
      <Footer />
    </div>
  )
}
