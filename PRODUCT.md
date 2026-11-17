# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Principal:** personas que vuelven solas de noche en Santiago: mujeres, estudiantes y trabajadores en trayectos que sienten de riesgo. Usan la app en la calle, desde el teléfono, a menudo con una mano, con poca atención disponible y a veces con miedo. Su trabajo: llegar bien a destino y, si algo pasa, pedir ayuda sin tener que explicar dónde están.

**Secundarios:**
- Operadores de la central de CuidaChile (equipo propio). Atienden alertas SOS y rutas acompañadas desde el panel de operador, en escritorio, durante turnos.
- Vecinos que reportan lo que ven en su cuadra y consultan el mapa de reportes.

## Product Purpose

CuidaChile acompaña el trayecto diario y responde cuando alguien pide ayuda. La persona marca a dónde va y un operador sigue su ruta en vivo hasta que llega; si algo pasa, mantiene presionado el SOS y su ubicación llega a la central, donde un operador le escribe o la llama dentro de la app.

Éxito: que la persona llegue bien a casa, y que cuando pida ayuda la reciba de una persona real, rápido y sin pasos de más.

## Positioning

Detrás de la app hay una central de operadores humanos del propio equipo de CuidaChile, verificados uno a uno, que acompañan rutas en vivo y responden alertas por chat o llamada. No es solo un botón que avisa a contactos ni solo un mapa de reportes vecinales.

## Operating Context

- Uso móvil en la calle, de noche, en movimiento. El SOS debe funcionar con un dedo, sin mirar mucho la pantalla y sin envíos accidentales.
- El panel de operador se usa en escritorio por personas en turno que atienden casos sensibles.
- Cobertura declarada: todo Santiago.

## Capabilities and Constraints

**Confirmado en el código:**
- SOS que se envía al mantener presionado 1,5 s. Una alerta enviada solo se cancela con el PIN de 4 dígitos del usuario.
- La ubicación se envía a la central solo mientras hay una alerta SOS o una ruta acompañada activa (useSOS, useAcompanamiento).
- Ruta segura: destino buscado o elegido en el mapa, trazado por calles (OSRM) y seguimiento en vivo por un operador.
- Chat y llamada VoIP con el operador (LiveKit) dentro de la app.
- Círculo de confianza de hasta 5 contactos.
- Autoprotección desde la pantalla SOS: sirena de disuasión generada en el navegador y linterna (flash de la cámara trasera, o pantalla en blanco donde el navegador no da acceso al flash). La cámara solo se usa para el flash; no se graba nada. En iOS el modo silencio puede apagar la sirena.
- Reportes de barrio con foto opcional, nota de voz corta opcional y anonimato. Un operador los valida y los vecinos los ven en el mapa.
- Historial de rutas del usuario y datos de la ruta activa (tiempo en ruta, precisión GPS, tamaño del círculo).
- Contexto mínimo para el operador (`contexto_ciudadano`): solo conteos (SOS previas y fecha de la última, número de contactos), nunca nombres ni teléfonos, y solo de ciudadanos con un caso abierto.
- Escalamiento a supervisor: el operador asignado puede escalar un caso abierto una vez, con motivo (violencia, rehén, falla técnica, otro). Queda en una bitácora (`alerta_escalamientos`).
- Operadores aprobados manualmente por el equipo antes de acceder al panel (`aprobar_operador`).
- Roles: usuario y operador, con rutas `/usuario`, `/operador/dashboard` y `/operador/pendiente`.
- Stack existente: Vite, React 19, TypeScript, Tailwind 3, Supabase, MapLibre (CARTO), LiveKit. Despliegue en Vercel (cuidachile.vercel.app).
- Terminología: "SOS", "Ruta Segura", "círculo de confianza", "central", "operador", "reporte".

**Sin decidir:**
- Horario de atención de la central.
- Modelo de negocio y precio.
- Lugares guardados (Casa, Trabajo): la interfaz los muestra, pero la app aún no los guarda.
- Rol supervisor/admin: previsto. Los escalamientos ya se registran y la base de datos los deja leer a supervisores, pero aún no hay panel de supervisor.

## Brand Commitments

- Nombre: CuidaChile.
- Idioma: español de Chile, tuteo ("tú"), frases simples.
- Cumplimiento de la Ley 19.628 y la Ley 21.719 de protección de datos, citado en el registro, la landing y el footer.
- Voz verídica: el usuario debe sentir confianza, así que nada de promesas vacías ni datos sin respaldo. Cada afirmación sobre tiempos, cifrado o cobertura tiene que poder sostenerse.

## Evidence on Hand

- Prototipo creado en Hacker-House 2026 (crédito en el footer).
- **No existen todavía:** usuarios reales, testimonios, métricas de tiempo de respuesta, cifras de uso, aliados ni prensa. No se deben inventar. Los números de ejemplo, como un tiempo de respuesta promedio, no se publican como reales.
- Assets: logo en `public/img/Logo.png` y `public/img/logo-2.png`, mapa de referencia en `public/img/mapa-santiago.png`, ilustración de operador en `public/img/operador.svg`.

## Product Principles

1. **Una persona real responde.** El valor central es el operador humano; la interfaz debe hacerlo visible y cercano.
2. **Pedir ayuda no puede fallar ni dispararse solo.** El SOS es inmediato cuando se quiere y a prueba de toques accidentales cuando no.
3. **Ubicación mínima y consentida.** Se comparte solo lo necesario, solo mientras hace falta, y se dice cuándo.
4. **Verdad antes que marketing.** Solo se afirma lo que el producto cumple hoy.
5. **Hecho para la calle de noche.** Una mano, poca atención, poca luz y buena legibilidad.

## Accessibility & Inclusion

- Uso con una mano y bajo estrés: objetivos táctiles grandes y acciones críticas en la zona del pulgar.
- El SOS funciona con dedo, mouse y teclado (mantener Enter o Espacio) y anuncia su estado a lectores de pantalla.
- Respeto a `prefers-reduced-motion`: las animaciones decorativas se apagan.
- Contraste alto sobre fondos oscuros para uso nocturno.
