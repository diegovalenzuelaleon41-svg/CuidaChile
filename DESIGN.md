---
name: CuidaChile
description: Seguridad ciudadana para quien vuelve sola de noche en Santiago, con una central humana detrás.
colors:
  night-base: "#050B14"
  night-raised: "#0A1128"
  night-footer: "#0B1120"
  glass-surface: "#0F172A"
  control-surface: "#1E293B"
  streetlight-blue: "#3B82F6"
  action-blue: "#2563EB"
  action-blue-deep: "#1D4ED8"
  glow-blue-soft: "#60A5FA"
  glow-blue-text: "#93C5FD"
  sos-red: "#DC2626"
  sos-red-bright: "#EF4444"
  safe-green: "#10B981"
  safe-green-text: "#34D399"
  caution-amber: "#F59E0B"
  text-primary: "#FFFFFF"
  text-body: "#CBD5E1"
  text-secondary: "#94A3B8"
  text-faint: "#64748B"
  hero-cyan: "#22D3EE"
  hero-violet: "#A855F7"
  day-canvas: "#F8FAFC"
  day-line: "#E2E8F0"
  day-heading: "#0F172A"
  day-ink: "#1E293B"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  body-small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  icon-box: "12px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter-desktop: "32px"
  stack-tight: "8px"
  stack: "16px"
  section-mobile: "80px"
  section-desktop: "112px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.text-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-ghost:
    backgroundColor: "{colors.night-base}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
  button-sos:
    backgroundColor: "{colors.sos-red}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    height: "64px"
  button-route:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    height: "64px"
  card-glass:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.card}"
    padding: "20px"
  panel-glass:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.panel}"
  search-pill:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    height: "56px"
  chip:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    height: "40px"
  map-control:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    size: "48px"
  status-badge-safe:
    backgroundColor: "{colors.safe-green}"
    textColor: "{colors.safe-green-text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: CuidaChile

## Overview

**Creative North Star: "La ciudad de noche"**

CuidaChile se ve como Santiago a oscuras visto desde arriba: un fondo azul noche casi negro, calles que brillan en cian tenue y una interfaz que funciona como alumbrado público. La luz azul orienta y acompaña: marca el camino, el estado activo, la acción siguiente. Encima de esa calma hay una sola señal de alarma, el rojo del SOS, que es lo único cálido de la pantalla y por eso se encuentra sin buscarlo.

El sistema es oscuro por diseño, no por moda: se usa de noche, en la calle, con una mano y poca atención, y una pantalla clara deslumbra y delata. La densidad es baja y los objetivos grandes. Cada superficie es cristal oscuro sobre la noche, y la profundidad viene de la luz que emiten los elementos, no de sombras grises. La landing lleva el mismo mundo que la app: lo que se promete afuera es lo que se ve adentro.

Lo que el sistema rechaza: la acumulación de efectos neón que compiten entre sí (constelaciones, órbitas, escudos holográficos y degradados en cada título). Se probó y se retiró. La noche es silenciosa y la luz se reserva para lo que importa.

**Key Characteristics:**
- Noche azul casi negra (`night-base`) como suelo de todo.
- Azul alumbrado para la interfaz y rojo SOS como único acento cálido.
- Superficies de cristal oscuro translúcido con borde de luz tenue.
- Profundidad por resplandor de color, no por sombra.
- Inter en todos los niveles; los títulos son pesados y compactos.
- Objetivos táctiles grandes y acciones críticas en la zona del pulgar.

## Colors

Una noche azul casi negra, alumbrada en azul, con una sola señal roja.

### Primary
- **Azul alumbrado** (streetlight-blue): el color de la interfaz viva. Estados activos, íconos de acción, bordes de la tarjeta activa, el punto "Tú" del mapa y sus ondas, la línea del ítem activo en la navbar.
- **Azul acción** (action-blue) y **Azul acción profundo** (action-blue-deep): el relleno de los botones de acción. Van en degradado vertical de `streetlight-blue` a `action-blue-deep` en "Comenzar ahora", "Crear mi cuenta" e "Iniciar Ruta Segura".
- **Resplandor azul suave** (glow-blue-soft) y **Texto azul luminoso** (glow-blue-text): íconos y textos azules sobre la noche, como el ítem activo o los íconos de garantías.

### Secondary
- **Rojo SOS** (sos-red) y **Rojo SOS encendido** (sos-red-bright): exclusivos del pedido de ayuda. El botón SOS, sus anillos de radar, la alerta activa y el resplandor detrás del cierre de la landing. Nunca decoran otra cosa.

### Tertiary
- **Verde a salvo** (safe-green / safe-green-text): estado protegido y sistema activo. Badge "Protegido", tarjeta "Estás protegido", checks de "función disponible", operador conectado.
- **Ámbar precaución** (caution-amber): reportes y avisos de ubicación. El botón "Reportar" y la confirmación de reporte.

### Neutral
- **Noche base** (night-base): el fondo de la landing, del header y del mapa teñido.
- **Noche elevada** (night-raised): el centro de los degradados radiales que dan volumen a una sección.
- **Noche del pie** (night-footer): el footer y el cierre.
- **Cristal** (glass-surface): base de paneles, tarjetas, buscador y barras, siempre translúcida (40–90 %) con desenfoque.
- **Control** (control-surface): botones redondos del mapa y cajas de íconos.
- **Texto principal** (text-primary), **Texto de lectura** (text-body), **Texto secundario** (text-secondary) y **Texto tenue** (text-faint): la escala de lectura sobre la noche, de títulos a metadatos.
- **Tema de día** (day-canvas, day-line, day-heading, day-ink): login, registro y panel de operador en su tema claro.

### Named Rules
**La Regla de la Única Señal.** El rojo es solo para pedir ayuda. Si un elemento rojo no es el SOS, la alerta o su eco, sobra.

**La Regla del Alumbrado.** El azul guía, no decora: cada azul en pantalla marca algo que se puede tocar, algo activo o el lugar donde estás.

**La Regla del Único Degradado.** El degradado de color en el texto (`hero-cyan` → `streetlight-blue` → `hero-violet`) existe una sola vez, en "siempre contigo." del hero. Ningún otro título lo usa.

## Typography

**Display Font:** Inter (con system-ui, sans-serif)
**Body Font:** Inter (con system-ui, sans-serif)

**Character:** Una sola familia en todos los niveles. Los títulos en peso 800 con tracking negativo se leen como señalética urbana: firmes, compactos, legibles de un vistazo. El cuerpo en 400 con interlineado amplio respira sobre el fondo oscuro.

### Hierarchy
- **Display** (800, 64px en escritorio / 44px en móvil, 1.02): solo el h1 del hero.
- **Headline** (800, 52px en escritorio / 38px en móvil, 1.05): títulos de sección ("Qué pasa cuando pides ayuda", "Quién está del otro lado").
- **Title** (700, 17–19px, 1.3): títulos de tarjetas, pasos y garantías.
- **Body** (400, 17–20px, 1.625): párrafos de introducción en `text-body`, a 38–52ch como máximo.
- **Body small** (400, 14–15px, 1.625): descripciones de tarjetas en `text-secondary`.
- **Label** (600, 12px, 0.14em, mayúsculas): solo el badge del hero. No se repite sobre cada título.

### Named Rules
**La Regla de la Señalética.** Los títulos van en Inter 800 con tracking −0.03em, en blanco puro, sin acentuar palabras sueltas con color o cursiva.

## Layout

Contenedor central de 1152px como máximo (`max-w-6xl`), con márgenes laterales de 20px en móvil y 32px en escritorio. Las secciones usan una rejilla de 12 columnas en escritorio, que reparte texto y visual en 5/7, y una sola columna en móvil, donde el texto va primero y el visual después. El ritmo vertical entre secciones es de 80px en móvil y 112px en escritorio.

En "Cómo funciona", el panel de la derecha queda fijo a 96px del borde superior mientras los pasos avanzan con el scroll; un paso se activa al cruzar la línea media del panel. La app (`/usuario`) es una pantalla completa: el mapa ocupa todo el fondo, los controles flotan en dos zonas (arriba, buscador y avisos; abajo, controles del mapa, estado y barra de acciones) y la navbar queda fija abajo. Los elementos flotantes se apilan según su alto real, sin coordenadas fijas.

Capas: mapa `z-0`, elementos flotantes `z-40`, header y navbar `z-50`. Nunca hay scroll horizontal: los resplandores se recortan con `overflow-x: clip` para no romper el sticky.

## Elevation & Depth

La profundidad es luz, no sombra. Las superficies son cristal oscuro translúcido con desenfoque de fondo y un borde blanco o azul de muy baja opacidad. Lo que está más arriba o más activo brilla más: un halo azul bajo el elemento activo y un halo rojo bajo el SOS. Las únicas sombras oscuras son sombras de contacto amplias bajo objetos flotantes, como el teléfono del hero o la barra de acciones sobre el mapa.

### Shadow Vocabulary
- **Brillo activo** (`box-shadow: 0 0 20px rgba(59,130,246,0.15)` a `0 0 30px rgba(59,130,246,0.25)`): tarjeta o paso activo.
- **Brillo de acción** (`box-shadow: 0 0 28px rgba(59,130,246,0.45)`, `0 0 40px rgba(59,130,246,0.65)` en hover): botones primarios.
- **Brillo SOS** (`box-shadow: 0 0 30px rgba(220,38,38,0.6)`, hasta `0 0 80px rgba(239,68,68,0.4)` en el SOS grande): solo el botón SOS.
- **Contacto flotante** (`box-shadow: 0 20px 50px rgba(0,0,0,0.5)`): barras y paneles sobre el mapa.

### Named Rules
**La Regla de la Luz Propia.** Un elemento se eleva emitiendo luz de su propio color, nunca con una sombra gris. Si hay que elegir, gana el brillo.

## Shapes

Formas suaves y de una sola mano: píldoras para lo que se toca seguido (botones de la landing, buscador, chips, controles del mapa, badges), 16px para tarjetas y botones grandes de la app, 24px para paneles y barras contenedoras, y 12px para cajas de íconos. Los bordes son líneas de 1px de luz tenue (blanco al 5–10 % o azul al 20–50 %), no separadores grises. Las líneas de tiempo usan trazo discontinuo azul.

## Components

### Buttons
Firmes, luminosos y grandes. Se presionan con el pulgar sin apuntar.
- **Shape:** píldora en la landing; 16px de radio en la barra de la app.
- **Primary:** degradado vertical de azul alumbrado a azul acción profundo, texto blanco 600, 16px 32px de relleno, con brillo de acción.
- **Hover / Focus:** escala 1.02 y brillo más intenso en 200ms con `cubic-bezier(0.23,1,0.32,1)`; al presionar, escala 0.98. Foco con anillo blanco de 4px.
- **Ghost:** fondo transparente, borde azul al 60 %, ícono de play en un círculo; en hover se tiñe de azul al 10 % con brillo.
- **Shimmer:** el primario del hero lleva un brillo que lo cruza cada 3 s y se apaga con movimiento reducido.

### SOS (signature component)
El único elemento rojo del sistema y el más importante.
- **En la app:** rectángulo de 64px de alto y medio ancho de la barra, rojo SOS, ícono de sirena, "SOS" en 26px 800 y "Mantén 1,5 s" debajo.
- **Comportamiento:** mantener presionado 1,5 s para enviar. Mientras se mantiene, el botón se llena de izquierda a derecha y dice "Sigue…"; si se suelta antes, dice "Mantén presionado". Funciona con dedo, mouse y teclado, y vibra al empezar y al enviar.
- **En la landing:** círculo grande con degradado radial rojo, tres anillos de radar desfasados y brillo SOS máximo.

### Cards / Containers
- **Corner Style:** 16px en tarjetas, 24px en paneles.
- **Background:** cristal al 40 % en reposo y al 60 % cuando está activa, con desenfoque.
- **Border:** blanco al 5 % o `#1E293B` en reposo; azul al 50 % cuando está activa.
- **Internal Padding:** 20px (16px en móvil).
- **Hover:** sube 2px y el borde se ilumina en azul.

### Inputs / Fields
- **Buscador:** píldora de cristal al 80 % con borde azul al 20 %, lupa a la izquierda en `text-body` y acción secundaria redonda a la derecha.
- **Chips de acceso rápido:** píldoras de 40px de cristal con borde blanco al 10 % e ícono azul.

### Navigation
- **Header de la landing:** noche base al 75 % con desenfoque, enlaces en `text-secondary` y el activo en blanco con un subrayado azul luminoso.
- **Navbar de la app:** 4 ítems. El activo lleva el ícono y el texto en azul, un degradado azul al 10 % desde abajo y una línea azul de 3px con brillo en el borde inferior. Nunca un círculo sólido.

### Map
- **Estilo:** CARTO Dark Matter teñido en `teñirMapa`: fondo `night-base`, calles en azul al 38 % y avenidas en cian al 60 %, agua y edificios en azules profundos.
- **Pin "Tú":** punto azul con centro blanco, anillo blanco y tres ondas que se expanden, más la etiqueta "Tú" en una píldora azul.
- **Controles:** recentrar en un círculo de 48px aparte y zoom agrupado en una píldora vertical, ambos a la derecha.

## Do's and Don'ts

### Do:
- **Do** usar `night-base` como suelo de todas las superficies oscuras y dar volumen con degradados radiales hacia `night-raised`.
- **Do** reservar el rojo SOS para pedir ayuda: el botón, la alerta activa y su eco.
- **Do** marcar lo activo con luz azul (borde al 50 % y brillo de 15–30 % de opacidad) en lugar de un relleno sólido.
- **Do** mantener las acciones críticas en la zona del pulgar, con objetivos de 48px como mínimo y 64px para Ruta y SOS.
- **Do** apagar animaciones decorativas con `prefers-reduced-motion` y animar solo propiedades nombradas (nunca `transition: all`).
- **Do** mostrar en la landing la interfaz real de la app, con el mismo mapa, pin y barra de acciones.

### Don't:
- **Don't** acumular efectos neón: nada de constelaciones, órbitas, escudos holográficos ni horizontes en más de una sección. El hero puede tener la malla y un horizonte; el resto de las secciones van limpias.
- **Don't** aplicar degradado de color a palabras sueltas en los títulos fuera del hero.
- **Don't** poner una píldora en mayúsculas sobre cada título de sección.
- **Don't** usar violeta como color de interfaz; aparece solo al final del degradado del hero.
- **Don't** usar sombras grises para elevar sobre la noche; usa brillo de color.
- **Don't** mostrar cifras o estados que el producto no cumple, como tiempos de respuesta promedio, aunque sean decorativos.
