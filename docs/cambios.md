# Registro de cambios

Reorganización completa del proyecto, 2026-07-30. Agrupado por fase.
El punto de partida está descrito en [`auditoria.md`](auditoria.md).

Ningún comando de Git se ejecutó durante este trabajo. Todos los cambios son
locales.

---

## Fase 1 — Auditoría

- Inventario de los 12 archivos del proyecto: pesos, dimensiones, formatos y
  quién referencia a quién.
- Verificación en navegador, no por lectura: se sirvió el sitio en local y se
  midieron memoria de lienzo, nodos del DOM, coste por palabra y posiciones
  reales de la capa de texto.
- Se escribió `docs/auditoria.md` con el inventario y 40 defectos clasificados
  por severidad.

---

## Fase 2 — Estructura

Movimientos de archivos:

| Antes | Después |
|---|---|
| `favicon/apple-touch-icon.png` | `assets/img/icons/apple-touch-icon.png` |
| `favicon/favicon-96x96.png` | `assets/img/icons/favicon-96x96.png` |
| `favicon/favicon.ico` | `assets/img/icons/favicon.ico` |
| `favicon/web-app-manifest-192x192.png` | `assets/img/icons/icon-192.png` |
| `favicon/web-app-manifest-512x512.png` | `assets/img/icons/icon-512.png` |
| `favicon/site.webmanifest` | `site.webmanifest` (reescrito, ver fase 5) |
| `pdf/Thecoldstartproblem.pdf` | `pdf/the-cold-start-problem.pdf` |
| `pdf/_OceanofPDF.com_Platform_Revolution_…_Choudary.pdf` | `pdf/platform-revolution.pdf` |

- El CSS embebido en `index.html` se extrajo a `assets/css/base.css`,
  `layout.css` y `components.css`.
- El JavaScript embebido se extrajo a `assets/js/main.js` y cuatro módulos en
  `assets/js/modules/`.
- Se creó `docs/`.
- Todos los nombres quedan en minúsculas, con guiones, sin tildes y sin el
  dominio del sitio pirata en el nombre del segundo PDF.

## Fase 3 — Higiene

Eliminados:

| Archivo | Motivo |
|---|---|
| `site.webmanifest` (raíz) | 0 bytes. Archivo vacío que no referenciaba nadie |
| `favicon/site.webmanifest` | Plantilla del generador (`MyWebSite` / `MySite`) con iconos que devolvían 404. Sustituido por uno real en la raíz |
| `favicon/favicon.svg` | 356 kB. No era vectorial: un PNG de 1024×1024 codificado en base64 dentro de una etiqueta `<image>`. El PNG de 96 px y el `.ico` cubren el mismo caso |
| `favicon/` (carpeta) | Vacía tras los movimientos |

- Se creó `.gitignore` para el stack detectado: sin `package.json` ni build, así
  que cubre `node_modules/`, `.env`, logs, archivos de editor, basura de sistema
  operativo y las carpetas de Vercel y Netlify.
- Formato normalizado en todo el proyecto: indentación de 2 espacios, comillas
  dobles en HTML, punto y coma en JS, salto de línea final en cada archivo.
- **Credenciales: ninguna.** Se revisó el proyecto entero. No hay claves, tokens
  ni endpoints autenticados, y no hay backend que pudiera necesitarlos.

## Fase 4 — Imágenes

No se añadió ninguna imagen. El proyecto no tiene fotografías ni capturas, y no
se inventó ninguna: el diseño se resuelve con tipografía, filetes y color sólido.

Los cinco iconos existentes se recomprimieron con cuantización a 64 colores, sin
cambio visible en un icono de dos tonos:

| Archivo | Antes | Después | Reducción |
|---|---|---|---|
| `icon-512.png` | 126 530 B | 6 906 B | 94,5 % |
| `icon-192.png` | 33 165 B | 1 335 B | 96,0 % |
| `apple-touch-icon.png` | 29 917 B | 1 302 B | 95,6 % |
| `favicon-96x96.png` | 10 918 B | 1 120 B | 89,7 % |
| `favicon.ico` | 15 086 B | sin tocar | — |
| **Total del juego** | **572 294 B** | **25 749 B** | **95,5 %** |

Ninguna imagen supera ya los 200 kB, así que no hubo que convertir nada a WebP.
No hay etiquetas `<img>` en el proyecto, de modo que las reglas de `width`,
`height`, `loading` y `alt` se aplican únicamente al `og:image`, que declara sus
dimensiones reales y un texto alternativo descriptivo.

## Fase 5 — HTML, SEO y accesibilidad

### Estructura

- `index.html` pasa de un `<div>` por pantalla a `<main>` con dos `<section>`
  conmutadas por el atributo `hidden`, cada una con su `aria-labelledby`.
- Se añadió el `<h1>` que faltaba, un `<h2>` por bloque y jerarquía sin saltos.
- La lista de libros pasa a `<ul>`/`<li>` con `<button>`; el catálogo vive en el
  HTML, no en JavaScript, y añadir un documento es un `<li>`.
- Enlace «Saltar al contenido» al principio del documento.
- Se creó `404.html`, con el mismo lenguaje visual y un enlace de vuelta al
  inicio.

### `<head>`

| Elemento | Antes | Ahora |
|---|---|---|
| `<title>` | `Reader` (6 caracteres) | 51 caracteres en `index.html`, 53 en `404.html`, distintos entre sí |
| `description` | no existía | 155 y 150 caracteres, distintas |
| Open Graph | no existía | `og:type`, `og:site_name`, `og:locale`, `og:url`, `og:title`, `og:description`, `og:image` con tipo, ancho, alto y `og:image:alt` |
| `canonical` | no existía | `https://docsreader.wib.digital/` |
| `theme-color` | no existía | `#0a0a0a`, el fondo real de la aplicación |
| Favicon | 4 enlaces, uno a un SVG de 356 kB | 3 enlaces a archivos verificados en disco |

- `robots.txt`: permite el sitio, excluye `/pdf/` del rastreo y declara el sitemap.
- `sitemap.xml`: una URL real, la raíz. El 404 lleva `noindex` y queda fuera.
- `site.webmanifest` reescrito con el nombre real, descripción, `start_url` y
  `scope` relativos, colores `#0a0a0a` y tres iconos con rutas que existen,
  declarando `any` y `maskable` por separado.

### Accesibilidad

| Corrección | Antes |
|---|---|
| Se quitó `maximum-scale=1.0` del viewport | Impedía ampliar con los dedos |
| `--ink-dim` `#666` → `--ink-muted` `#8a8a8a` | 3,45:1, por debajo del mínimo |
| `<label>` asociado al selector de voz y al control de velocidad | Ninguno de los dos tenía etiqueta |
| `aria-label` en los botones de paginación | Se anunciaban como «‹» y «›» |
| `aria-valuetext` en el control de velocidad | Se anunciaba «1» en vez de «1,0×» |
| `:focus-visible` visible en todos los controles | Ninguno tenía indicador; el `<select>` lo eliminaba con `outline: none` |
| Capa de palabras marcada `aria-hidden` | 115 649 `<span>` expuestos a los lectores de pantalla |
| Números de página marcados `aria-hidden` | 400 nodos de texto sueltos en el árbol |
| El foco viaja al título al cambiar de pantalla y vuelve al libro al salir | El foco se perdía en el `<body>` |
| `role="progressbar"` con `aria-valuenow` en vivo | Barra puramente decorativa |
| `role="status"` en el área de carga y errores | Los cambios no se anunciaban |

**Medición final de contraste:** 415 elementos con texto analizados en las dos
pantallas, **0 incumplimientos**, mínimo **5,38:1** frente al 4,5:1 exigido.

---

## Fase 6 — CSS y sistema de diseño

- **Tokens.** `:root` pasa de 7 variables de color a un sistema completo:
  colores, escala de espaciado, escala tipográfica, alturas de línea, medida de
  línea, geometría, altura de barra, objetivo táctil, duración y curva de
  transición.
- **Paleta derivada, no inventada.** Se conservan el fondo `#0a0a0a` y la tinta
  `#f0f0f0` que ya usaba el sitio. Solo cambian dos valores, y por accesibilidad:
  la tinta apagada `#666` → `#8a8a8a` y el filete `#1e1e1e` → `#262626`.
- **Escala de espaciado** 4 / 8 / 16 / 24 / 32 / 48 / 64 / 96. No queda ningún
  valor suelto.
- **Una sola familia tipográfica**, la pila monoespaciada que ya usaba el
  proyecto.
- Las variables `--highlight` y `--current`, declaradas y nunca usadas, se
  renombraron a `--read-done` y `--read-current` y ahora sí alimentan las reglas
  que antes llevaban el `rgba()` escrito a mano.
- Se eliminó el estilo en línea que inyectaba el manejador de errores.
- Orden dentro de cada archivo: variables → reset → base → layout → componentes
  → utilidades → media queries.
- Ningún selector supera los 3 niveles. El único `!important` del proyecto está
  en `[hidden]`, donde es necesario para ganarle a `display: flex`.

## Fase 7 — Responsive

- **Antes no había ni una media query.** El único ajuste era un
  `window.innerWidth < 480` en JavaScript.
- Mobile-first, con `min-width` en 480, 768, 1024 y 1440.
- La barra de herramientas se reorganizó en dos filas por debajo de 768 px
  —reproducción y paginación arriba, voz y velocidad abajo— y las etiquetas de
  los campos pasan a estar visualmente ocultas conservándose para lectores de
  pantalla. **Altura: 217 px → 113 px a 360 px de ancho**, que devuelve un tercio
  de la pantalla al documento.
- El `<select>` de voces recibió `flex: 1 1 0`, porque un `<select>` declara como
  ancho mínimo el de su opción más larga y desbordaba 17 px a 360 px.
- **Sin scroll horizontal en 360, 480, 768, 1024 y 1440 px**, verificado en las
  dos pantallas con `scrollWidth > innerWidth` y localizando el elemento
  culpable cuando lo había.
- Todas las áreas táctiles miden 44×44 px o más; la más pequeña medida es
  exactamente 44.
- El visor tiene su propio scroll y nunca rompe el layout.

## Fase 8 — UX

- La pantalla de inicio explica qué hace el producto en una frase, en lugar de
  mostrar solo `/ reader` y dos títulos.
- Un CTA principal por pantalla: abrir un libro en la biblioteca, «Leer» en el
  lector.
- Estados completos —default, hover, focus, active, disabled— en botones,
  selectores, deslizador, elementos de la lista y el selector de archivo.
  Transiciones de 180 ms.
- Ancho de línea limitado a 64 caracteres en el texto corrido.
- **Se añadió la apertura de un PDF local** desde el equipo, con validación real
  del tipo de archivo y un mensaje concreto cuando no lo es. Todo ocurre en el
  navegador; no hay endpoint de subida que pudiera fingir funcionar.
- Sin gradientes, sin sombras y sin animaciones decorativas: la única animación
  del proyecto son los tres puntos del indicador de carga.

---

## Fase 9 — JavaScript

Reescritura en cinco archivos. Los tres defectos críticos estaban aquí.

### Defectos corregidos

| # | Defecto | Corrección |
|---|---|---|
| 1 | El segundo libro devolvía 404: un `\n` literal dentro del nombre del archivo, escrito a mano en un atributo `onclick` | El catálogo pasa a atributos `data-` en el HTML. Ambos libros abren: 400 y 324 páginas |
| 2 | La capa de texto estaba invertida en el eje Y: la primera palabra de la página se colocaba abajo | `Util.transform(viewport.transform, …)` ya devuelve coordenadas con el origen arriba. Se eliminó el `vp.height - tx[5]` que volvía a voltearlas |
| 3 | El desplazamiento horizontal usaba `wi * wScale * word.length * 0.5` | Se acumula el índice de carácter real, separadores incluidos |
| 4 | Las cajas se posicionaban en píxeles sobre un lienzo mostrado al 100 % del contenedor | Ahora en porcentaje de la página: siguen alineadas a cualquier ancho |
| 5 | El alto de fuente se aproximaba con `item.height` | `Math.hypot(tx[2], tx[3])`, la altura real de la transformación |
| 6 | El `catch` de la carga escribía en un `#loading` ya eliminado | El área de estado es persistente y se rellena o se vacía |
| 7 | `pause()` usaba `speechSynthesis.pause()`, que Chrome no siempre reanuda | Pausar cancela y guarda el índice de palabra; reanudar vuelve a hablar desde ahí. Determinista |
| 8 | Utterances largos se cortaban a los ~15 s en Chrome | Se emite en fragmentos cuyo tamaño se escala con la velocidad para no llegar a ese techo |
| 9 | `getVoices()` devuelve `[]` en Chrome hasta que dispara `voiceschanged`, y algunas versiones no lo disparan | Evento más sondeo breve de respaldo |
| 10 | La voz seguía hablando al cerrar o recargar la pestaña | `pagehide` detiene la síntesis |
| 11 | `esIdx` buscaba voces en inglés | Renombrada, con el motivo explicado en un comentario |

### Estructura

- Punto de entrada único, `main.js`; el resto en `modules/`.
- Cero manejadores en línea: eran 11. Delegación de eventos en la lista de libros.
- Cero variables globales sueltas: eran 12 variables y 13 funciones.
- Sin `var`. Ningún elemento se toca sin comprobar antes que existe; `main.js`
  aborta con un mensaje si falta alguno.
- Se añadieron caminos de error reales que antes no existían: PDF.js que no
  llega desde el CDN, navegador sin síntesis de voz, sistema sin ninguna voz
  instalada, archivo que no es un PDF, y páginas sin texto extraíble, que se
  saltan en lugar de detener la lectura.
- **Cero errores y cero avisos en consola** en las dos páginas, en todos los
  flujos probados.

## Fase 10 — Rendimiento

| Métrica | Antes | Ahora |
|---|---|---|
| Memoria de lienzo al abrir un libro de 400 páginas | 1 503 MB | **13 MB** |
| Nodos del DOM con un libro abierto | 116 100 | **922** |
| Coste de resaltar una palabra | 42 ms | **O(1)**, solo los `<span>` que cambian |
| Tiempo hasta la primera página dibujada | tras renderizar las 400 | **812 ms** |
| Peso de la primera carga | ~750 kB | **137 kB** |
| Juego de iconos | 572 kB | **26 kB** |
| Scripts con `defer` | 0 | 1 de 1, más los módulos, diferidos por definición |
| `preconnect` al CDN | no | sí |

- PDF.js queda fijado a 3.11.174 y verificado con `integrity` SHA-384 y
  `crossorigin`, que antes no tenía.
- No hay webfonts, así que no hay nada que precargar ni ningún
  `font-display` que declarar: la pila tipográfica es del sistema.
- Los tres archivos CSS suman 21 kB y se cargan de forma bloqueante a propósito:
  fragmentarlos más o diferirlos solo añadiría un parpadeo sin estilos.
- Ninguna librería cargada para usar una sola función. PDF.js es la única
  dependencia y se usa entera.

---

## Fase 11 — QA

Recorrido completo con el sitio servido en local. Todo verificado ejecutando,
no leyendo.

| Comprobación | Resultado |
|---|---|
| Enlaces del pie a destinos reales | `wib.digital` y `github.com/pabloWIB/Docs-Reader` responden |
| Cada `<link>`, `<script>`, `data-pdf` e icono apunta a un archivo real | 25 referencias locales, **0 rotas** |
| Archivos que nadie referencia | **ninguno** |
| Errores en consola, `index.html` y `404.html` | **0** |
| Scroll horizontal a 360 / 480 / 768 / 1024 / 1440 px | **ninguno**, en las dos pantallas |
| Contraste | 415 elementos, **0 incumplimientos**, mínimo 5,38:1 |
| Áreas táctiles | mínimo medido **44×44 px** |
| Libro 01 | abre, 400 páginas, lee y resalta |
| Libro 02 | abre, 324 páginas — antes devolvía 404 |
| PDF local desde el equipo | abre, 324 páginas, título tomado del nombre del archivo |
| Archivo que no es PDF | rechazado con un mensaje concreto, sin salir de la biblioteca |
| Leer → Pausar → Reanudar → Detener | los cuatro estados correctos, la reanudación continúa en la palabra exacta |
| `Escape` | vuelve a la biblioteca, detiene la voz, libera las páginas y devuelve el foco al libro que se abrió |
| Sin PDF.js (CDN caído) | aviso real y todos los controles deshabilitados |
| Sin síntesis de voz | los controles de voz se ocultan, el documento sigue siendo legible |
| Apertura directa desde disco (`file://`) | aviso con instrucciones en lugar de página en blanco |
| «Lorem ipsum», «TODO», texto de plantilla | **ninguno** |
| Títulos y descripciones únicos por página | sí |
| `404.html` con enlace de vuelta | sí |
| Credenciales en el código | **ninguna** |

## Fase 12 — Documentación

- `README.md` reescrito. El anterior describía un producto distinto: hablaba de
  un deslizador para navegar el documento —que en realidad controla la velocidad
  de la voz—, no mencionaba la lectura en voz alta en ninguna línea, presentaba
  como funcional una PWA cuyo manifest estaba roto, y su ejemplo de uso mostraba
  una línea de código que no existe en el proyecto.
- Se añadieron secciones de soporte de navegadores, atajos de teclado, cómo
  añadir un documento y configuración, todas con información verificada.
- Se conservó y se actualizó la advertencia sobre los libros con derechos de
  autor: el repositorio ya es público, así que dejó de ser una precaución previa
  para ser un problema presente.
- Se escribió este `docs/cambios.md`.

## Fase 13 — Deploy

- Verificado abriendo `index.html` directamente desde el disco y con dos
  servidores estáticos distintos, `python -m http.server` y `npx serve`.
- Sin rutas absolutas de la máquina en ningún archivo.
- Todas las rutas internas relativas y en minúsculas. La única excepción
  deliberada es `404.html`, que usa rutas desde la raíz porque un servidor puede
  servirla desde cualquier profundidad.
- No se creó ningún archivo de configuración de hosting: no se indicó destino y
  el proyecto no lo necesita para funcionar en un estático.
- No se ejecutó ningún despliegue.

---

## Pendiente

Requiere una decisión o material del autor:

1. **Sustituir los dos PDF con derechos de autor.** Es lo único que impide
   presentar el repositorio tal cual. El código no depende de esos archivos.
2. **Un `og:image` propio.** Ahora se usa el icono de 512×512, que es real y
   declara sus dimensiones, pero una tarjeta de 1200×630 se vería mejor al
   compartir el enlace.
3. **Un `favicon.svg` vectorial de verdad**, si existe el original del icono. El
   que había era un PNG disfrazado y se eliminó.
