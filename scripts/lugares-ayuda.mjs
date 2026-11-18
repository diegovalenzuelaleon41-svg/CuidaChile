#!/usr/bin/env node
/**
 * Descarga de OpenStreetMap (Overpass) los lugares de ayuda de Santiago y escribe
 * supabase/seed/lugares_ayuda.sql para cargarlos en la tabla public.lugares_ayuda.
 *
 *   node scripts/lugares-ayuda.mjs                 (descarga desde Overpass)
 *   node scripts/lugares-ayuda.mjs export.geojson  (archivo exportado desde overpass-turbo.eu:
 *                                                   "Exportar → GeoJSON" o "datos sin procesar")
 *
 * Después se aplica el .sql (SQL Editor de Supabase o una migración). Se puede repetir para
 * actualizar: el insert usa el id de OSM y pisa los datos anteriores.
 *
 * Datos © OpenStreetMap contributors (ODbL): la tarjeta del mapa dice la fuente.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// Gran Santiago (sur, oeste, norte, este).
const BBOX = '-33.70,-70.85,-33.30,-70.45'
const CONSULTA = `[out:json][timeout:180];
(
  nwr["amenity"="police"](${BBOX});
  nwr["amenity"="fire_station"](${BBOX});
  nwr["amenity"="hospital"](${BBOX});
  nwr["amenity"="clinic"]["name"~"SAPU|SAR|Urgencia|SUR",i](${BBOX});
);
out center tags;`

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

async function descargar() {
  for (const url of SERVIDORES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CuidaChile/1.0 (+https://cuidachile.vercel.app)' },
        body: `data=${encodeURIComponent(CONSULTA)}`,
        // Un servidor colgado no detiene el script: se pasa al siguiente.
        signal: AbortSignal.timeout(240_000),
      })
      if (!res.ok) {
        console.warn(`${url}: HTTP ${res.status}`)
        continue
      }
      return await res.json()
    } catch (e) {
      console.warn(`${url}: ${e instanceof Error ? e.message : e}`)
    }
  }
  throw new Error('Ningún servidor de Overpass respondió. Prueba de nuevo en unos minutos.')
}

function tipoDe(t) {
  if (t.amenity === 'fire_station') return 'bomberos'
  if (t.amenity === 'hospital' || t.amenity === 'clinic') return 'salud'
  const texto = `${t.name ?? ''} ${t.operator ?? ''} ${t['official_name'] ?? ''}`
  return /\bPDI\b|Investigaciones|Brigada de Investigaci|BICRIM/i.test(texto) ? 'pdi' : 'carabineros'
}

/**
 * Fuera lo que no sirve como "ayuda cercana" para alguien en la calle: oficinas administrativas,
 * unidades sin atención de público, recintos institucionales o penitenciarios, especialidades sin
 * urgencia y CESFAM sin SAPU/SAR (cierran de noche).
 */
const EXCLUIR = {
  carabineros: /Gendarmer|Prefectura|Adiestramiento|Mutualidad|M[oó]dulo de Vigilancia|S\.?I\.?A\.?T\b|Fuerzas Especiales|Radiopatrullas|Motorizada|Diplom[aá]tic|Carreteras/i,
  pdi: /Interpol|Laboratorio|Inteligencia|LACRIM|JIPOL/i,
  bomberos: /Museo|Conaf|Aeronaves|Central de Alarmas/i,
  salud: new RegExp(
    [
      'dental', '\\bCRS\\b', 'COSAM', '\\bSML\\b', 'M[eé]dico Legal', 'Penitenciari', 'Fuerza A[eé]rea', 'Militar',
      'Previsi[oó]n de Carabineros', 'Hoscar', 'Hospital de Carabineros', 'C[aá]ncer', '\\bFALP\\b', 'Gantz',
      'Geriatr', 'T[oó]rax', 'Neurocirug', 'Lucio C[oó]rdova', 'Centro de Especialidades', 'Centro M[eé]dico',
    ].join('|'),
    'i',
  ),
}

function sirve(tipo, nombre) {
  if (EXCLUIR[tipo].test(nombre)) return false
  // Un CESFAM sin SAPU/SAR no atiende urgencias de noche.
  if (tipo === 'salud' && /CESFAM|Centro de Salud Familiar|Consultorio/i.test(nombre) && !/SAPU|SAR\b/i.test(nombre)) return false
  return true
}

const NOMBRE_POR_DEFECTO = { carabineros: 'Carabineros', pdi: 'PDI', salud: 'Centro de salud', bomberos: 'Bomberos' }

const sql = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

/** Centro aproximado de una geometría GeoJSON (punto, o promedio del primer anillo). */
function centro(g) {
  if (!g) return null
  if (g.type === 'Point') return { lon: g.coordinates[0], lat: g.coordinates[1] }
  let anillo = g.coordinates
  while (Array.isArray(anillo?.[0]?.[0])) anillo = anillo[0]
  if (!Array.isArray(anillo) || anillo.length === 0) return null
  const s = anillo.reduce((a, [x, y]) => ({ lon: a.lon + x, lat: a.lat + y }), { lon: 0, lat: 0 })
  return { lon: s.lon / anillo.length, lat: s.lat / anillo.length }
}

/** Lee un archivo de overpass-turbo: JSON sin procesar (elements) o GeoJSON (features). */
function leerArchivo(ruta) {
  const j = JSON.parse(readFileSync(ruta, 'utf8'))
  if (Array.isArray(j.elements)) return j
  if (!Array.isArray(j.features)) throw new Error('El archivo no parece una exportación de overpass-turbo.')
  return {
    elements: j.features.map((f) => {
      const p = f.properties ?? {}
      const [type, id] = String(p['@id'] ?? f.id ?? '').split('/')
      const c = centro(f.geometry)
      return { type, id, lat: c?.lat, lon: c?.lon, tags: p.tags ?? p }
    }),
  }
}

/** Clave para detectar el mismo lugar cargado dos veces en OSM (punto y edificio). */
const claveNombre = (tipo, nombre) =>
  `${tipo}:${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
const vistos = new Map()
const cerca = (a, b) => Math.hypot((a.lat - b.lat) * 111_000, (a.lng - b.lng) * 93_000) < 400

const datos = process.argv[2] ? leerArchivo(process.argv[2]) : await descargar()
const filas = []
const excluidos = []
for (const e of datos.elements ?? []) {
  const t = e.tags ?? {}
  const lat = e.lat ?? e.center?.lat
  const lng = e.lon ?? e.center?.lon
  if (lat == null || lng == null) continue
  const tipo = tipoDe(t)
  const nombre = (t.name ?? t.official_name ?? NOMBRE_POR_DEFECTO[tipo]).slice(0, 160)
  if (!sirve(tipo, nombre)) {
    excluidos.push(`${tipo}: ${nombre}`)
    continue
  }
  const clave = claveNombre(tipo, nombre)
  if ((vistos.get(clave) ?? []).some((p) => cerca(p, { lat, lng }))) {
    excluidos.push(`${tipo}: ${nombre} (duplicado)`)
    continue
  }
  vistos.set(clave, [...(vistos.get(clave) ?? []), { lat, lng }])
  const calle = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')
  const direccion = [calle, t['addr:city'] ?? t['addr:suburb']].filter(Boolean).join(', ').slice(0, 200) || null
  const telefono = (t.phone ?? t['contact:phone'] ?? '').split(';')[0].trim().slice(0, 40) || null
  filas.push(
    `(${sql(`${e.type}/${e.id}`)}, ${sql(tipo)}, ${sql(nombre)}, ${sql(direccion)}, ${sql(telefono)}, ${lat.toFixed(6)}, ${lng.toFixed(6)})`,
  )
}

if (filas.length === 0) throw new Error('La consulta no devolvió lugares.')

const salida = `-- Generado por scripts/lugares-ayuda.mjs el ${new Date().toISOString().slice(0, 10)}.
-- Datos © OpenStreetMap contributors (ODbL). ${filas.length} lugares.
insert into public.lugares_ayuda (osm_id, tipo, nombre, direccion, telefono, lat, lng)
values
${filas.join(',\n')}
on conflict (osm_id) do update
  set tipo = excluded.tipo, nombre = excluded.nombre, direccion = excluded.direccion,
      telefono = excluded.telefono, lat = excluded.lat, lng = excluded.lng, revisado_en = current_date;
`

mkdirSync('supabase/seed', { recursive: true })
writeFileSync('supabase/seed/lugares_ayuda.sql', salida)
const porTipo = {}
for (const f of filas) {
  const tipo = f.split(', ')[1].replace(/'/g, '')
  porTipo[tipo] = (porTipo[tipo] ?? 0) + 1
}
console.log(`Listo: ${filas.length} lugares en supabase/seed/lugares_ayuda.sql`, porTipo)
console.log(`Excluidos (${excluidos.length}):`)
for (const x of excluidos) console.log(`  ${x}`)
