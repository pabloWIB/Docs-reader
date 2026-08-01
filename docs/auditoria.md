# Auditoría — Docs Reader

Fecha: 2026-07-30. Estado del proyecto **antes** de la reorganización.
Documento de trabajo interno. Todo lo listado aquí se verificó ejecutando el
sitio en un servidor local y midiendo en el navegador, no por lectura del código.

---

## 1. Inventario de archivos

### 1.1 HTML

| Archivo | Bytes | `<title>` | `<h1>` | Propósito real |
|---|---|---|---|---|
| `index.html` | 23 719 | `Reader` | *no existe* | Aplicación completa: pantalla de biblioteca, visor de PDF y lectura por voz. CSS y JS embebidos en el propio archivo |

Una sola página. No hay `404.html`.

### 1.2 CSS y JS

| Recurso | Ubicación | Bytes aprox. | Estado |
|---|---|---|---|
| Hoja de estilos | `<style>` dentro de `index.html` | 10 200 | Embebida, sin archivo propio |
| Lógica de la aplicación | `<script>` dentro de `index.html` | 8 400 | Embebida, sin archivo propio |
| PDF.js 3.11.174 | `cdnjs.cloudflare.com` | 340 000 (red) | Externo, sin `defer`, sin SRI, sin fallback |
| PDF.js worker | `cdnjs.cloudflare.com` | 1 100 000 (red) | Externo, se descarga al abrir un libro |

No hay archivos `.css` ni `.js` en disco. No hay huérfanos porque no hay archivos:
todo vive en un único documento de 736 líneas.

### 1.3 Imágenes e iconos

| Archivo | Bytes | Dimensiones | Formato | ¿Se usa? |
|---|---|---|---|---|
| `favicon/favicon.svg` | 356 678 | 1000×1000 | SVG con PNG 1024×1024 incrustado en base64 | Sí, `<link rel="icon">` |
| `favicon/web-app-manifest-512x512.png` | 126 530 | 512×512 | PNG | Solo desde el manifest, que apunta a una ruta inexistente |
| `favicon/web-app-manifest-192x192.png` | 33 165 | 192×192 | PNG | Igual que el anterior |
| `favicon/apple-touch-icon.png` | 29 917 | 180×180 | PNG | Sí |
| `favicon/favicon.ico` | 15 086 | 48/32/16 | ICO multi-resolución | Sí |
| `favicon/favicon-96x96.png` | 10 918 | 96×96 | PNG | Sí |

Total del juego de iconos: **572 294 bytes**. El 62 % de ese peso es un único
archivo, `favicon.svg`, que no es vectorial: es un PNG de 267 kB codificado en
base64 dentro de una etiqueta `<image>`. No aporta nitidez sobre el PNG de 512 px
que ya existe.

No hay ninguna otra imagen en el proyecto. Ninguna fotografía, ninguna captura,
ningún recurso de contenido.

### 1.4 Documentos servidos

| Archivo | Bytes | Páginas | Enlazado desde |
|---|---|---|---|
| `pdf/Thecoldstartproblem.pdf` | 5 535 407 | 400 | Botón 01 de la biblioteca |
| `pdf/_OceanofPDF.com_Platform_Revolution_How_Networked_Markets_Are_Transforming_the_Economy--And_How_to_Make_Them_Work_for_You_-_Sangeet_Paul_Choudary.pdf` | 4 802 636 | 324 | Botón 02 de la biblioteca (**enlace roto**, ver 2.1) |

### 1.5 Dependencias externas

| Origen | Qué aporta | Observaciones |
|---|---|---|
| `cdnjs.cloudflare.com` | `pdf.min.js` y `pdf.worker.min.js` 3.11.174 | Sin `preconnect`, sin `integrity`, script bloqueante en `<head>` |
| — | Tipografía | No hay webfont. Pila del sistema: `'SF Mono', 'Fira Code', 'Consolas', monospace`. Nada que precargar |

Cero dependencias npm. Sin `package.json`, sin build.

### 1.6 Archivos basura y sobrantes

| Archivo | Problema |
|---|---|
| `site.webmanifest` (raíz) | **0 bytes**. Archivo vacío. Nada lo referencia; el `<link rel="manifest">` apunta a `favicon/site.webmanifest` |
| `favicon/favicon.svg` | 356 kB para un icono, sin ventaja sobre el PNG existente |

No hay `.bak`, ni `copia de`, ni `final_v2`, ni `.DS_Store`, ni `Thumbs.db`,
ni `node_modules`.

---

## 2. Defectos encontrados

Severidad: **Crítico** rompe la funcionalidad · **Alto** degrada el uso o
bloquea la publicación · **Medio** afecta calidad · **Bajo** cosmético.

### 2.1 Funcionalidad

| # | Severidad | Defecto | Evidencia |
|---|---|---|---|
| 1 | Crítico | El segundo libro **nunca se ha podido abrir**. El nombre del archivo dentro del `onclick` contiene la secuencia `\n` literal (`..._the_Eco\nomy--And_...`), que el motor de JS convierte en un salto de línea real y el navegador elimina de la URL | El visor responde `error: Missing PDF ".../..._the_Ecoomy--And_...pdf"` y el servidor devuelve 404 |
| 2 | Crítico | **La capa de texto está invertida verticalmente.** El resaltado de la palabra que se está leyendo aparece reflejado: la primera palabra de la página se sitúa abajo y la última arriba. La función principal del producto —seguir la lectura sobre la página— no funciona en ninguna página | En la página 9 (canvas de 1180 px de alto), la primera palabra se posiciona en `top: 878px` y la última en `top: 0px`. Causa: `y: vp.height - tx[5] - h`, cuando `Util.transform(vp.transform, …)` ya devuelve coordenadas con el origen arriba |
| 3 | Crítico | El desplazamiento horizontal de cada palabra dentro de un fragmento de texto se calcula como `wi * wScale * word.length * 0.5` —índice de palabra por longitud de palabra— en lugar de acumular los caracteres previos. Los recuadros no coinciden con las palabras | Fórmula en el bucle de `renderAll()` |
| 4 | Alto | **Se renderizan las 400 páginas del PDF antes de mostrar nada.** No hay renderizado progresivo | Medido: 400 `<canvas>` en el DOM, **1 503 MB** de memoria de lienzo, 115 649 `<span>` de palabra. En un equipo modesto o en móvil esto agota la memoria de la pestaña |
| 5 | Alto | `mark()` recorre las 115 649 palabras del documento y les reescribe `className` **en cada evento de palabra pronunciada** | Medido: **42 ms por palabra**. A tres palabras por segundo son 126 ms de bloqueo del hilo principal por segundo, más un `scrollIntoView` forzado por palabra |
| 6 | Alto | Las cajas de palabra se posicionan en **píxeles absolutos** (`left: 222.4px`) dentro de una capa que mide el 100 % de un lienzo mostrado también al 100 % del contenedor. Solo coinciden si la ventana tiene exactamente el ancho intrínseco del lienzo; a cualquier otro ancho, el resaltado se desplaza | `s.style.cssText = 'left:${w.x}px;…'` sobre `.page-block canvas { width: 100% }` |
| 7 | Medio | El alto de cada caja sale de `item.height`, que es 0 en muchos elementos —de ahí el `|| 12` de reserva—, en lugar de derivarse de la matriz de transformación | `h: (item.height * vp.scale) || 12` |
| 8 | Medio | El `catch` de `loadPDF()` escribe en `#loading`, pero `#loading` ya se eliminó del DOM en la línea anterior. Un fallo durante el render lanza un segundo error que oculta el primero | `document.getElementById('loading').remove()` seguido de `document.getElementById('loading').innerHTML` en el `catch` |
| 9 | Medio | El `<select>` de voces desborda su ancho de 150 px y se solapa visualmente con el control de velocidad | Visible con la voz «Microsoft Mark - English (United States)» |
| 10 | Bajo | La variable `esIdx` sugiere español pero busca `startsWith('en')`. Nombre engañoso | `loadVoices()` |

### 2.2 Enlaces, rutas y recursos

| Recurso referenciado | ¿Existe? | Nota |
|---|---|---|
| `favicon/favicon-96x96.png` | Sí | — |
| `favicon/favicon.svg` | Sí | — |
| `favicon/favicon.ico` | Sí | — |
| `favicon/apple-touch-icon.png` | Sí | — |
| `favicon/site.webmanifest` | Sí | Pero su contenido está roto, ver abajo |
| `/web-app-manifest-192x192.png` (desde el manifest) | **No** | El manifest los busca en la raíz; están en `favicon/` |
| `/web-app-manifest-512x512.png` (desde el manifest) | **No** | Igual |
| `pdf/Thecoldstartproblem.pdf` | Sí | — |
| `pdf/…_the_Eco\nomy--And_…pdf` | **No** | Defecto 1 |

No hay imágenes rotas porque no hay ninguna etiqueta `<img>` en el proyecto.
No hay `<link>` ni `<script>` apuntando a archivos locales inexistentes.

### 2.3 Manifest y PWA

`favicon/site.webmanifest` es el archivo de ejemplo del generador, sin tocar:

- `"name": "MyWebSite"` y `"short_name": "MySite"` — texto de plantilla.
- Los dos iconos apuntan a `/web-app-manifest-*.png`, que devuelven 404.
- `"theme_color"` y `"background_color"` en `#ffffff`, en una aplicación cuyo
  fondo es `#0a0a0a`: al instalarla, la pantalla de arranque sale en blanco.
- Sin `start_url`, sin `scope`, sin `description`, sin icono `"any"`
  (los dos declarados son `"maskable"`).

Es decir: la PWA que el README anuncia como funcional no lo está.

### 2.4 SEO

| Elemento | Estado |
|---|---|
| `<title>` | `Reader`, 6 caracteres. Sin marca, sin contexto |
| `<meta name="description">` | **No existe** |
| Open Graph | **No existe** ninguna etiqueta |
| `<link rel="canonical">` | **No existe** |
| `robots.txt` | **No existe** |
| `sitemap.xml` | **No existe** |
| Encabezados | **No hay ningún `<h1>`** en el documento |

### 2.5 Accesibilidad

| # | Problema | Regla |
|---|---|---|
| 1 | `maximum-scale=1.0` en el viewport impide ampliar con los dedos | WCAG 1.4.4 |
| 2 | Contraste de `--ink-dim` (`#666`) sobre `#0a0a0a`: **3,45:1**. Se usa en el contador de páginas, el título de la barra superior, los metadatos de cada libro y el selector de voz | WCAG 1.4.3 exige 4,5:1 |
| 3 | Sin landmarks: ni `<header>`, ni `<nav>`, ni `<main>`, ni `<footer>`. El árbol de accesibilidad de la pantalla de biblioteca tiene 4 nodos en total | WCAG 1.3.1 |
| 4 | El `<select>` de voces y el `<input type="range">` de velocidad no tienen `<label>` ni `aria-label` | WCAG 3.3.2 |
| 5 | Los botones `‹` y `›` miden 28×28 px; el pulgar del slider, 12 px | Objetivo táctil mínimo 44×44 |
| 6 | Los botones de paginación se anuncian como «‹» y «›», sin nombre accesible | WCAG 4.1.2 |
| 7 | Sin estilo `:focus-visible` en ningún control; `#voiceSelect:focus { outline: none }` elimina el indicador del sistema sin sustituirlo | WCAG 2.4.7 |
| 8 | Los 115 649 `<span>` de la capa de texto no están ocultos al lector de pantalla | WCAG 1.3.1 |
| 9 | Cambiar de pantalla (biblioteca ↔ lector) no mueve el foco ni lo anuncia | WCAG 2.4.3 |

### 2.6 CSS

| Problema | Detalle |
|---|---|
| Sin escala de espaciado | Valores sueltos: 2, 3, 4, 6, 8, 12, 14, 16, 18, 20, 24, 28, 32, 48 px mezclados sin sistema |
| Variables incompletas | `:root` define 7 variables de color, pero los espaciados, radios, tamaños de fuente, duraciones de transición y la pila tipográfica están codificados a mano en cada regla |
| Colores fuera del sistema | `rgba(255,255,255,.08)` y `rgba(255,255,255,.4)` escritos a mano en `.word.done` y `.word.current`, duplicando las variables `--highlight` y `--current`, que **quedan declaradas y sin usar** |
| Sin media queries | Ni una sola. El único ajuste responsive es `window.innerWidth < 480` en JavaScript, para la escala del render |
| Selectores por `id` | 17 reglas cuelgan de un `#id`, lo que fija una especificidad alta e impide reutilizar los componentes |
| Estilos en línea | `style="color:#666;font-size:.75rem"` inyectado desde el manejador de errores |
| Sin orden | Reset, variables, componentes y utilidades intercalados sin criterio |

`!important` no aparece nunca, y no hay selectores de más de 3 niveles: eso sí
estaba bien.

### 2.7 JavaScript

| Problema | Detalle |
|---|---|
| 11 manejadores `onclick`/`onchange`/`oninput` en línea | `openBook`, `goBack`, `togglePlay`, `stopReading`, `setVoice`, `updateSpeed`, `navPage` |
| 13 funciones y 12 variables en el ámbito global | Todo el archivo es un único `<script>` sin envolver |
| Sin comprobación de existencia | `document.getElementById(...)` se usa directamente en 30 puntos sin verificar el resultado |
| Sin punto de entrada | No hay `main.js` ni módulos: 220 líneas seguidas |
| Comentario muerto | `// reset viewer` sobre código que ya no resetea el visor completo |

No hay jQuery ni ninguna otra librería que se pudiera retirar. No se detectó
código inalcanzable.

### 2.8 Rendimiento

| Métrica | Valor medido | Objetivo |
|---|---|---|
| Peso de la primera carga (HTML + PDF.js + iconos) | ~750 kB | < 1 MB |
| Memoria de lienzo al abrir un libro | **1 503 MB** | Proporcional a lo visible |
| Nodos del DOM al abrir un libro | **116 100** | < 1 500 |
| Coste por palabra leída | **42 ms** | < 1 ms |
| Scripts con `defer` | 0 de 1 | 1 de 1 |
| `preconnect` al CDN | No | Sí |

### 2.9 Contenido y licencias

| # | Problema |
|---|---|
| 1 | Los dos PDF servidos son libros comerciales con derechos de autor vigentes: *The Cold Start Problem* (Andrew Chen, Harper Business) y *Platform Revolution* (Choudary, Van Alstyne y Parker, W. W. Norton) |
| 2 | El nombre del segundo archivo empieza por `_OceanofPDF.com_`, el dominio de un sitio que distribuye libros sin licencia. El nombre del archivo queda visible en la URL que sirve el sitio |
| 3 | El sitio está publicado en `docsreader.wib.digital` y sirve ambos archivos públicamente |

No hay texto de relleno de plantilla en el HTML: los títulos y autores de los
libros son reales. El único texto de plantilla del proyecto está en el manifest
(`MyWebSite` / `MySite`).

### 2.10 Credenciales

Se revisó el proyecto completo. **No hay ninguna clave de API, token,
contraseña ni credencial** en el código. No hay `.env`, no hay endpoints
autenticados, no hay backend.

### 2.11 Documentación

El `README.md` existente describe un producto distinto del que hay en disco:

| El README dice | La realidad |
|---|---|
| «Range slider for moving through a document» y lo lista como funcionalidad principal | El único `<input type="range">` controla la **velocidad de la voz**. Para pasar de página hay dos botones `‹` `›` |
| No menciona la síntesis de voz en ninguna línea | Es la razón de ser de la aplicación: selector de voz, control de velocidad, resaltado palabra por palabra, botones LEER/PAUSAR/STOP |
| «Installable as a PWA through `site.webmanifest`, with icons from 96px to 512px» | El manifest es la plantilla del generador, con iconos que devuelven 404 |
| «The document path is set in `index.html` where PDF.js is initialised», con un ejemplo de `getDocument('pdf/your-document.pdf')` | No existe tal línea. Hay una biblioteca de dos libros y una función `openBook(file, title, author)` |
| «No upload step — documents are served from the repository» | Correcto, pero es una limitación presentada como característica |

---

## 3. Duplicación

- No hay HTML duplicado entre páginas porque solo hay una página.
- Las dos entradas de la biblioteca repiten la misma estructura de 9 líneas con
  el nombre del archivo, el título y el autor incrustados en un atributo
  `onclick`. Añadir un tercer libro obliga a copiar el bloque y a escribir a
  mano una cadena de JavaScript dentro de un atributo HTML: exactamente el
  mecanismo que produjo el defecto 1.
- El bloque de `#loading` está escrito dos veces: una en el HTML y otra como
  plantilla de cadena dentro de `goBack()`.

---

## 4. Resumen en cinco líneas

1. **Qué es**: un lector de PDF en el navegador que renderiza cada página a
   `<canvas>` con PDF.js y lee el texto en voz alta con la síntesis de voz del
   sistema, resaltando la palabra en curso sobre la página. Sin build, sin
   dependencias npm, sin backend. Una sola página de 736 líneas.
2. **En qué estado está**: publicado y visible en `docsreader.wib.digital`, con
   una interfaz cuidada —monoespaciada, oscura, sobria— y una idea buena, pero
   con la función que lo define rota y sin nada de la capa profesional: ni SEO,
   ni accesibilidad, ni media queries, ni separación de archivos, ni 404.
3. **Lo más grave**: el resaltado de lectura está invertido verticalmente. La
   palabra que suena se marca en el lugar espejo de la página, así que el
   producto no hace lo único que lo diferencia de abrir el PDF en el navegador.
4. **Lo segundo más grave**: uno de los dos libros nunca ha abierto —un `\n`
   colado en el nombre del archivo— y abrir el otro construye 400 lienzos y
   1,5 GB de memoria de golpe, con un coste de 42 ms por cada palabra leída.
5. **El bloqueo para publicar**: los dos PDF son libros comerciales con derechos
   vigentes, y el nombre de uno de ellos lleva impreso el dominio del sitio
   pirata del que salió. El repositorio, tal cual, es redistribución.
